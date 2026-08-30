import json
import unittest
from unittest.mock import patch
from copy import deepcopy
from datetime import date
from pathlib import Path

from quality_engine import DEFAULT_THRESHOLDS, QualityOptions, assess_quality
from run_bundle import (
    BundleError,
    build_bundle,
    bundle_hash,
    compare_reproduction,
    quality_bundle_result,
    reopen_bundle,
    validation_bundle_result,
)
from run_manifest import build_manifest, content_fingerprint, exact_manifest_hash, quality_stage, source_record, validation_stage
from validator import ValidationOptions, validate_csv
from tests.generate_run_bundle_goldens import assert_independent_quality_target


FIXTURES = Path(__file__).parent / "quality_fixtures"
ENVIRONMENT = {
    "app_version": "1.4",
    "git_commit": "abcdef1",
    "runtime": "python 3.12.4",
    "key_libraries": {"google-cloud-bigquery": "3.38.0"},
    "region": "europe-west2",
}


def make_quality_bundle():
    raw = (FIXTURES / "20_portfolio_mixed.csv").read_bytes()
    validation = validate_csv(raw, ValidationOptions(as_of_date=date(2026, 8, 1)))
    source = source_record(raw, "20_portfolio_mixed.csv", "2026-08-30T09:00:00Z", validation.metadata)
    validation_record = validation_stage(validation, source, "2026-08-30T09:00:00Z", "2026-08-30T09:00:01Z")
    quality = assess_quality(validation, QualityOptions(
        as_of_date=date(2026, 8, 1), as_of_date_source="user_supplied", thresholds=dict(DEFAULT_THRESHOLDS)
    )).to_dict()
    quality_record = quality_stage(quality, validation_record["output_ref"], "2026-08-30T09:00:01Z", "2026-08-30T09:00:02Z")
    manifest = build_manifest(
        source, [validation_record, quality_record], date(2026, 8, 1), "user",
        [row["sku"] for row in validation.normalised_rows],
        created_at="2026-08-30T09:00:03Z", environment=deepcopy(ENVIRONMENT),
    )
    return build_bundle(manifest, {
        "validation": validation_bundle_result(validation, validation_record),
        "quality": quality_bundle_result(quality),
    }, "20_portfolio_mixed.csv")


