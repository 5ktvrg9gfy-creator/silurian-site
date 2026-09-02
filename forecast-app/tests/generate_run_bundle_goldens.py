import json
from copy import deepcopy
from datetime import date
from pathlib import Path

from classification_engine import classify_quality
from quality_engine import DEFAULT_THRESHOLDS, QualityOptions, assess_quality
from routing_engine import route_portfolio
from run_bundle import build_bundle, classification_bundle_result, quality_bundle_result, routing_bundle_result, stable_bundle_json, validation_bundle_result
from run_manifest import build_manifest, classification_stage, quality_stage, routing_stage, source_record, validation_stage
from validator import ValidationOptions, validate_csv


TESTS = Path(__file__).parent
QUALITY = TESTS / "quality_fixtures"
OUTPUT = TESTS / "run_bundle_fixtures"
ENVIRONMENT = {
    "app_version": "1.4.0",
    "git_commit": "16ffb72",
    "runtime": "python 3.12.4",
    "key_libraries": {"google-cloud-bigquery": "3.38.0"},
    "region": "europe-west2",
}


def assert_independent_quality_target(report: dict, expected: dict) -> None:
    target = expected["files"]["20_portfolio_mixed.csv"]
    tolerance = expected["tolerance"]
    actual = {record["sku"]: record for record in report["skus"]}
    if len(actual) != target["sku_count"]:
        raise AssertionError("SKU count differs from expected_quality.json")
    if report["portfolio"]["band"] != target["assertions"]["portfolio_band"]:
        raise AssertionError("Portfolio band differs from expected_quality.json")
    for sku, metrics in target["per_sku"].items():
        if sku not in actual:
            raise AssertionError(f"Missing expected SKU {sku}")
        for name, expected_value in metrics.items():
            actual_value = actual[sku][name]
            if isinstance(expected_value, (int, float)) and not isinstance(expected_value, bool):
                allowed = float(tolerance.get(name, 0))
                if abs(float(actual_value) - float(expected_value)) > allowed:
                    raise AssertionError(f"{sku} {name} differs: {actual_value} versus {expected_value}")
            elif actual_value != expected_value:
                raise AssertionError(f"{sku} {name} differs: {actual_value} versus {expected_value}")
        if actual[sku]["band"] != target["assertions"]["expected_bands"][sku]:
            raise AssertionError(f"{sku} band differs from expected_quality.json")
    for sku in target["assertions"]["must_flag"]:
        if not actual[sku]["findings"]:
            raise AssertionError(f"{sku} must carry a finding")
    for sku in target["assertions"]["must_not_flag"]:
        if actual[sku]["findings"]:
            raise AssertionError(f"{sku} must not carry a finding")


def main() -> None:
    raw = (QUALITY / "20_portfolio_mixed.csv").read_bytes()
    expected = json.loads((QUALITY / "expected_quality.json").read_text(encoding="utf-8"))
    validation = validate_csv(raw, ValidationOptions(as_of_date=date(2026, 8, 1)))
    source = source_record(raw, "20_portfolio_mixed.csv", "2026-08-30T09:00:00Z", validation.metadata)
    validation_record = validation_stage(validation, source, "2026-08-30T09:00:00Z", "2026-08-30T09:00:01Z")
    quality = assess_quality(validation, QualityOptions(
        as_of_date=date(2026, 8, 1),
        as_of_date_source="user_supplied",
        thresholds=dict(DEFAULT_THRESHOLDS),
    )).to_dict()
    assert_independent_quality_target(quality, expected)
    quality_record = quality_stage(quality, validation_record["output_ref"], "2026-08-30T09:00:01Z", "2026-08-30T09:00:02Z")
    classification = classify_quality(quality)
    classification_record = classification_stage(
        classification, quality_record["output_ref"], "2026-08-30T09:00:02Z", "2026-08-30T09:00:03Z"
    )
    routing = route_portfolio(quality, classification)
    routing_record = routing_stage(
        routing, classification_record["output_ref"], "2026-08-30T09:00:03Z", "2026-08-30T09:00:04Z"
    )
    manifest = build_manifest(
        source, [validation_record, quality_record, classification_record, routing_record], date(2026, 8, 1), "user",
        [row["sku"] for row in validation.normalised_rows],
        created_at="2026-08-30T09:00:04Z", environment=deepcopy(ENVIRONMENT),
    )
    bundle = build_bundle(manifest, {
        "validation": validation_bundle_result(validation, validation_record),
        "quality": quality_bundle_result(quality),
        "classification": classification_bundle_result(classification),
        "routing": routing_bundle_result(routing),
    }, "20_portfolio_mixed.csv")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "run_manifest.golden.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUTPUT / "run_bundle.golden.json").write_text(stable_bundle_json(bundle), encoding="utf-8")
    (OUTPUT / "run_bundle.schema.json").write_text(Path("run_bundle.schema.json").read_text(encoding="utf-8"), encoding="utf-8")


if __name__ == "__main__":
    main()
