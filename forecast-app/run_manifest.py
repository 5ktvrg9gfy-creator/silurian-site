from __future__ import annotations

import hashlib
import json
import os
import platform
import re
import subprocess
from copy import deepcopy
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import median
from typing import Any, Iterable

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError


SCHEMA_VERSION = "1.2"
PLACEHOLDERS = {"REPLACE_WITH_ACTUAL", "SUPPLIED_BY_DEPLOYMENT", "0000000"}
MANAGED_SENTINEL = "provider_managed_not_exposed"
SCHEMA = json.loads((Path(__file__).with_name("run_manifest.schema.json")).read_text(encoding="utf-8"))


class ManifestError(RuntimeError):
    pass


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_json(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def artefact_ref(kind: str, payload: Any, *, rows: int | None = None, series: int | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {"type": kind, "sha256": sha256_json(payload)}
    if rows is not None:
        result["rows"] = rows
    if series is not None:
        result["series"] = series
    return result


def source_record(raw: bytes, filename: str, received_at: str, metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "filename": Path(filename or "uploaded.csv").name,
        "bytes": len(raw),
        "sha256": sha256_bytes(raw),
        "rows_raw": int(metadata.get("parsed_rows", metadata.get("source_physical_lines", 1) - 1)),
        "encoding_detected": metadata.get("encoding", "unknown"),
        "delimiter_detected": metadata.get("delimiter", "unknown"),
        "received_at": received_at,
    }


def _git_commit() -> str:
    supplied = os.getenv("VERCEL_GIT_COMMIT_SHA", "").strip().lower()
    if re.fullmatch(r"[0-9a-f]{7,40}", supplied):
        return supplied
    try:
        value = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL, text=True, timeout=2
        ).strip().lower()
        if re.fullmatch(r"[0-9a-f]{7,40}", value):
            return value
    except (OSError, subprocess.SubprocessError):
        pass
    raise ManifestError("The deployment Git commit is unavailable")


def environment_record() -> dict[str, Any]:
    app_version = os.getenv("APP_VERSION", "0.1.0").strip()
    region = os.getenv("BIGQUERY_LOCATION", "europe-west2").strip()
    if not app_version or not region:
        raise ManifestError("Application version and processing region must be configured")
    return {
        "app_version": app_version,
        "git_commit": _git_commit(),
        "runtime": f"python {platform.python_version()}",
        "key_libraries": {
            "google-cloud-bigquery": os.getenv("BIGQUERY_LIBRARY_VERSION", "3.38.0"),
        },
        "region": region,
    }


def validation_stage(validation: Any, source: dict[str, Any], started_at: str, completed_at: str) -> dict[str, Any]:
    canonical_rows = [] if validation.verdict == "reject" else [dict(row) for row in validation.normalised_rows]
    series_count = 0 if validation.verdict == "reject" else len({str(row.get("sku")) for row in validation.normalised_rows})
    normalised = artefact_ref(
        "normalised_dataset",
        canonical_rows,
        rows=len(canonical_rows),
        series=series_count,
    )
    manifest_findings = [
        finding for finding in validation.findings
        if not (validation.verdict == "reject" and (finding.stage == "series" or finding.code.startswith("GRAIN_")))
    ]
    findings = [finding.to_dict() for finding in manifest_findings]
    finding_codes = list(dict.fromkeys(item["code"] for item in findings))
    blocking_codes = {item["code"] for item in findings if item["severity"] == "blocking"}
    transformations = [
        {"code": finding.code, "count": finding.count, "reversible": finding.reversible}
        for finding in validation.findings if finding.auto_applied
    ]
    outcome = {
        "verdict": validation.verdict,
        "findings": len(finding_codes),
        "blocking": len(blocking_codes),
        "rows_in": source["rows_raw"],
        "rows_out": len(canonical_rows),
    }
    if canonical_rows:
        outcome["series"] = normalised["series"]
    return {
        "stage": "validation",
        "story": "1.1",
        "engine_version": "1.0.0",
        "started_at": started_at,
        "completed_at": completed_at,
        "duration_ms": _duration_ms(started_at, completed_at),
        "input_ref": {"type": "source_file", "sha256": source["sha256"], "rows": source["rows_raw"]},
        "output_ref": normalised,
        "options": deepcopy(validation.run_record["options"]),
        "passes": [{
            "pass": 1,
            "verdict": validation.verdict,
            "options_supplied": {},
            "finding_codes": finding_codes,
        }],
        "transformations": transformations,
        "outcome": outcome,
    }


def quality_stage(report: dict[str, Any], input_ref: dict[str, Any], started_at: str, completed_at: str) -> dict[str, Any]:
    safe_result = _strip_client_data(report)
    return {
        "stage": "quality",
        "story": "1.2",
        "engine_version": "1.0.0",
        "started_at": started_at,
        "completed_at": completed_at,
        "duration_ms": _duration_ms(started_at, completed_at),
        "input_ref": deepcopy(input_ref),
        "output_ref": artefact_ref("quality_result", safe_result, series=report["headline"]["skus_analysed"]),
        "options": deepcopy(report["context"]),
        "outcome": {
            "band": report["portfolio"]["band"],
            "series": report["headline"]["skus_analysed"],
            "flagged_series": report["portfolio"]["flagged_sku_count"],
            "finding_codes": sorted({item["code"] for item in report["portfolio"]["findings"]}),
        },
    }


def model_identity(
    histories: Iterable[Iterable[float]], horizon: int, reference_check: dict[str, Any],
    *, included: int, excluded: int = 0, exclusion_reasons: dict[str, int] | None = None,
    family: str = "TimesFM", version: str = "2.5", provider: str = "BigQuery AI.FORECAST",
    checkpoint: str = MANAGED_SENTINEL, backend: str = MANAGED_SENTINEL,
    precision: str = MANAGED_SENTINEL, provider_limitations: list[str] | None = None,
) -> dict[str, Any]:
    lengths = sorted(len(list(values)) for values in histories)
    if not lengths:
        raise ManifestError("At least one forecast series is required")
    return {
        "family": family,
        "version": version,
        "provider": provider,
        "checkpoint": checkpoint,
        "context_window_requested": 512,
        "context_points_supplied": {"min": min(lengths), "median": median(lengths), "max": max(lengths)},
        "horizon": horizon,
        "confidence_level": 0.9,
        "interval_bounds": [0.05, 0.95],
        "backend": backend,
        "precision": precision,
        "preprocessing": {"negative_forecasts_clipped_to_zero": True},
        "provider_limitations": provider_limitations if provider_limitations is not None else [
            "The managed service does not expose the weights revision, backend or numerical precision.",
            "The friendly model version may remain unchanged when Google updates the managed model.",
        ],
        "reference_check": deepcopy(reference_check),
        "series_included": included,
        "series_excluded": excluded,
        "exclusion_reasons": exclusion_reasons or {},
    }


def forecast_stage(
    safe_result: dict[str, Any], input_ref: dict[str, Any], model: dict[str, Any], determinism: dict[str, Any],
    started_at: str, completed_at: str,
) -> dict[str, Any]:
    return {
        "stage": "forecast",
        "story": "1.3",
        "engine_version": "1.0.0",
        "started_at": started_at,
        "completed_at": completed_at,
        "duration_ms": _duration_ms(started_at, completed_at),
        "input_ref": deepcopy(input_ref),
        "output_ref": artefact_ref("forecast_result", _strip_client_data(safe_result), series=model["series_included"]),
        "options": {
            "horizon": model["horizon"],
            "confidence_level": 0.9,
            "context_window": 512,
            "context_window_source": "pinned_by_silurian",
            "provider": "bigquery_timesfm" if model["provider"] == "BigQuery AI.FORECAST" else model["provider"],
            "bigquery_use_query_cache": False,
        },
        "model": deepcopy(model),
        "determinism": deepcopy(determinism),
        "outcome": {"series_forecast": model["series_included"], "series_excluded": model["series_excluded"]},
    }


def build_manifest(
    source: dict[str, Any], stages: list[dict[str, Any]], as_of_date: date, as_of_source: str,
    source_skus: Iterable[str], *, created_at: str | None = None, environment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    created = created_at or utc_now()
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "run_id": "run_" + sha256_bytes(f"{source['sha256']}:{created}".encode())[:32],
        "created_at": created,
        "as_of_date": as_of_date.isoformat(),
        "as_of_source": as_of_source,
        "source": deepcopy(source),
        "stages": deepcopy(stages),
        "environment": environment or environment_record(),
        "reproducibility": _reproducibility(stages),
        "integrity": {"manifest_sha256": "", "content_fingerprint_sha256": "", "chain_verified": False},
    }
    verify_dependency_graph(manifest)
    manifest["integrity"]["chain_verified"] = True
    _assert_no_client_data(manifest, source_skus)
    _assert_no_placeholders(manifest)
    manifest["integrity"]["content_fingerprint_sha256"] = content_fingerprint(manifest)
    manifest["integrity"]["manifest_sha256"] = exact_manifest_hash(manifest)
    try:
        Draft202012Validator(SCHEMA).validate(manifest)
    except ValidationError as exc:
        raise ManifestError(f"Run manifest failed schema validation: {exc.message}") from exc
    return manifest


def exact_manifest_hash(manifest: dict[str, Any]) -> str:
    value = deepcopy(manifest)
    value["integrity"]["manifest_sha256"] = ""
    return sha256_json(value)


def content_fingerprint(manifest: dict[str, Any]) -> str:
    value = deepcopy(manifest)
    value["integrity"]["manifest_sha256"] = ""
    value["integrity"]["content_fingerprint_sha256"] = ""
    value.pop("run_id", None)
    value.pop("created_at", None)
    value["source"].pop("received_at", None)
    value["source"].pop("filename", None)
    environment = value.get("environment", {})
    value["environment"] = {
        "key_libraries": deepcopy(environment.get("key_libraries", {})),
        "region": environment.get("region"),
    }
    for stage in value["stages"]:
        for key in ("started_at", "completed_at", "duration_ms"):
            stage.pop(key, None)
        reference = stage.get("model", {}).get("reference_check")
        if isinstance(reference, dict):
            reference.pop("checked_at", None)
    return sha256_json(value)


def verify_dependency_graph(manifest: dict[str, Any]) -> None:
    available = {("source_file", manifest["source"]["sha256"])}
    for stage in manifest["stages"]:
        reference = (stage["input_ref"]["type"], stage["input_ref"]["sha256"])
        if reference not in available:
            raise ManifestError(f"Unresolved input reference for {stage['stage']}")
        output = stage["output_ref"]
        available.add((output["type"], output["sha256"]))


def reference_check(reference_series: list[float], output: list[float], baseline_sha256: str, checked_at: str | None = None) -> dict[str, Any]:
    series_hash = sha256_json(reference_series)
    output_hash = sha256_json(output)
    return {
        "reference_series_sha256": series_hash,
        "reference_output_sha256": output_hash,
        "baseline_output_sha256": baseline_sha256,
        "status": "match" if output_hash == baseline_sha256 else "drift_detected",
        "checked_at": checked_at or utc_now(),
    }


def _reproducibility(stages: list[dict[str, Any]]) -> dict[str, Any]:
    names = [stage["stage"] for stage in stages]
    deterministic = [name for name in names if name in {"validation", "quality"}]
    forecast = next((stage for stage in stages if stage["stage"] == "forecast"), None)
    non_deterministic = [] if not forecast or forecast["determinism"]["class"] == "bitwise" else ["forecast"]
    statement = "Validation and quality are bitwise reproducible." if "quality" in names else "Validation is bitwise reproducible."
    if forecast:
        statement += " " + forecast["determinism"]["statement"]
    elif stages[-1]["outcome"].get("verdict") == "reject":
        statement += " No quality or forecast stage ran because the file was rejected."
    return {"deterministic_stages": deterministic, "non_deterministic_stages": non_deterministic, "statement": statement}


def _assert_no_client_data(manifest: dict[str, Any], source_skus: Iterable[str]) -> None:
    value = deepcopy(manifest)
    value["source"]["filename"] = ""
    serialised = canonical_json(value)
    for sku in {str(value).strip() for value in source_skus if str(value).strip()}:
        if sku in serialised:
            raise ManifestError("The manifest contains a source SKU identifier")


def _assert_no_placeholders(manifest: dict[str, Any]) -> None:
    serialised = canonical_json(manifest)
    if any(value in serialised for value in PLACEHOLDERS):
        raise ManifestError("The manifest contains unresolved deployment metadata")


def _strip_client_data(value: Any) -> Any:
    prohibited = {"sku", "description", "customer", "site", "demand", "values", "periods"}
    if isinstance(value, dict):
        return {key: _strip_client_data(item) for key, item in value.items() if key.lower() not in prohibited}
    if isinstance(value, list):
        return [_strip_client_data(item) for item in value]
    return value


def _duration_ms(started_at: str, completed_at: str) -> int:
    def parse(value: str) -> datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return max(0, round((parse(completed_at) - parse(started_at)).total_seconds() * 1000))
