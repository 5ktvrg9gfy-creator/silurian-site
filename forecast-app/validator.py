from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from statistics import median
from typing import Any, Iterable


SEVERITY_ORDER = {"blocking": 0, "warning": 1, "info": 2}
STAGE_ORDER = {"bytes": 0, "shape": 1, "columns": 2, "rows": 3, "keys": 4, "series": 5}
TOTAL_RE = re.compile(r"^(grand\s+)?(sub)?total|^all$|^total|subtotal", re.I)
DATE_TOKEN_RE = re.compile(r"^(?:\d{4}-\d{2}|[A-Za-z]{3}-\d{2,4}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})$")
SLASH_DATE_RE = re.compile(r"^(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})$")
COMMON_PACK_FACTORS = (2, 4, 5, 6, 10, 12, 20, 24, 25, 48, 50, 100, 144, 500, 1000)

SYNONYMS = {
    "sku": {"sku", "material", "item", "material number"},
    "date": {"date", "month", "req. dely date"},
    "demand": {"demand", "qty shipped", "shipped qty"},
    "uom": {"uom", "unit", "unit of measure"},
    "customer": {"customer"},
    "site": {"site", "plant"},
    "record_type": {"record_type", "record type"},
}


@dataclass(frozen=True)
class ValidationOptions:
    as_of_date: date
    encoding: str | None = None
    delimiter: str | None = None
    header_row: int | None = None
    column_map: dict[str, str] = field(default_factory=dict)
    exclude_rows: tuple[str, ...] = ()
    exclude_columns: tuple[str, ...] = ()
    date_order: str | None = None
    decimal_convention: str | None = None
    unpivot: bool = False
    period_columns: str | tuple[str, ...] | None = None
    year_basis: str | None = None
    fiscal_year_start_month: int | None = None
    exclude_deleted: bool = False
    aggregate_to: str | None = None
    analysis_level: str | None = None
    returns_in_demand: bool | None = None

    @classmethod
    def from_value(cls, value: "ValidationOptions | dict[str, Any]") -> "ValidationOptions":
        if isinstance(value, cls):
            return value
        raw = dict(value)
        as_of = raw.get("as_of_date")
        if isinstance(as_of, str):
            raw["as_of_date"] = date.fromisoformat(as_of)
        if isinstance(raw.get("exclude_rows"), list):
            raw["exclude_rows"] = tuple(raw["exclude_rows"])
        if isinstance(raw.get("exclude_columns"), list):
            raw["exclude_columns"] = tuple(raw["exclude_columns"])
        return cls(**raw)

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["as_of_date"] = self.as_of_date.isoformat()
        return result


@dataclass(frozen=True)
class Finding:
    code: str
    severity: str
    stage: str
    level: str = "file"
    ref: str | None = None
    count: int = 1
    examples: tuple[dict[str, Any], ...] = ()
    detail: str = ""
    action: str = ""
    resolution: str | None = None
    auto_applied: bool = False
    transform: str | None = None
    reversible: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "severity": self.severity,
            "stage": self.stage,
            "scope": {"level": self.level, "ref": self.ref},
            "count": self.count,
            "examples": list(self.examples[:5]),
            "detail": self.detail,
            "action": self.action,
            "resolution": self.resolution,
            "auto": {
                "applied": self.auto_applied,
                "transform": self.transform,
                "reversible": self.reversible,
            },
        }


