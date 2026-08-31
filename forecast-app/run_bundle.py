from __future__ import annotations

import json
from datetime import date
from copy import deepcopy
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

from run_manifest import SCHEMA as MANIFEST_SCHEMA
from run_manifest import canonical_json, exact_manifest_hash, sha256_json, utc_now


BUNDLE_SCHEMA_VERSION = "1.0"
BUNDLE_SCHEMA = json.loads(Path(__file__).with_name("run_bundle.schema.json").read_text(encoding="utf-8"))
CONFIDENTIALITY_STATEMENT = (
    "CONFIDENTIAL: this bundle contains client data. It belongs to the client and must not be shared like a run manifest."
)


class BundleError(RuntimeError):
    pass


def _normalise_json_numbers(value: Any) -> Any:
    """Keep integrity stable when a browser serialises 95.0 as 95."""
    if isinstance(value, dict):
        return {key: _normalise_json_numbers(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_normalise_json_numbers(item) for item in value]
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def bundle_hash(bundle: dict[str, Any]) -> str:
    value = deepcopy(bundle)
    value["integrity"]["bundle_sha256"] = ""
    return sha256_json(_normalise_json_numbers(value))


def build_bundle(
    manifest: dict[str, Any], results: dict[str, Any], source_filename: str,
    *, reproduction: dict[str, Any] | None = None,
) -> dict[str, Any]:
    stage_names = [stage["stage"] for stage in manifest["stages"]]
    if set(results) != set(stage_names):
        raise BundleError("Bundle results must contain exactly the stages recorded in the manifest")
    bundle: dict[str, Any] = {
        "bundle_schema_version": BUNDLE_SCHEMA_VERSION,
        "confidentiality": {
            "contains_client_data": True,
            "statement": CONFIDENTIALITY_STATEMENT,
            "source_filename": Path(source_filename or "uploaded.csv").name,
        },
        "manifest": json.loads(canonical_json(manifest)),
        "results": json.loads(canonical_json(results)),
        "integrity": {
            "bundle_sha256": "",
            "manifest_sha256": manifest["integrity"]["manifest_sha256"],
            "content_fingerprint_sha256": manifest["integrity"]["content_fingerprint_sha256"],
        },
    }
    if reproduction is not None:
        bundle["reproduction"] = deepcopy(reproduction)
    bundle["integrity"]["bundle_sha256"] = bundle_hash(bundle)
    verify_bundle(bundle)
    return bundle


def validation_bundle_result(validation: Any, manifest_stage: dict[str, Any]) -> dict[str, Any]:
    return {
        "verdict": validation.verdict,
        "passes": deepcopy(manifest_stage["passes"]),
        "findings": [finding.to_dict() for finding in validation.findings],
        "transformations": deepcopy(manifest_stage["transformations"]),
        "row_counts": {
            "rows_in": manifest_stage["outcome"]["rows_in"],
            "rows_out": manifest_stage["outcome"]["rows_out"],
        },
    }


def quality_bundle_result(report: dict[str, Any]) -> dict[str, Any]:
    findings = deepcopy(report["portfolio"].get("findings", []))
    records = {str(record["sku"]): record for record in report.get("skus", [])}
    for sku, record in records.items():
        for finding in record.get("findings", []):
            item = deepcopy(finding)
            item.setdefault("sku", sku)
            findings.append(item)
    headline = deepcopy(report["headline"])
    headline.update({
        "grain": report["context"]["grain"],
        "flagged_sku_share_pct": report["portfolio"]["flagged_sku_share_pct"],
        "flagged_volume_share_pct": report["portfolio"]["flagged_volume_share_pct"],
    })
    return {
        "portfolio_band": report["portfolio"]["band"],
        "headline": headline,
        "per_sku": deepcopy(records),
        "findings": findings,
        "exceptions": deepcopy(report.get("exceptions", [])),
        "method_note": (
            "Metrics are descriptive. ADI and CV squared are reported as facts and are not classifications. "
            "CV squared uses the population estimator and is null below three non-zero observations. "
            "Outliers are candidates, never corrections. Missing periods were not filled with zero, and no supplied value was altered."
        ),
    }


def _next_month(value: date) -> date:
    return date(value.year + (1 if value.month == 12 else 0), 1 if value.month == 12 else value.month + 1, 1)


def forecast_bundle_result(result: dict[str, Any]) -> dict[str, Any]:
    rows = result.get("results") if isinstance(result.get("results"), list) else [result]
    series: dict[str, Any] = {}
    for row in rows:
        current = date.fromisoformat(row["history_dates"][-1])
        points = []
        for forecast, bounds in zip(row["forecast"], row["ranges"]):
            current = _next_month(current)
            points.append({
                "period": current.isoformat(),
                "forecast": float(forecast),
                "lower": float(bounds["lower"]),
                "upper": float(bounds["upper"]),
            })
        series[str(row["sku"])] = {"points": points}
    horizon = int(rows[0]["horizon"]) if rows else 0
    return {"horizon": horizon, "series": series, "excluded_series": {}}


def verify_bundle(bundle: dict[str, Any]) -> None:
    if bundle.get("bundle_schema_version") != BUNDLE_SCHEMA_VERSION:
        raise BundleError("This run bundle version is not supported")
    try:
        Draft202012Validator(BUNDLE_SCHEMA).validate(bundle)
        Draft202012Validator(MANIFEST_SCHEMA).validate(bundle["manifest"])
    except ValidationError as exc:
        raise BundleError(f"Run bundle failed schema validation: {exc.message}") from exc
    manifest = bundle["manifest"]
    if exact_manifest_hash(manifest) != manifest["integrity"]["manifest_sha256"]:
        raise BundleError("The embedded run manifest failed its integrity check")
    if bundle["integrity"]["manifest_sha256"] != manifest["integrity"]["manifest_sha256"]:
        raise BundleError("The run manifest in this bundle was swapped or altered")
    if bundle["integrity"]["content_fingerprint_sha256"] != manifest["integrity"]["content_fingerprint_sha256"]:
        raise BundleError("The copied content fingerprint does not match the embedded manifest")
    if bundle_hash(bundle) != bundle["integrity"]["bundle_sha256"]:
        raise BundleError("The run bundle failed its integrity check")
    if set(bundle["results"]) != {stage["stage"] for stage in manifest["stages"]}:
        raise BundleError("The recorded results do not match the stages that ran")


def reopen_bundle(raw: bytes) -> dict[str, Any]:
    try:
        bundle = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise BundleError("The selected file is not a readable Silurian run bundle") from exc
    verify_bundle(bundle)
    return deepcopy(bundle)


def _stage_map(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {stage["stage"]: stage for stage in manifest["stages"]}


def _forecast_values(bundle: dict[str, Any]) -> list[float]:
    forecast = bundle["results"].get("forecast", {})
    values: list[float] = []
    for sku in sorted(forecast.get("series", {})):
        values.extend(float(point["forecast"]) for point in forecast["series"][sku].get("points", []))
    return values


def _comparable_model_identity(model: dict[str, Any]) -> dict[str, Any]:
    """Return only model identity that can affect an output.

    The canary timestamp records when the check ran. It is evidence, not model
    identity, so including it would make every later reproduction incomparable.
    """
    value = deepcopy(model)
    reference = value.get("reference_check")
    if isinstance(reference, dict):
        reference.pop("checked_at", None)
    return value


def compare_reproduction(original: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    verify_bundle(original)
    verify_bundle(candidate)
    original_stages = _stage_map(original["manifest"])
    candidate_stages = _stage_map(candidate["manifest"])
    differences: list[str] = []
    if original["manifest"]["source"]["sha256"] != candidate["manifest"]["source"]["sha256"]:
        differences.append("Source file content differs")
    if list(original_stages) != list(candidate_stages):
        differences.append("Stages executed differ")
    for name in sorted(set(original_stages).intersection(candidate_stages)):
        left, right = original_stages[name], candidate_stages[name]
        if left["engine_version"] != right["engine_version"]:
            differences.append(f"{name} engine version differs")
        if left["options"] != right["options"]:
            differences.append(f"{name} effective options differ")
        if name == "forecast" and _comparable_model_identity(left.get("model", {})) != _comparable_model_identity(right.get("model", {})):
            differences.append("forecast model identity differs")
    left_env, right_env = original["manifest"]["environment"], candidate["manifest"]["environment"]
    for key in ("key_libraries", "region"):
        if left_env.get(key) != right_env.get(key):
            differences.append(f"calculation environment {key} differs")
    base = {
        "attempted_at": utc_now(),
        "compared_fingerprint": candidate["integrity"]["content_fingerprint_sha256"],
        "exact_stages": [],
        "tolerant_stages": [],
        "max_pct_diff": None,
        "differences": differences,
    }
    if differences:
        return {**base, "outcome": "not_comparable"}
    for name in ("validation", "quality"):
        if name in original_stages:
            if original_stages[name]["output_ref"]["sha256"] != candidate_stages[name]["output_ref"]["sha256"]:
                return {**base, "outcome": "differs", "differences": [f"{name} result differs"]}
            base["exact_stages"].append(name)
    if "forecast" not in original_stages:
        return {**base, "outcome": "reproduced"}
    left_forecast, right_forecast = original_stages["forecast"], candidate_stages["forecast"]
    determinism = left_forecast.get("determinism", {})
    if determinism.get("class") == "unknown":
        return {
            **base,
            "outcome": "not_comparable",
            "differences": ["Forecast stage cannot be verified because reproducibility is unknown"],
        }
    if left_forecast["output_ref"]["sha256"] == right_forecast["output_ref"]["sha256"]:
        base["exact_stages"].append("forecast")
        return {**base, "outcome": "reproduced"}
    expected, actual = _forecast_values(original), _forecast_values(candidate)
    if len(expected) != len(actual):
        return {**base, "outcome": "differs", "differences": ["Forecast point count differs"]}
    max_pct = 0.0
    for left, right in zip(expected, actual):
        if left:
            max_pct = max(max_pct, abs(right - left) / abs(left) * 100)
        elif right != left:
            return {**base, "outcome": "differs", "differences": ["Forecast differs where the recorded value is zero"]}
    base["max_pct_diff"] = max_pct
    tolerance = determinism.get("tolerance_pct")
    if tolerance is not None and max_pct <= float(tolerance):
        base["tolerant_stages"].append("forecast")
        return {**base, "outcome": "reproduced_within_tolerance"}
    return {**base, "outcome": "differs", "differences": ["Forecast exceeds the measured tolerance"]}


def confidential_filename(bundle: dict[str, Any]) -> str:
    return f"silurian-run-{bundle['manifest']['run_id'][-8:]}-CONFIDENTIAL.json"


def stable_bundle_json(bundle: dict[str, Any]) -> str:
    verify_bundle(bundle)
    return json.dumps(bundle, indent=2, ensure_ascii=False) + "\n"