class RunBundleTests(unittest.TestCase):
    def test_quality_bundle_is_valid_and_reopenable(self):
        bundle = make_quality_bundle()
        reopened = reopen_bundle(json.dumps(bundle).encode())
        self.assertEqual(reopened, bundle)
        self.assertEqual(set(bundle["results"]), {"validation", "quality"})
        self.assertEqual(len(bundle["results"]["quality"]["per_sku"]), 12)
        self.assertEqual(bundle["integrity"]["bundle_sha256"], bundle_hash(bundle))

    def test_reopen_never_calls_an_engine(self):
        bundle = make_quality_bundle()
        with patch("validator.validate_csv", side_effect=AssertionError("validator called")), patch(
            "quality_engine.assess_quality", side_effect=AssertionError("quality engine called")
        ):
            reopened = reopen_bundle(json.dumps(bundle).encode())
        self.assertEqual(reopened, bundle)

    def test_checked_at_does_not_change_forecast_model_identity(self):
        from run_bundle import _comparable_model_identity

        first = {"family": "TimesFM", "reference_check": {"status": "match", "checked_at": "2026-08-30T09:00:00Z"}}
        second = {"family": "TimesFM", "reference_check": {"status": "match", "checked_at": "2026-08-31T09:00:00Z"}}
        self.assertEqual(_comparable_model_identity(first), _comparable_model_identity(second))

    def test_generated_golden_matches_real_engine_output(self):
        golden_path = Path(__file__).parent / "run_bundle_fixtures" / "run_bundle.golden.json"
        golden = reopen_bundle(golden_path.read_bytes())
        actual = make_quality_bundle()
        self.assertEqual(golden["results"], actual["results"])
        self.assertEqual(golden["manifest"]["stages"], actual["manifest"]["stages"])

    def test_generated_golden_matches_independent_quality_expectations(self):
        golden_path = Path(__file__).parent / "run_bundle_fixtures" / "run_bundle.golden.json"
        expected_path = FIXTURES / "expected_quality.json"
        golden = reopen_bundle(golden_path.read_bytes())
        quality = golden["results"]["quality"]
        report = {
            "headline": quality["headline"],
            "portfolio": {
                "band": quality["portfolio_band"],
                "findings": [],
            },
            "skus": list(quality["per_sku"].values()),
        }
        expected = json.loads(expected_path.read_text(encoding="utf-8"))
        assert_independent_quality_target(report, expected)

    def test_single_altered_field_is_refused(self):
        bundle = make_quality_bundle()
        bundle["results"]["quality"]["headline"]["skus_analysed"] = 13
        with self.assertRaises(BundleError):
            reopen_bundle(json.dumps(bundle).encode())

    def test_swapped_manifest_is_refused(self):
        bundle = make_quality_bundle()
        bundle["manifest"]["run_id"] = "run_" + "f" * 32
        bundle["manifest"]["integrity"]["manifest_sha256"] = exact_manifest_hash(bundle["manifest"])
        bundle["integrity"]["bundle_sha256"] = bundle_hash(bundle)
        with self.assertRaises(BundleError):
            reopen_bundle(json.dumps(bundle).encode())

    def test_unknown_bundle_version_is_refused(self):
        bundle = make_quality_bundle()
        bundle["bundle_schema_version"] = "2.0"
        bundle["integrity"]["bundle_sha256"] = bundle_hash(bundle)
        with self.assertRaises(BundleError):
            reopen_bundle(json.dumps(bundle).encode())

    def test_reproduction_matches_quality_run(self):
        first = make_quality_bundle()
        second = deepcopy(first)
        second["manifest"]["run_id"] = "run_" + "b" * 32
        second["manifest"]["created_at"] = "2026-08-30T10:00:00Z"
        second["manifest"]["environment"]["app_version"] = "1.4.1"
        second["manifest"]["environment"]["git_commit"] = "bcdefa2"
        second["manifest"]["integrity"]["content_fingerprint_sha256"] = content_fingerprint(second["manifest"])
        second["manifest"]["integrity"]["manifest_sha256"] = exact_manifest_hash(second["manifest"])
        second["integrity"]["manifest_sha256"] = second["manifest"]["integrity"]["manifest_sha256"]
        second["integrity"]["content_fingerprint_sha256"] = second["manifest"]["integrity"]["content_fingerprint_sha256"]
        second["integrity"]["bundle_sha256"] = bundle_hash(second)
        result = compare_reproduction(first, second)
        self.assertEqual(result["outcome"], "reproduced")
        self.assertEqual(result["exact_stages"], ["validation", "quality"])

    def test_engine_change_is_not_comparable(self):
        first = make_quality_bundle()
        second = deepcopy(first)
        second["manifest"]["stages"][1]["engine_version"] = "1.1.0"
        second["manifest"]["integrity"]["content_fingerprint_sha256"] = content_fingerprint(second["manifest"])
        second["manifest"]["integrity"]["manifest_sha256"] = exact_manifest_hash(second["manifest"])
        second["integrity"]["manifest_sha256"] = second["manifest"]["integrity"]["manifest_sha256"]
        second["integrity"]["content_fingerprint_sha256"] = second["manifest"]["integrity"]["content_fingerprint_sha256"]
        second["integrity"]["bundle_sha256"] = bundle_hash(second)
        result = compare_reproduction(first, second)
        self.assertEqual(result["outcome"], "not_comparable")
        self.assertIn("quality engine version differs", result["differences"])


if __name__ == "__main__":
    unittest.main()