@dataclass(frozen=True)
class ValidationResult:
    verdict: str
    findings: tuple[Finding, ...]
    normalised_rows: tuple[dict[str, Any], ...]
    metadata: dict[str, Any]
    run_record: dict[str, Any]

    def to_dict(self, include_rows: bool = True) -> dict[str, Any]:
        result = {
            "verdict": self.verdict,
            "findings": [finding.to_dict() for finding in self.findings],
            "metadata": self.metadata,
            "run_record": self.run_record,
        }
        if include_rows:
            result["normalised_rows"] = list(self.normalised_rows)
        return result

    def stable_json(self) -> str:
        return json.dumps(self.to_dict(), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _example(row: int, raw: str, note: str) -> dict[str, Any]:
    return {"row": row, "raw": raw, "note": note}


def _finding(code: str, severity: str, stage: str, detail: str, action: str,
             *, level: str = "file", ref: str | None = None, count: int = 1,
             examples: Iterable[dict[str, Any]] = (), resolution: str | None = None,
             transform: str | None = None, reversible: bool = False) -> Finding:
    return Finding(code, severity, stage, level, ref, count, tuple(examples)[:5], detail,
                   action, resolution, transform is not None, transform, reversible)


def _sort_findings(findings: Iterable[Finding]) -> tuple[Finding, ...]:
    return tuple(sorted(findings, key=lambda item: (
        SEVERITY_ORDER[item.severity], STAGE_ORDER[item.stage], item.code,
        item.ref or "", item.examples[0]["row"] if item.examples else 0,
    )))


def _finish(raw: bytes, options: ValidationOptions, findings: list[Finding],
            rows: list[dict[str, Any]], metadata: dict[str, Any]) -> ValidationResult:
    ordered = _sort_findings(findings)
    verdict = "reject" if any(f.severity == "blocking" for f in ordered) else (
        "accept_with_warnings" if any(f.severity == "warning" for f in ordered) else "accept"
    )
    record = {
        "schema_version": "1.1",
        "dataset_sha256": hashlib.sha256(raw).hexdigest(),
        "options": options.to_dict(),
        "verdict": verdict,
        "findings": [finding.to_dict() for finding in ordered],
        "row_counts": {
            "source_physical_lines": metadata.get("source_physical_lines", 0),
            "parsed_rows": metadata.get("parsed_rows", 0),
            "normalised_rows": len(rows),
        },
        "metadata": metadata,
    }
    return ValidationResult(verdict, ordered, tuple(rows), metadata, record)


def _sniff_delimiter(text: str) -> str:
    candidates = (",", ";", "\t", "|")
    lines = [line for line in text.splitlines()[:20] if line.strip()]
    scores = {candidate: max((line.count(candidate) for line in lines), default=0) for candidate in candidates}
    return max(candidates, key=lambda candidate: (scores[candidate], -candidates.index(candidate)))


def _header_score(cells: list[str]) -> int:
    names = {cell.strip().lower() for cell in cells}
    known = set().union(*SYNONYMS.values()) | {"description", "item description", "material desc", "on_hand", "safety_stock"}
    return len(names & known) * 10 + sum(bool(cell.strip()) for cell in cells)


def _read_physical_rows(text: str, delimiter: str) -> tuple[list[list[str]], list[int]]:
    reader = csv.reader(io.StringIO(text, newline=""), delimiter=delimiter)
    rows, source_lines = [], []
    for row in reader:
        rows.append(row)
        source_lines.append(reader.line_num)
    return rows, source_lines


def _find_header(rows: list[list[str]], options: ValidationOptions) -> int:
    if options.header_row:
        return options.header_row - 1
    candidates = [(index, _header_score(row), len(row)) for index, row in enumerate(rows[:20]) if row]
    if not candidates:
        return 0
    return max(candidates, key=lambda item: (item[1], item[2], -item[0]))[0]


def _is_wide(headers: list[str]) -> bool:
    return sum(bool(DATE_TOKEN_RE.match(value.strip())) for value in headers) >= 3


def _canonical_map(headers: list[str], supplied: dict[str, str]) -> tuple[dict[str, str], list[str], list[str]]:
    mapping, unrecognised, demand_candidates = {}, [], []
    supplied_lower = {key.strip().lower(): value for key, value in supplied.items()}
    for header in headers:
        key = header.strip().lower()
        if key in supplied_lower:
            mapping[header] = supplied_lower[key]
            continue
        matches = [canonical for canonical, names in SYNONYMS.items() if key in names]
        if matches:
            mapping[header] = matches[0]
            if canonical_quantity_name(key):
                demand_candidates.append(header)
        elif any(token in key for token in ("qty", "quantity", "menge")):
            demand_candidates.append(header)
        else:
            unrecognised.append(header)
    return mapping, unrecognised, demand_candidates


def canonical_quantity_name(name: str) -> bool:
    return name in SYNONYMS["demand"] or "qty" in name or "quantity" in name


def _parse_date(raw: str, order: str | None) -> tuple[date | None, str, str | None]:
    value = raw.strip()
    if not value:
        return None, "missing", "missing"
    if re.fullmatch(r"\d{5}", value) and 20000 <= int(value) <= 60000:
        return date(1899, 12, 30) + timedelta(days=int(value)), "excel", None
    if re.fullmatch(r"\d{4}-W\d{2}", value):
        year, week = value.split("-W")
        return date.fromisocalendar(int(year), int(week), 1), "iso_week", None
    for fmt, kind in (("%Y-%m-%d", "iso"), ("%Y/%m/%d %H:%M:%S", "timestamp"),
                      ("%d-%b-%Y", "sap"), ("%b-%y", "month_text")):
        try:
            return datetime.strptime(value, fmt).date(), kind, None
        except ValueError:
            pass
    match = SLASH_DATE_RE.match(value)
    if match:
        first, _, second, year = match.groups()
        a, b, y = int(first), int(second), int(year)
        y = y + 2000 if y < 100 else y
        selected = order.lower() if order else None
        if not selected:
            selected = "dmy" if a > 12 else "mdy" if b > 12 else None
        if not selected:
            return None, "numeric_order", "ambiguous"
        day, month = (a, b) if selected == "dmy" else (b, a)
        try:
            return date(y, month, day), f"numeric_{selected}", None
        except ValueError:
            return None, f"numeric_{selected}", "invalid"
    return None, "unknown", "invalid"


def _date_evidence(values: list[tuple[int, str, str]]) -> tuple[bool, bool, list[dict[str, Any]]]:
    dmy = mdy = False
    examples = []
    for row, sku, raw in values:
        match = SLASH_DATE_RE.match(raw.strip())
        if not match:
            continue
        first, _, second, _ = match.groups()
        a, b = int(first), int(second)
        if a > 12:
            dmy = True
            examples.append(_example(row, raw, f"{sku}: day-first evidence"))
        if b > 12:
            mdy = True
            examples.append(_example(row, raw, f"{sku}: month-first evidence"))
    return dmy, mdy, examples[:5]


def _parse_number(raw: str, ambiguous_dot: bool) -> tuple[float | None, list[str], str | None]:
    value = raw.strip()
    codes = []
    if value.lower() in {"", "n/a", "#n/a", "null", "-"}:
        return None, ["NUMERIC_SENTINEL_NULL"], None
    if re.search(r"[£$€¥]", value):
        return None, [], "currency"
    if re.fullmatch(r"[-+]?\d+(?:[.,]\d+)?\s+[A-Za-z]+", value):
        return None, [], "unit_text"
    if re.fullmatch(r"\(\s*\d+(?:\.\d+)?\s*\)", value):
        codes.append("NUMERIC_ACCOUNTING_NEGATIVE")
        value = "-" + value.strip("() ")
    if re.search(r"[eE][+-]?\d+$", value):
        codes.append("NUMERIC_SCIENTIFIC_NOTATION")
    if ambiguous_dot and re.fullmatch(r"[-+]?\d{1,3}\.\d{3}", value):
        return None, codes, "ambiguous_decimal"
    if re.fullmatch(r"[-+]?\d{1,3}(?:,\d{3})+", value) or re.fullmatch(r"[-+]?\d{1,3}(?: \d{3})+", value):
        codes.append("NUMERIC_THOUSANDS_SEPARATOR")
        value = value.replace(",", "").replace(" ", "")
    try:
        number = float(value)
    except ValueError:
        return None, codes, "unparseable"
    return number, codes, None


def _rows_matching_exclusion(row: list[str], excluded: tuple[str, ...]) -> bool:
    joined = " ".join(cell.strip() for cell in row)
    return any(token.lower() in joined.lower() for token in excluded)


def validate_csv(raw: bytes, options: ValidationOptions | dict[str, Any]) -> ValidationResult:
    opts = ValidationOptions.from_value(options)
    findings: list[Finding] = []
    metadata: dict[str, Any] = {"source_physical_lines": raw.count(b"\n") + (1 if raw else 0)}

    has_bom = raw.startswith(b"\xef\xbb\xbf")
    if has_bom:
        findings.append(_finding("BOM_PRESENT", "info", "bytes", "A UTF-8 byte order mark precedes the first row.",
                                 "No action is required.", transform="stripped UTF-8 BOM", reversible=True))
    if b"\r\n" in raw:
        findings.append(_finding("LINE_ENDINGS_CRLF", "info", "bytes", "The file uses Windows line endings.",
                                 "No action is required.", transform="normalised CRLF line endings", reversible=True))

    requested_encoding = opts.encoding or "utf-8-sig"
    try:
        text = raw.decode(requested_encoding)
        detected_encoding = opts.encoding or "utf-8"
    except UnicodeDecodeError:
        preview = raw.decode("latin-1")
        delimiter = opts.delimiter or _sniff_delimiter(preview)
        if delimiter != ",":
            findings.append(_finding("DELIMITER_NOT_COMMA", "info", "bytes", f"The file uses {repr(delimiter)} as its delimiter.",
                                     "No action is required.", transform=f"detected delimiter {repr(delimiter)}", reversible=True))
        findings.append(_finding("ENCODING_NOT_UTF8", "blocking", "bytes", "The file is latin-1 encoded rather than UTF-8.",
                                 "Approve a latin-1 re-read.", resolution="re-read using latin-1"))
        metadata.update({"encoding": "latin-1", "delimiter": delimiter, "parsed_rows": 0})
        return _finish(raw, opts, findings, [], metadata)

    delimiter = opts.delimiter or _sniff_delimiter(text)
    metadata.update({"encoding": detected_encoding, "delimiter": delimiter})
    if delimiter != ",":
        findings.append(_finding("DELIMITER_NOT_COMMA", "info", "bytes", f"The file uses {repr(delimiter)} as its delimiter.",
                                 "No action is required.", transform=f"used delimiter {repr(delimiter)}", reversible=True))

    parsed, source_lines = _read_physical_rows(text, delimiter)
    metadata["parsed_rows"] = max(0, len(parsed) - 1)
    if not parsed:
        findings.append(_finding("REQUIRED_COLUMN_MISSING", "blocking", "columns", "The file has no readable header.",
                                 "Supply a demand-history extract with SKU, date and demand columns.", resolution="supply a usable file"))
        return _finish(raw, opts, findings, [], metadata)

    header_index = _find_header(parsed, opts)
    headers = [cell.strip() for cell in parsed[header_index]]
    metadata["header_row"] = source_lines[header_index]
    data_pairs = [(row, source_lines[index]) for index, row in enumerate(parsed[header_index + 1:], start=header_index + 1)]

    total_rows = [(row, line) for row, line in data_pairs if row and TOTAL_RE.search(row[0].strip())
                  and not row[0].strip().lower().startswith("subtotal")]
    total_columns = [header for header in headers if re.search(r"(^|\s)(fy\s+)?(total|sum|ytd)($|\s)", header, re.I)]
    if header_index > 0 and not opts.header_row:
        preamble = parsed[:header_index]
        findings.append(_finding("PREAMBLE_ROWS_BEFORE_HEADER", "blocking", "shape",
                                 f"The header was found on source row {source_lines[header_index]}, after {header_index} preamble rows.",
                                 f"Confirm source row {source_lines[header_index]} as the header.", count=header_index,
                                 examples=[_example(source_lines[i], delimiter.join(row), "preamble") for i, row in enumerate(preamble[:5])],
                                 resolution=f"set header_row to {source_lines[header_index]}"))
    if total_rows:
        findings.append(_finding("TOTALS_ROW_PRESENT", "blocking", "shape", "One or more total rows are present in the data area.",
                                 "Confirm exclusion of the total rows.", count=len(total_rows),
                                 examples=[_example(line, delimiter.join(row), "suspected total row") for row, line in total_rows[:5]],
                                 resolution="confirm total-row exclusions"))
    wide = _is_wide(headers)
    metadata["shape"] = "wide" if wide else "long"
    if wide and not opts.unpivot:
        period_headers = [header for header in headers if DATE_TOKEN_RE.match(header)]
        findings.append(_finding("WIDE_FORMAT_DETECTED", "blocking", "shape",
                                 f"The file has {len(period_headers)} period columns rather than one date column.",
                                 "Confirm the period columns and approve unpivoting.", resolution="approve unpivot and period columns"))
        if total_columns:
            findings.append(_finding("TOTALS_COLUMN_PRESENT", "blocking", "shape", "A totals column is present beside the period columns.",
                                     "Confirm exclusion of the totals column.", ref=total_columns[0], level="column",
                                     resolution="confirm total-column exclusions"))
        findings.append(_finding("PERIOD_LABEL_YEAR_BASIS_UNKNOWN", "blocking", "shape",
                                 "Month labels do not state whether the year is calendar or fiscal.",
                                 "State calendar or fiscal year and the fiscal start month.",
                                 resolution="supply year basis and fiscal start month"))
    if any(f.severity == "blocking" and f.stage == "shape" for f in findings):
        return _finish(raw, opts, findings, [], metadata)

    blank_lines = [line for row, line in data_pairs if not any(cell.strip() for cell in row)]
    if blank_lines:
        findings.append(_finding("BLANK_ROWS_WITHIN_DATA", "warning", "shape", "Blank separator rows occur within the data.",
                                 "Remove the blank rows before the next export.", count=len(blank_lines),
                                 examples=[_example(line, "", "blank row") for line in blank_lines[:5]]))
    if headers and headers[-1] == "":
        findings.append(_finding("TRAILING_DELIMITER", "info", "shape", "Rows contain a trailing empty field.",
                                 "No action is required.", transform="removed trailing empty field", reversible=True))
        headers = headers[:-1]
        data_pairs = [(row[:-1] if len(row) > len(headers) else row, line) for row, line in data_pairs]
    trailing = [(row, line) for row, line in data_pairs if row and re.search(r"page\s+\d+\s+of\s+\d+", " ".join(row), re.I)]
    if trailing:
        findings.append(_finding("TRAILING_NON_DATA_ROWS", "warning", "shape", "Footer text appears after the data rows.",
                                 "Exclude footer rows from the export.", count=len(trailing),
                                 examples=[_example(line, delimiter.join(row), "footer") for row, line in trailing[:5]]))

    if wide and opts.unpivot:
        excluded_columns = {item.lower() for item in opts.exclude_columns}
        period_headers = [header for header in headers if DATE_TOKEN_RE.match(header) and header.lower() not in excluded_columns]
        sku_header = headers[0]
        long_pairs: list[tuple[list[str], int]] = []
        for row, line in data_pairs:
            if not row or _rows_matching_exclusion(row, opts.exclude_rows) or TOTAL_RE.search(row[0].strip()):
                continue
            lookup = dict(zip(headers, row))
            for period in period_headers:
                long_pairs.append(([lookup.get(sku_header, ""), period, lookup.get(period, "")], line))
        headers = ["sku", "date", "demand"]
        data_pairs = long_pairs

    data_pairs = [(row, line) for row, line in data_pairs
                  if any(cell.strip() for cell in row) and not _rows_matching_exclusion(row, opts.exclude_rows)
                  and not (row and re.search(r"page\s+\d+\s+of\s+\d+", " ".join(row), re.I))]

    mapping, unrecognised, demand_candidates = _canonical_map(headers, opts.column_map)
    mapped_values = set(mapping.values())
    if opts.column_map:
        findings.append(_finding("COLUMN_MAP_NON_CANONICAL", "info", "columns", "A user-supplied column mapping was applied.",
                                 "No action is required.", transform="applied explicit column mapping", reversible=True))
    quantity_headers = [header for header in headers if any(token in header.lower() for token in ("qty", "quantity", "menge"))]
    quantity_ambiguous = len(quantity_headers) > 1 and "demand" not in {opts.column_map.get(header) for header in quantity_headers}
    if quantity_ambiguous:
        findings.append(_finding("QUANTITY_COLUMN_AMBIGUOUS", "blocking", "columns",
                                 f"Multiple quantity columns could represent demand: {', '.join(quantity_headers)}.",
                                 "Select the column that represents actual demand.", level="column", ref="demand",
                                 resolution="map one quantity column to demand"))
    missing = [field for field in ("sku", "date", "demand") if field not in mapped_values]
    if unrecognised and (missing or quantity_ambiguous):
        findings.append(_finding("COLUMN_NAME_UNRECOGNISED", "blocking", "columns",
                                 f"The file contains unmapped headers: {', '.join(unrecognised)}.",
                                 "Map the source columns to SKU, date and demand.", count=len(unrecognised),
                                 level="column", ref=unrecognised[0], resolution="supply an explicit column map"))
    if missing:
        findings.append(_finding("REQUIRED_COLUMN_MISSING", "blocking", "columns",
                                 f"Required fields are missing: {', '.join(missing)}.",
                                 "Supply a demand-history extract with SKU, date and demand.", count=len(missing),
                                 level="column", ref=missing[0], resolution="supply the missing information"))
        lower_headers = {header.lower() for header in headers}
        if "demand" in missing and {"on_hand", "safety_stock"}.issubset(lower_headers):
            findings.append(_finding("WRONG_FILE_TYPE", "blocking", "columns",
                                     "The file appears to be an inventory snapshot, not demand history.",
                                     "Request the historical demand extract from the client.", resolution="supply the correct file"))
    if any(f.severity == "blocking" and f.stage == "columns" for f in findings) and not (
        "Material Number" in headers and "Req. Dely Date" in headers
    ):
        return _finish(raw, opts, findings, [], metadata)

    inverse = {canonical: source for source, canonical in mapping.items()}
    header_index_by_name = {header: index for index, header in enumerate(headers)}
    raw_records: list[dict[str, Any]] = []
    for row, source_line in data_pairs:
        record = {"source_row": source_line, "_raw": delimiter.join(row)}
        for canonical, source in inverse.items():
            index = header_index_by_name.get(source)
            record[canonical] = row[index] if index is not None and index < len(row) else ""
        raw_records.append(record)

    if "Deleted Flag" in headers and any((row[header_index_by_name["Deleted Flag"]] if len(row) > header_index_by_name["Deleted Flag"] else "").strip() for row, _ in data_pairs):
        findings.append(_finding("DELETED_LINES_PRESENT", "blocking", "rows", "Deleted order lines are present.",
                                 "Confirm exclusion of rows carrying the deletion flag.", resolution="set exclude_deleted true"))
        if opts.exclude_deleted:
            raw_records = [record for record, (row, _) in zip(raw_records, data_pairs)
                           if not (row[header_index_by_name["Deleted Flag"]] if len(row) > header_index_by_name["Deleted Flag"] else "").strip()]

    date_values = [(record["source_row"], str(record.get("sku", "")), str(record.get("date", ""))) for record in raw_records]
    dmy_evidence, mdy_evidence, evidence_examples = _date_evidence(date_values)
    inferred_order = opts.date_order.lower() if opts.date_order else ("dmy" if dmy_evidence and not mdy_evidence else "mdy" if mdy_evidence and not dmy_evidence else None)
    if dmy_evidence and mdy_evidence and not opts.date_order:
        findings.append(_finding("DATE_FORMAT_AMBIGUOUS", "blocking", "rows",
                                 "The date column contains contradictory day-first and month-first evidence.",
                                 "State the date order per source or split the file.", examples=evidence_examples,
                                 resolution="supply date order per source"))

    ambiguous_dot = any(re.fullmatch(r"[-+]?\d{1,3}(?:,\d{3})+", str(record.get("demand", "")).strip()) or
                        re.fullmatch(r"[-+]?\d{1,3}(?: \d{3})+", str(record.get("demand", "")).strip())
                        for record in raw_records)
    normalised: list[dict[str, Any]] = []
    date_kinds: set[str] = set()
    date_errors: dict[str, list[dict[str, Any]]] = defaultdict(list)
    number_codes: dict[str, list[dict[str, Any]]] = defaultdict(list)
    number_errors: dict[str, list[dict[str, Any]]] = defaultdict(list)
    sku_whitespace, sku_case = [], []
    uoms: set[str] = set()
    for record in raw_records:
        source_row = record["source_row"]
        raw_sku = str(record.get("sku", ""))
        sku = raw_sku.strip().upper()
        if raw_sku != raw_sku.strip():
            sku_whitespace.append(_example(source_row, raw_sku, "whitespace removed"))
        if raw_sku.strip() != raw_sku.strip().upper():
            sku_case.append(_example(source_row, raw_sku, "case normalised"))
        parsed_date, kind, date_error = _parse_date(str(record.get("date", "")), inferred_order)
        date_kinds.add(kind)
        if kind == "excel":
            date_errors["EXCEL_SERIAL_DATE"].append(_example(source_row, str(record.get("date", "")), "converted from Excel epoch"))
        if date_error == "missing":
            date_errors["DATE_MISSING"].append(_example(source_row, "", "date is required"))
        elif date_error == "invalid":
            date_errors["DATE_INVALID"].append(_example(source_row, str(record.get("date", "")), "not a valid date"))
        elif date_error == "ambiguous":
            date_errors["DATE_FORMAT_AMBIGUOUS"].append(_example(source_row, str(record.get("date", "")), "order cannot be inferred"))
        if parsed_date and parsed_date > opts.as_of_date:
            date_errors["DATE_FUTURE"].append(_example(source_row, parsed_date.isoformat(), "after as_of_date"))
        number, codes, number_error = _parse_number(str(record.get("demand", "")), ambiguous_dot and not opts.decimal_convention)
        for code in codes:
            number_codes[code].append(_example(source_row, str(record.get("demand", "")), "normalised quantity"))
        if number_error:
            number_errors[number_error].append(_example(source_row, str(record.get("demand", "")), number_error.replace("_", " ")))
        uom = str(record.get("uom", "")).strip()
        if uom:
            uoms.add(uom)
        if parsed_date is not None and number is not None and sku:
            normalised.append({
                "source_row": source_row, "sku": sku, "date": parsed_date.isoformat(), "demand": number,
                **({"uom": uom} if "uom" in record else {}),
                **({"customer": str(record.get("customer", "")).strip()} if "customer" in record else {}),
                **({"site": str(record.get("site", "")).strip()} if "site" in record else {}),
                **({"record_type": str(record.get("record_type", "")).strip()} if "record_type" in record else {}),
            })

    if len({kind for kind in date_kinds if kind not in {"missing", "unknown"}}) >= 3:
        findings.append(_finding("DATE_FORMAT_MIXED", "blocking", "rows", "The date column contains multiple date formats.",
                                 "State the date order or split the file by source system.", resolution="supply date parsing decisions"))
    for code, examples in date_errors.items():
        severity = "warning" if code in {"EXCEL_SERIAL_DATE", "DATE_FUTURE"} else "blocking"
        action = "Review the affected source rows." if severity == "warning" else "Correct or remove the affected rows."
        value_label = "date value requires" if len(examples) == 1 else "date values require"
        findings.append(_finding(code, severity, "rows", f"{len(examples)} {value_label} attention.", action,
                                 level="column", ref="date", count=len(examples), examples=examples,
                                 resolution=None if severity == "warning" else "correct the dates or supply the date order",
                                 transform="converted Excel serial date" if code == "EXCEL_SERIAL_DATE" else None,
                                 reversible=code == "EXCEL_SERIAL_DATE"))
    code_details = {
        "NUMERIC_THOUSANDS_SEPARATOR": ("info", "Thousands separators were removed.", "stripped thousands separator"),
        "NUMERIC_ACCOUNTING_NEGATIVE": ("info", "Accounting negatives were converted to signed values.", "converted accounting negative"),
        "NUMERIC_SCIENTIFIC_NOTATION": ("info", "Scientific notation was converted to a numeric value.", "expanded scientific notation"),
        "NUMERIC_SENTINEL_NULL": ("warning", "Sentinel values were interpreted as missing quantities.", None),
    }
    for code, examples in number_codes.items():
        severity, detail, transform = code_details[code]
        findings.append(_finding(code, severity, "rows", detail, "Review missing values." if severity == "warning" else "No action is required.",
                                 level="column", ref="demand", count=len(examples), examples=examples,
                                 transform=transform, reversible=transform is not None))
    missing_quantity_examples = number_codes.get("NUMERIC_SENTINEL_NULL", [])
    if any(example["raw"].strip() == "" for example in missing_quantity_examples):
        blank_examples = [example for example in missing_quantity_examples if example["raw"].strip() == ""]
        findings.append(_finding("VALUE_MISSING", "warning", "rows", "Demand is blank on one or more rows.",
                                 "Supply the missing quantity or remove the affected rows.", level="column", ref="demand",
                                 count=len(blank_examples), examples=blank_examples))
    for error, examples in number_errors.items():
        code, detail, action, resolution = {
            "currency": ("CURRENCY_SYMBOL_IN_QUANTITY", "A currency symbol appears in the quantity column.", "Confirm that demand volume, not value, was exported.", "supply the correct demand column"),
            "unit_text": ("NUMERIC_UNPARSEABLE", "A quantity contains trailing unit text.", "Confirm the unit or correct the value.", "confirm unit or correct row"),
            "ambiguous_decimal": ("NUMERIC_DECIMAL_COMMA_AMBIGUOUS", "A value could represent either a decimal or a thousands separator.", "State the decimal convention for the file.", "supply decimal convention"),
            "unparseable": ("NUMERIC_UNPARSEABLE", "A quantity cannot be parsed safely.", "Correct the affected value.", "correct row"),
        }[error]
        findings.append(_finding(code, "blocking", "rows", detail, action, level="column", ref="demand",
                                 count=len(examples), examples=examples, resolution=resolution))
    if sku_whitespace:
        findings.append(_finding("SKU_WHITESPACE", "info", "rows", "Leading or trailing SKU whitespace was removed.", "No action is required.",
                                 level="column", ref="sku", count=len(sku_whitespace), examples=sku_whitespace,
                                 transform="trimmed SKU whitespace", reversible=True))
    if sku_case:
        findings.append(_finding("SKU_CASE_VARIANT", "info", "rows", "SKU case variants were normalised to upper case.", "No action is required.",
                                 level="column", ref="sku", count=len(sku_case), examples=sku_case,
                                 transform="upper-cased SKU", reversible=True))
    if len({uom.lower() for uom in uoms}) > 1 or len(uoms) > 2:
        findings.append(_finding("UOM_INCONSISTENT", "warning", "rows", f"The UOM column contains: {', '.join(sorted(uoms))}.",
                                 "Confirm the unit used for each series.", level="column", ref="uom", count=len(uoms)))

    record_types = [row.get("record_type", "") for row in normalised if "record_type" in row]
    if record_types:
        canonical_types = {str(value).strip().lower() for value in record_types}
        display_types = [value if value else "(blank)" for value in sorted(canonical_types)]
        type_examples = [
            _example(row["source_row"], f"record_type={str(row.get('record_type', '')).strip() or '(blank)'}", "record type")
            for row in normalised if "record_type" in row
        ][:5]
        actual_variants = {str(value).strip() for value in record_types if str(value).strip().lower() == "actual"}
        if len(actual_variants) > 1:
            findings.append(_finding("RECORD_TYPE_CASE_VARIANT", "info", "rows", "Record-type case variants were normalised.",
                                     "No action is required.", transform="normalised record-type case", reversible=True))
        if len(canonical_types) > 1:
            findings.append(_finding("RECORD_TYPE_MIXED", "blocking", "rows", f"Record types found: {', '.join(display_types)}.",
                                     "Confirm which record types represent actual demand.", count=len(record_types),
                                     examples=type_examples, resolution="supply actual record types"))
        if canonical_types & {"forecast", "budget", "plan"}:
            plan_rows = [
                row for row in normalised
                if str(row.get("record_type", "")).strip().lower() in {"forecast", "budget", "plan"}
            ]
            plan_examples = [
                _example(row["source_row"], f"record_type={str(row.get('record_type', '')).strip()}", "forward-looking row")
                for row in plan_rows
            ][:5]
            findings.append(_finding("FORECAST_ROWS_IN_ACTUALS", "blocking", "rows", "Forward-looking plan rows are mixed with actual demand.",
                                     "Filter the run to confirmed actual record types.", count=len(plan_rows),
                                     examples=plan_examples, resolution="supply actual record types"))

    if "Order Type" in headers:
        order_index = header_index_by_name["Order Type"]
        returns = [(row, line) for row, line in data_pairs if len(row) > order_index and row[order_index].strip().upper() == "ZRE"]
        if returns:
            findings.append(_finding("RETURNS_ORDER_TYPE_PRESENT", "warning", "rows", "Returns order types are present.",
                                     "Confirm whether returns belong in the demand stream.", count=len(returns),
                                     examples=[_example(line, delimiter.join(row), "return order type") for row, line in returns[:5]]))

    negative_rows = [row for row in normalised if row["demand"] < 0]
    reversal_source_rows: set[int] = set()
    used_positive_rows: set[int] = set()
    for negative in negative_rows:
        match = next((positive for positive in normalised
                      if positive["sku"] == negative["sku"]
                      and positive["demand"] == abs(negative["demand"])
                      and positive["source_row"] not in used_positive_rows), None)
        if match:
            reversal_source_rows.update({negative["source_row"], match["source_row"]})
            used_positive_rows.add(match["source_row"])
            findings.append(_finding("VALUE_NEGATIVE_REVERSAL", "info", "rows", "A negative value exactly offsets a matching positive entry.",
                                     "No action is required.", level="row", ref=str(negative["source_row"]),
                                     examples=[_example(negative["source_row"], str(negative["demand"]), f"offsets row {match['source_row']}")],
                                     transform="netted matching reversal", reversible=True))
        else:
            findings.append(_finding("VALUE_NEGATIVE", "warning", "rows", "A negative value has no matching offset and appears to be a return.",
                                     "Confirm whether returns belong in the demand stream.", level="row", ref=str(negative["source_row"]),
                                     examples=[_example(negative["source_row"], str(negative["demand"]), "unmatched negative")]))
    if reversal_source_rows:
        normalised = [row for row in normalised if row["source_row"] not in reversal_source_rows]

    key_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in normalised:
        key_groups[(row["sku"], row["date"])].append(row)
    modal_count = Counter(len(group) for group in key_groups.values()).most_common(1)[0][0] if key_groups else 1
    transactional_headers = {"Order Type", "Sales Org", "Deleted Flag", "Order Qty", "Confirmed Qty", "Shipped Qty"}
    transactional_hint = len(transactional_headers.intersection(headers)) >= 2
    transactional = modal_count > 1 or (transactional_hint and any(len(group) > 1 for group in key_groups.values()))
    metadata["grain"] = "transactional" if transactional else "period"
    if not transactional:
        if any(len(group) > 1 for group in key_groups.values()):
            findings.append(_finding("GRAIN_PERIOD_DETECTED", "info", "keys", "The modal row count per SKU and period is one.",
                                     "No action is required.", transform="classified period grain", reversible=True))
    else:
        code = "GRAIN_TRANSACTIONAL_DETECTED" if not opts.aggregate_to else "GRANULARITY_TRANSACTIONAL"
        findings.append(_finding(code, "warning", "keys", "Multiple rows per SKU and period indicate transactional grain.",
                                 "Confirm the period and dimensions used for aggregation."))

    deduplicated: list[dict[str, Any]] = []
    exact_duplicate_examples = []
    seen_exact: set[tuple[Any, ...]] = set()
    for row in normalised:
        signature = tuple((key, json.dumps(value, sort_keys=True)) for key, value in sorted(row.items()) if key != "source_row")
        if signature in seen_exact and not transactional:
            exact_duplicate_examples.append(_example(row["source_row"], f"{row['sku']},{row['date']},{row['demand']}", "exact duplicate"))
            continue
        seen_exact.add(signature)
        deduplicated.append(row)
    if exact_duplicate_examples:
        findings.append(_finding("DUPLICATE_ROW_EXACT", "info", "keys", "Exact duplicate rows were removed from a period-grain file.",
                                 "No action is required.", count=len(exact_duplicate_examples), examples=exact_duplicate_examples,
                                 transform="removed exact duplicate rows", reversible=True))
    normalised = deduplicated

    has_dimensions = any("customer" in row or "site" in row for row in normalised)
    conflicts = []
    if not has_dimensions:
        for key, group in key_groups.items():
            values = {row["demand"] for row in group}
            if len(values) > 1 and not ({value for value in values if value < 0} and sum(values) == 0):
                conflicts.extend(_example(row["source_row"], str(row["demand"]), f"conflicting key {key[0]} {key[1]}") for row in group[:5])
    if conflicts:
        findings.append(_finding("DUPLICATE_KEY_CONFLICT", "blocking", "keys", "A SKU and period contain different demand quantities.",
                                 "Choose whether to aggregate the lines or treat the later row as a correction.", count=len(conflicts),
                                 examples=conflicts, resolution="choose aggregate or correction"))

    raw_skus = defaultdict(set)
    for record in raw_records:
        raw_value = str(record.get("sku", ""))
        comparison = re.sub(r"[-_.\s]", "", raw_value.upper())
        raw_skus[comparison].add(raw_value.strip())
    aliases = [values for values in raw_skus.values() if len(values) > 1 and len({value.upper().strip() for value in values}) > 1]
    suffix_values = sorted({str(record.get("sku", "")).strip() for record in raw_records})
    suffix_pairs = [(a, b) for a in suffix_values for b in suffix_values if a != b and
                    (b.upper().startswith(a.upper()) or a.upper().startswith(b.upper()))]
    if aliases or suffix_pairs:
        values = sorted(set().union(*aliases) if aliases else {item for pair in suffix_pairs for item in pair})
        findings.append(_finding("SKU_ALIAS_SUSPECTED", "warning", "keys", f"Related SKU forms were found: {', '.join(values)}.",
                                 "Confirm whether these are separate items or aliases.", level="sku", ref=values[0], count=len(values)))

    if has_dimensions:
        depths = defaultdict(set)
        depth_counts = Counter()
        for row in normalised:
            depth = sum(bool(row.get(field)) and str(row.get(field)).upper() != "ALL" for field in ("customer", "site"))
            depths[row["sku"]].add(depth)
            depth_counts[depth] += 1
        if any(len(values) > 1 for values in depths.values()):
            detail = ", ".join(f"level {level}: {count} rows" for level, count in sorted(depth_counts.items()))
            findings.append(_finding("GRANULARITY_MIXED", "blocking", "keys", f"Rows exist at different dimension depths ({detail}).",
                                     "Choose one analysis level.", resolution="select analysis level"))
        subtotal_rows = [row for row in normalised if TOTAL_RE.search(row["sku"]) or
                         str(row.get("customer", "")).upper() == "ALL" or str(row.get("site", "")).upper() == "ALL"]
        arithmetic_subtotals = []
        groups_by_key = defaultdict(list)
        for row in normalised:
            groups_by_key[(row["sku"], row["date"])].append(row)
        for group in groups_by_key.values():
            if len(group) >= 3:
                for candidate in group:
                    remaining = sum(item["demand"] for item in group if item is not candidate)
                    if remaining and abs(candidate["demand"] - remaining) / abs(remaining) <= 0.005:
                        arithmetic_subtotals.append(candidate)
        suspects_by_row = {row["source_row"]: row for row in subtotal_rows + arithmetic_subtotals}
        suspects = [suspects_by_row[source_row] for source_row in sorted(suspects_by_row)]
        if suspects:
            findings.append(_finding("SUBTOTAL_ROW_SUSPECTED", "blocking", "keys", "Label or arithmetic checks found suspected subtotal rows.",
                                     "Confirm which rows are totals.", count=len(suspects),
                                     examples=[_example(row["source_row"], row["sku"], "suspected subtotal") for row in suspects[:5]],
                                     resolution="confirm subtotal exclusions"))
            findings.append(_finding("DOUBLE_COUNT_RISK", "blocking", "keys", "Summing all rows would count detail and subtotal quantities together.",
                                     "Select one analysis level before aggregation.", resolution="select analysis level"))
        if any(finding.severity == "blocking" and finding.stage == "keys" for finding in findings):
            metadata["parsed_rows"] = len(raw_records)
            return _finish(raw, opts, findings, normalised, metadata)

    if "Sales Org" in headers:
        index = header_index_by_name["Sales Org"]
        orgs = sorted({row[index].strip() for row, _ in data_pairs if len(row) > index and row[index].strip()})
        if len(orgs) > 1:
            findings.append(_finding("MULTIPLE_SALES_ORGS", "warning", "keys", f"Multiple sales organisations are present: {', '.join(orgs)}.",
                                     "Confirm whether they form one demand stream.", count=len(orgs)))

    series = defaultdict(list)
    for row in normalised:
        if row["demand"] >= 0:
            series[row["sku"]].append(row)
    for sku, values in series.items():
        values.sort(key=lambda row: row["date"])
        if len(values) == 1:
            findings.append(_finding("SINGLE_OBSERVATION_SERIES", "warning", "series", f"SKU {sku} has one observation.",
                                     "Review the available history before forecasting.", level="sku", ref=sku))
        elif len(values) < 12:
            findings.append(_finding("HISTORY_TOO_SHORT", "warning", "series", f"SKU {sku} has {len(values)} periods.",
                                     "Review the available history before forecasting.", level="sku", ref=sku, count=len(values)))

    if series:
        latest = max(date.fromisoformat(row["date"]) for values in series.values() for row in values)
        for sku, values in series.items():
            last = date.fromisoformat(values[-1]["date"])
            if len(values) >= 3 and (latest.year - last.year) * 12 + latest.month - last.month >= 3:
                findings.append(_finding("SERIES_DISCONTINUED", "warning", "series", f"SKU {sku} stops before the latest portfolio period.",
                                         "Confirm whether the item is discontinued.", level="sku", ref=sku))

    zero_skus = {sku for sku, values in series.items() if any(row["demand"] == 0 for row in values)}
    sparse_skus = {sku for sku, values in series.items() if len(values) <= 4 and len(values) > 1}
    if zero_skus:
        zero_names = ", ".join(sorted(zero_skus))
        sparse_names = ", ".join(sorted(sparse_skus)) or "none"
        zero_examples = [_example(row["source_row"], f"{row['sku']},{row['date']},0", "recorded zero")
                         for sku in sorted(zero_skus) for row in series[sku] if row["demand"] == 0][:5]
        findings.append(_finding("ZERO_VS_MISSING_AMBIGUOUS", "warning", "series",
                                 f"Recorded zero demand appears for {zero_names}; sparse comparison series are {sparse_names}.",
                                 "Confirm whether missing periods mean zero demand.", count=len(zero_skus | sparse_skus),
                                 examples=zero_examples))

    for sku, values in series.items():
        if len(values) < 8:
            continue
        quantities = [row["demand"] for row in values]
        candidates = []
        for split in range(3, len(values) - 2):
            before, after = median(quantities[:split]), median(quantities[split:])
            if before <= 0 or after <= 0:
                continue
            ratio = before / after
            candidates.append((abs(math.log(ratio)), split, ratio, before, after))
        if not candidates:
            continue
        _, split, ratio, before, after = max(candidates)
        scale = ratio if ratio >= 1 else 1 / ratio
        nearest = min(COMMON_PACK_FACTORS, key=lambda factor: abs(scale - factor) / factor)
        persistent = len(values[split:]) >= 3 and all(0.5 * after <= value <= 2 * after for value in quantities[split:])
        if scale >= 3 and persistent and abs(scale - nearest) / nearest <= 0.12:
            before_uoms = {row.get("uom", "") for row in values[:split]}
            after_uoms = {row.get("uom", "") for row in values[split:]}
            changed = bool(before_uoms and after_uoms and before_uoms != after_uoms)
            code = "UOM_CHANGE_MIDHISTORY" if changed else "UNIT_SCALE_BREAK_SUSPECTED"
            detail = f"SKU {sku} changes scale near {values[split]['date']} by a factor of {scale:.2f}, close to pack factor {nearest}."
            action = "Supply the conversion factor or approve splitting the series." if changed else "Confirm whether to rescale or split the series."
            findings.append(_finding(code, "blocking", "series", detail, action, level="sku", ref=sku,
                                     count=len(values), examples=[_example(values[split]["source_row"], values[split]["date"], "first period after break")],
                                     resolution="supply conversion factor or split decision"))

    metadata["parsed_rows"] = len(raw_records)
    return _finish(raw, opts, findings, normalised, metadata)
