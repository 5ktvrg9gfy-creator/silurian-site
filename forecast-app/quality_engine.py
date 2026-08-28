from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import date
from statistics import mean, median
from typing import Any, Iterable

from validator import COMMON_PACK_FACTORS, ValidationResult


DEFAULT_THRESHOLDS = {
    "history_short_periods": 18,
    "history_not_usable_periods": 6,
    "coverage_not_usable_pct": 50,
    "series_stale_trailing_periods": 3,
    "series_discontinued_trailing_periods": 6,
    "extract_stale_trailing_periods": 2,
    "gap_block_min_run": 3,
    "gap_block_concentration_ratio": 0.8,
    "sparse_coverage_pct": 70,
    "volume_immaterial_share_pct": 0.1,
    "long_tail_cumulative_pct": 99,
    "suspect_zero_max_zero_share_pct": 10,
    "suspect_zero_max_adi": 1.25,
    "outlier_modified_z": 3.5,
    "outlier_deseasonalise_min_periods": 24,
    "level_shift_min_run": 3,
    "level_shift_pack_factor_tolerance_pct": 12,
    "portfolio_not_usable_volume_pct": 20,
    "portfolio_caveated_volume_pct": 5,
}


@dataclass(frozen=True)
class QualityOptions:
    as_of_date: date
    as_of_date_source: str = "server_default"
    grain: str | None = None
    weighting: str = "volume"
    thresholds: dict[str, float] = field(default_factory=lambda: dict(DEFAULT_THRESHOLDS))

    def to_dict(self) -> dict[str, Any]:
        return {
            "as_of_date": self.as_of_date.isoformat(),
            "as_of_date_source": self.as_of_date_source,
            "grain": self.grain,
            "weighting": self.weighting,
            "thresholds": dict(self.thresholds),
        }


@dataclass(frozen=True)
class QualityFinding:
    code: str
    scope: str
    detail: str
    implication: str
    action: str
    sku: str | None = None
    periods: tuple[str, ...] = ()
    metric: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["periods"] = list(self.periods)
        return result


@dataclass(frozen=True)
class QualityResult:
    report: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return self.report

    def stable_json(self) -> str:
        return json.dumps(self.report, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _month_index(value: date) -> int:
    return value.year * 12 + value.month - 1


def _month_distance(start: date, end: date) -> int:
    return _month_index(end) - _month_index(start)


def _period_key(value: date, grain: str) -> tuple[int, ...]:
    if grain == "month":
        return value.year, value.month
    if grain == "week":
        iso = value.isocalendar()
        return iso.year, iso.week
    return value.year, value.month, value.day


def _expected_periods(first: date, last: date, grain: str) -> int:
    if grain == "month":
        return _month_distance(first, last) + 1
    days = (last - first).days
    return days // (7 if grain == "week" else 1) + 1


def _period_position(value: date, grain: str) -> int:
    if grain == "month":
        return _month_index(value)
    if grain == "week":
        return value.toordinal() // 7
    return value.toordinal()


def _infer_grain(series: dict[str, list[dict[str, Any]]], override: str | None) -> tuple[str, dict[str, Any], list[QualityFinding]]:
    if override:
        return override, {"method": "user_override", "series_agree": len(series), "series_total": len(series)}, []
    votes: dict[str, list[str]] = defaultdict(list)
    for sku, rows in series.items():
        dates = sorted({date.fromisoformat(str(row["date"])) for row in rows})
        spacings = [(right - left).days for left, right in zip(dates, dates[1:]) if right > left]
        if not spacings:
            continue
        modal = Counter(spacings).most_common(1)[0][0]
        grain = "day" if modal <= 2 else "week" if modal <= 10 else "month"
        votes[grain].append(sku)
    selected = max(("day", "week", "month"), key=lambda item: (len(votes[item]), item == "month"))
    evidence = {"method": "modal_spacing", "series_agree": len(votes[selected]), "series_total": sum(map(len, votes.values())), "minority": {key: value for key, value in votes.items() if key != selected and value}}
    findings: list[QualityFinding] = []
    if evidence["minority"]:
        minority = ", ".join(f"{key}: {', '.join(values)}" for key, values in sorted(evidence["minority"].items()))
        findings.append(QualityFinding("GRAIN_INCONSISTENT", "portfolio", f"Series disagree on calendar grain ({minority}).", "Coverage and gap metrics are not comparable across mixed grains.", "Confirm the intended grain or split the dataset."))
    return selected, evidence, findings


def _runs(positions: Iterable[int]) -> int:
    values = sorted(set(positions))
    longest = current = 0
    previous = None
    for value in values:
        current = current + 1 if previous is not None and value == previous + 1 else 1
        longest = max(longest, current)
        previous = value
    return longest


def _missing_positions(rows: list[dict[str, Any]], grain: str) -> list[int]:
    positions = sorted({_period_position(date.fromisoformat(str(row["date"])), grain) for row in rows})
    if not positions:
        return []
    present = set(positions)
    return [position for position in range(positions[0], positions[-1] + 1) if position not in present]


def _cv(values: list[float]) -> float:
    if not values:
        return 0.0
    average = mean(values)
    if average == 0 or len(values) < 2:
        return 0.0
    variance = sum((value - average) ** 2 for value in values) / len(values)
    return math.sqrt(variance) / abs(average)


def _outlier_periods(rows: list[dict[str, Any]], thresholds: dict[str, float]) -> list[str]:
    values = [float(row["demand"]) for row in rows]
    def flagged_indices(test_values: list[float]) -> set[int]:
        centre = median(test_values)
        deviations = [abs(value - centre) for value in test_values]
        mad = median(deviations)
        if mad:
            return {index for index, value in enumerate(test_values) if value != 0 and abs(0.6745 * (value - centre) / mad) > thresholds["outlier_modified_z"]}
        ordered = sorted(test_values)
        if len(ordered) < 4:
            return set()
        lower = median(ordered[: len(ordered) // 2])
        upper = median(ordered[(len(ordered) + 1) // 2 :])
        spread = upper - lower
        if not spread:
            return set()
        return {index for index, value in enumerate(test_values) if value != 0 and (value < lower - 1.5 * spread or value > upper + 1.5 * spread)}

    raw_flagged = flagged_indices(values)
    flagged = raw_flagged
    if len(rows) >= thresholds["outlier_deseasonalise_min_periods"]:
        month_values: dict[int, list[float]] = defaultdict(list)
        for row, value in zip(rows, values):
            month_values[date.fromisoformat(str(row["date"])).month].append(value)
        month_medians = {month: median(items) for month, items in month_values.items()}
        adjusted = [value / month_medians[date.fromisoformat(str(row["date"])).month] if month_medians[date.fromisoformat(str(row["date"])).month] else value for row, value in zip(rows, values)]
        flagged = raw_flagged.intersection(flagged_indices(adjusted))
    typical = median([value for value in values if value != 0]) if any(values) else 0
    if typical:
        flagged = {index for index in flagged if values[index] / typical >= 2 or values[index] / typical <= 0.5}
    return [str(rows[index]["date"]) for index in sorted(flagged)]


def _level_shift(rows: list[dict[str, Any]], thresholds: dict[str, float]) -> tuple[str, float] | None:
    values = [float(row["demand"]) for row in rows]
    minimum = max(6, int(thresholds["level_shift_min_run"]))
    if len(values) < minimum * 2:
        return None
    candidates = []
    for split in range(minimum, len(values) - minimum + 1):
        before, after = values[:split], values[split:]
        before_median, after_median = median(before), median(after)
        if before_median <= 0 or after_median <= 0:
            continue
        ratio = after_median / before_median
        scale = ratio if ratio >= 1 else 1 / ratio
        before_mad = median(abs(value - before_median) for value in before)
        after_mad = median(abs(value - after_median) for value in after)
        robust_change = abs(after_median - before_median) > 3 * max(before_mad, after_mad, 1.0)
        sustained = all(0.5 * after_median <= value <= 2 * after_median for value in after)
        nearest = min(COMMON_PACK_FACTORS, key=lambda factor: abs(scale - factor) / factor)
        pack_match = abs(scale - nearest) / nearest <= thresholds["level_shift_pack_factor_tolerance_pct"] / 100
        if robust_change and sustained and scale > 1.2 and not pack_match:
            candidates.append((abs(math.log(ratio)), split, ratio))
    if not candidates:
        return None
    _, split, ratio = max(candidates)
    return str(rows[split]["date"]), ratio


def _finding(code: str, sku: str, detail: str, implication: str, action: str, *, periods: Iterable[str] = (), metric: dict[str, Any] | None = None) -> QualityFinding:
    return QualityFinding(code, "sku", detail, implication, action, sku, tuple(periods), metric or {})


def assess_quality(validation: ValidationResult, options: QualityOptions) -> QualityResult:
    if validation.verdict == "reject":
        raise ValueError("Quality assessment requires an accepted validation result")
    rows = [dict(row) for row in validation.normalised_rows if row.get("demand") is not None]
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[str(row["sku"])].append(row)
    for values in grouped.values():
        values.sort(key=lambda row: (str(row["date"]), int(row.get("source_row", 0))))
    grain, grain_evidence, portfolio_findings = _infer_grain(grouped, options.grain)
    thresholds = {**DEFAULT_THRESHOLDS, **options.thresholds}
    portfolio_volume = sum(float(row["demand"]) for row in rows)
    latest_period = max(date.fromisoformat(str(row["date"])) for row in rows)
    common_last = Counter(str(values[-1]["date"]) for values in grouped.values()).most_common(1)[0]
    extract_trailing = max(0, _month_distance(date.fromisoformat(common_last[0]), options.as_of_date) - 1) if grain == "month" else 0
    if common_last[1] > len(grouped) / 2 and extract_trailing >= thresholds["extract_stale_trailing_periods"]:
        portfolio_findings.append(QualityFinding("EXTRACT_STALE", "portfolio", f"Most series end at {common_last[0]}, {extract_trailing} periods before the analysis date.", "The dataset is internally consistent but does not represent the latest demand position.", "Request a current extract before using headline conclusions.", metric={"trailing_gap_periods": extract_trailing, "series_affected": common_last[1]}))

    metrics_by_sku: dict[str, dict[str, Any]] = {}
    findings_by_sku: dict[str, list[QualityFinding]] = defaultdict(list)
    for sku, values in grouped.items():
        dates = [date.fromisoformat(str(row["date"])) for row in values]
        demand = [float(row["demand"]) for row in values]
        first, last = min(dates), max(dates)
        expected = _expected_periods(first, last, grain)
        present = len({_period_key(value, grain) for value in dates})
        missing = _missing_positions(values, grain)
        longest_gap = _runs(missing)
        zeros = [index for index, value in enumerate(demand) if value == 0]
        nonzero = [value for value in demand if value != 0]
        zero_share = 100 * len(zeros) / present if present else 0
        adi = present / len(nonzero) if nonzero else float(present or 0)
        cv_nonzero = _cv(nonzero)
        trailing_as_of = max(0, _month_distance(last, options.as_of_date) - 1) if grain == "month" else max(0, (_period_position(options.as_of_date, grain) - _period_position(last, grain) - 1))
        volume = sum(demand)
        metrics_by_sku[sku] = {
            "sku": sku,
            "first_period": first.isoformat(), "last_period": last.isoformat(),
            "periods_present": present, "periods_expected_in_span": expected,
            "gap_count": len(missing), "longest_gap": longest_gap,
            "coverage_pct": round(100 * present / expected, 4) if expected else 0,
            "trailing_gap_periods": trailing_as_of,
            "zero_periods": len(zeros), "zero_share_pct": round(zero_share, 4),
            "longest_zero_run": _runs([_period_position(dates[index], grain) for index in zeros]),
            "adi": round(adi, 6), "cv_squared_nonzero": round(cv_nonzero ** 2, 6),
            "mean": round(mean(demand), 6) if demand else 0,
            "median": round(median(demand), 6) if demand else 0,
            "cv": round(_cv(demand), 6), "volume_total": round(volume, 6),
        }
        concentration = longest_gap / len(missing) if missing else 0
        if longest_gap >= thresholds["gap_block_min_run"] and concentration >= thresholds["gap_block_concentration_ratio"]:
            findings_by_sku[sku].append(_finding("GAP_BLOCK", sku, f"A block of {longest_gap} consecutive periods is missing.", "The gap may represent a system migration or transfer rather than demand behaviour.", "Confirm the cause and recover the missing periods if available.", metric={"gap_count": len(missing), "longest_gap": longest_gap, "concentration_ratio": round(concentration, 4)}))
        elif metrics_by_sku[sku]["coverage_pct"] < thresholds["sparse_coverage_pct"]:
            findings_by_sku[sku].append(_finding("ZERO_VS_MISSING_AMBIGUOUS", sku, f"Only {metrics_by_sku[sku]['coverage_pct']:.1f}% of periods contain a row.", "Omitted periods may be zero demand or missing records, and the distinction changes the demand history.", "Confirm whether omitted periods should be recorded as zero.", metric={"coverage_pct": metrics_by_sku[sku]["coverage_pct"], "gap_count": len(missing)}))
        if zeros and zero_share < thresholds["suspect_zero_max_zero_share_pct"] and adi < thresholds["suspect_zero_max_adi"]:
            periods = [str(values[index]["date"]) for index in zeros]
            findings_by_sku[sku].append(_finding("SUSPECT_ZERO", sku, f"Recorded zero demand appears inside an otherwise continuous series.", "The zero may represent a stockout or missed posting and may understate true demand.", "Check stock availability and source postings for the affected period.", periods=periods, metric={"zero_share_pct": round(zero_share, 4), "adi": round(adi, 6)}))
        outliers = _outlier_periods(values, thresholds)
        if outliers:
            outlier_detail = (
                "1 period is a robust outlier candidate."
                if len(outliers) == 1
                else f"{len(outliers)} periods are robust outlier candidates."
            )
            findings_by_sku[sku].append(_finding("OUTLIER_CANDIDATE", sku, outlier_detail, "A promotion, tender, stock build or data error may have changed the observed demand.", "Review the affected periods. No values have been removed or corrected.", periods=outliers, metric={"method": "modified_z_with_seasonal_adjustment"}))
        shift = None if metrics_by_sku[sku]["coverage_pct"] < thresholds["sparse_coverage_pct"] else _level_shift(values, thresholds)
        if shift:
            shift_period, ratio = shift
            findings_by_sku[sku].append(_finding("LEVEL_SHIFT", sku, f"Demand changes to a sustained level near {shift_period} at {ratio:.2f} times the earlier median.", "History before the shift may not represent the current business level.", "Confirm whether a customer, tender, site or market change occurred.", periods=[shift_period], metric={"ratio": round(ratio, 4)}))
        span = expected
        if span < thresholds["history_short_periods"]:
            findings_by_sku[sku].append(_finding("HISTORY_TOO_SHORT", sku, f"The supplied history spans {span} periods.", "There is limited evidence for back-testing and stable conclusions.", "Treat the result as early evidence and add history as it becomes available.", metric={"span_periods": span}))
        if common_last[1] <= len(grouped) / 2 or last.isoformat() != common_last[0]:
            relative_trailing = _month_distance(last, latest_period) if grain == "month" else _period_position(latest_period, grain) - _period_position(last, grain)
            if relative_trailing >= thresholds["series_discontinued_trailing_periods"]:
                findings_by_sku[sku].append(_finding("SERIES_DISCONTINUED", sku, f"The series ends {relative_trailing} periods before the portfolio cut-off.", "The history is sound, but the line appears discontinued or dormant and should not support forward-looking claims without confirmation.", "Confirm whether the item remains active.", metric={"trailing_periods": relative_trailing}))
            elif relative_trailing >= thresholds["series_stale_trailing_periods"]:
                findings_by_sku[sku].append(_finding("SERIES_STALE", sku, f"The series ends {relative_trailing} periods before the portfolio cut-off.", "Recent demand may be missing for this item.", "Confirm whether later demand records are available.", metric={"trailing_periods": relative_trailing}))

    ranked = sorted(metrics_by_sku.values(), key=lambda item: (-item["volume_total"], item["sku"]))
    cumulative = 0.0
    long_tail: list[dict[str, Any]] = []
    for rank, metrics in enumerate(ranked, start=1):
        share = 100 * metrics["volume_total"] / portfolio_volume if portfolio_volume else 0
        metrics["volume_share_pct"] = round(share, 6)
        metrics["rank_by_volume"] = rank
        before = cumulative
        cumulative += share
        metrics["cumulative_volume_share_pct"] = round(cumulative, 6)
        if before >= thresholds["long_tail_cumulative_pct"]:
            long_tail.append(metrics)
        if share < thresholds["volume_immaterial_share_pct"]:
            findings_by_sku[metrics["sku"]].append(_finding("VOLUME_IMMATERIAL", metrics["sku"], f"The SKU represents {share:.2f}% of portfolio volume.", "The data may be clean while the line is immaterial to the portfolio conclusion.", "Keep the line visible but direct management attention by materiality.", metric={"volume_share_pct": round(share, 6)}))
    if long_tail:
        combined = sum(item["volume_share_pct"] for item in long_tail)
        names = [item["sku"] for item in long_tail]
        portfolio_findings.append(QualityFinding("LONG_TAIL_CONCENTRATION", "portfolio", f"{len(names)} SKUs beyond the {thresholds['long_tail_cumulative_pct']:.0f}% cumulative line carry {combined:.2f}% of volume between them.", "The portfolio is concentrated, so review effort should follow volume as well as SKU count.", "Prioritise material exceptions first and retain the long tail as a footnote.", periods=(), metric={"skus": names, "combined_volume_share_pct": round(combined, 6)}))

    not_usable_codes = {"coverage": thresholds["coverage_not_usable_pct"], "span": thresholds["history_not_usable_periods"]}
    for metrics in ranked:
        sku = metrics["sku"]
        limiting = [finding for finding in findings_by_sku[sku] if finding.code != "VOLUME_IMMATERIAL"]
        resolvable: bool | None = None
        if metrics["periods_expected_in_span"] < not_usable_codes["span"]:
            band, resolvable = "not_usable", False
        elif metrics["coverage_pct"] < not_usable_codes["coverage"]:
            band, resolvable = "not_usable", True
        elif metrics["trailing_gap_periods"] >= 12:
            band, resolvable = "not_usable", True
        elif limiting:
            band = "caveated"
        else:
            band = "clean"
        metrics["band"] = band
        metrics["resolvable"] = resolvable
        metrics["findings"] = [finding.to_dict() for finding in findings_by_sku[sku]]

    total_skus = len(ranked)
    flagged = [item for item in ranked if item["findings"]]
    nonclean = [item for item in ranked if item["band"] != "clean"]
    not_usable_volume = sum(item["volume_share_pct"] for item in ranked if item["band"] == "not_usable")
    nonclean_volume = sum(item["volume_share_pct"] for item in nonclean)
    if not_usable_volume >= thresholds["portfolio_not_usable_volume_pct"]:
        portfolio_band = "not_usable"
    elif nonclean_volume >= thresholds["portfolio_caveated_volume_pct"] or portfolio_findings:
        portfolio_band = "caveated"
    else:
        portfolio_band = "clean"
    flagged_sku_share = 100 * len(flagged) / total_skus if total_skus else 0
    flagged_volume_share = sum(item["volume_share_pct"] for item in flagged)
    clean_volume_share = sum(item["volume_share_pct"] for item in ranked if item["band"] == "clean")
    exceptions = []
    for item in ranked:
        if item["band"] == "clean":
            continue
        exceptions.append({"sku": item["sku"], "band": item["band"], "resolvable": item["resolvable"], "volume_share_pct": item["volume_share_pct"], "findings": item["findings"]})
    transformations = [finding.to_dict() for finding in validation.findings if finding.auto_applied]
    report = {
        "schema_version": "1.2",
        "source": {"dataset_sha256": validation.run_record["dataset_sha256"], "validation_schema_version": validation.run_record["schema_version"], "validation_verdict": validation.verdict},
        "context": {**options.to_dict(), "grain": grain, "grain_evidence": grain_evidence, "thresholds": thresholds},
        "headline": {"skus_analysed": total_skus, "first_period": min(item["first_period"] for item in ranked), "last_period": max(item["last_period"] for item in ranked), "clean_volume_share_pct": round(clean_volume_share, 4)},
        "portfolio": {"band": portfolio_band, "portfolio_volume": round(portfolio_volume, 6), "flagged_sku_count": len(flagged), "flagged_sku_share_pct": round(flagged_sku_share, 4), "flagged_volume_share_pct": round(flagged_volume_share, 4), "nonclean_volume_share_pct": round(nonclean_volume, 4), "findings": [finding.to_dict() for finding in portfolio_findings]},
        "skus": ranked,
        "exceptions": exceptions,
        "transformations": transformations,
        "method_note": {"adi_and_cv_squared_are_metrics_not_classes": True, "outliers_are_candidates_not_corrections": True, "missing_periods_are_not_zero_filled": True},
    }
    return QualityResult(report)
