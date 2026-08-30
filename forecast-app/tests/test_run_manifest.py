import json
import unittest
from copy import deepcopy
from datetime import date
from pathlib import Path

from jsonschema import Draft202012Validator

from run_manifest import (
    ManifestError,
    build_manifest,
    content_fingerprint,
    exact_manifest_hash,
    forecast_stage,
    model_identity,
    reference_check,
    source_record,
    validation_stage,
    verify_dependency_graph,
)
from validator import ValidationOptions, validate_csv


FIXTURES = Path(__file__).parent / "run_manifest_fixtures"
SCHEMA = json.loads((FIXTURES / "run_manifest.schema.json").read_text(encoding="utf-8"))
RUNTIME_SCHEMA = json.loads((Path(__file__).parents[1] / "run_manifest.schema.json").read_text(encoding="utf-8"))
ENVIRONMENT = {
    "app_version": "0.1.0",
    "git_commit": "5e37297",
    "runtime": "python 3.12.4",
    "key_libraries": {"google-cloud-bigquery": "3.38.0"},
    "region": "europe-west2",
}


def make_validation_manifest(filename: str, *, created_at: str = "2026-08-28T17:12:04Z"):
    raw = (FIXTURES / filename).read_bytes()
    validation = validate_csv(raw, ValidationOptions(as_of_date=date(2026, 8, 1)))
    source = source_record(raw, filename, "2026-08-28T17:12:01Z", validation.metadata)
    stage = validation_stage(validation, source, "2026-08-28T17:12:01Z", "2026-08-28T17:12:02Z")
    skus = [row.get("sku") for row in validation.normalised_rows]
    return build_manifest(
        source, [stage], date(2026, 8, 1), "user", skus,
        created_at=created_at, environment=deepcopy(ENVIRONMENT),
    )


class RunManifestTests(unittest.TestCase):
    def test_runtime_schema_matches_acceptance_schema(self):
        self.assertEqual(RUNTIME_SCHEMA, SCHEMA)

    def test_emitted_manifest_validates_against_schema(self):
        manifest = make_validation_manifest("20_portfolio_mixed.csv")
        Draft202012Validator(SCHEMA).validate(manifest)

    def test_rejected_file_emits_validation_only_manifest(self):
        manifest = make_validation_manifest("02_date_disorder.csv")
        self.assertEqual([stage["stage"] for stage in manifest["stages"]], ["validation"])
        self.assertEqual(manifest["stages"][0]["outcome"]["verdict"], "reject")
        self.assertEqual(manifest["stages"][0]["outcome"]["blocking"], 4)
        Draft202012Validator(SCHEMA).validate(manifest)

    def test_exact_hash_verifies_and_fingerprint_ignores_run_timing(self):
        first = make_validation_manifest("20_portfolio_mixed.csv")
        second = make_validation_manifest("20_portfolio_mixed.csv", created_at="2026-08-29T09:00:00Z")
        second["source"]["received_at"] = "2026-08-29T08:59:58Z"
        second["stages"][0]["started_at"] = "2026-08-29T08:59:58Z"
        second["stages"][0]["completed_at"] = "2026-08-29T08:59:59Z"
        second["stages"][0]["duration_ms"] = 1000
        second["run_id"] = "run_" + "b" * 32
        second["integrity"]["content_fingerprint_sha256"] = content_fingerprint(second)
        second["integrity"]["manifest_sha256"] = exact_manifest_hash(second)
        self.assertEqual(first["integrity"]["manifest_sha256"], exact_manifest_hash(first))
        self.assertNotEqual(first["integrity"]["manifest_sha256"], exact_manifest_hash(second))
        self.assertEqual(first["integrity"]["content_fingerprint_sha256"], second["integrity"]["content_fingerprint_sha256"])

    def test_fingerprint_ignores_deployment_identity_only(self):
        first = make_validation_manifest("20_portfolio_mixed.csv")
        environment = deepcopy(ENVIRONMENT)
        environment.update({
            "app_version": "9.9.9",
            "git_commit": "abcdef1",
            "runtime": "python 3.12.9",
            "container_image_digest": "sha256:" + "a" * 64,
        })
        second = make_validation_manifest("20_portfolio_mixed.csv")
        second["environment"] = environment
        second["integrity"]["content_fingerprint_sha256"] = content_fingerprint(second)
        second["integrity"]["manifest_sha256"] = exact_manifest_hash(second)
        self.assertEqual(first["integrity"]["content_fingerprint_sha256"], second["integrity"]["content_fingerprint_sha256"])

    def test_fingerprint_ignores_source_filename_hash_and_received_time(self):
        first = make_validation_manifest("20_portfolio_mixed.csv")
        second = deepcopy(first)
        second["source"]["filename_sha256"] = "b" * 64
        second["source"]["extension"] = ".txt"
        second["source"]["received_at"] = "2026-08-31T09:00:00Z"
        self.assertEqual(content_fingerprint(first), content_fingerprint(second))
        self.assertNotEqual(first["integrity"]["manifest_sha256"], exact_manifest_hash(second))

    def test_fingerprint_keeps_calculation_environment(self):
        first = make_validation_manifest("20_portfolio_mixed.csv")
        second = deepcopy(first)
        second["environment"]["region"] = "EU"
        self.assertNotEqual(content_fingerprint(first), content_fingerprint(second))
        third = deepcopy(first)
        third["environment"]["key_libraries"]["google-cloud-bigquery"] = "4.0.0"
        self.assertNotEqual(content_fingerprint(first), content_fingerprint(third))

    def test_corrupted_dependency_fails_closed(self):
        manifest = make_validation_manifest("20_portfolio_mixed.csv")
        manifest["stages"][0]["input_ref"]["sha256"] = "0" * 64
        with self.assertRaises(ManifestError):
            verify_dependency_graph(manifest)

    def test_manifest_contains_no_source_sku(self):
        manifest = make_validation_manifest("20_portfolio_mixed.csv")
        serialised = json.dumps(manifest)
        self.assertNotIn("PKG-10432", serialised)
        self.assertNotIn("PKG-10518", serialised)

    def test_manifest_contains_filename_hash_but_not_readable_filename(self):
        manifest = make_validation_manifest("20_portfolio_mixed.csv")
        source = manifest["source"]
        self.assertEqual(manifest["schema_version"], "1.3")
        self.assertNotIn("filename", source)
        self.assertEqual(len(source["filename_sha256"]), 64)
        self.assertEqual(source["extension"], ".csv")
        self.assertNotIn("20_portfolio_mixed.csv", json.dumps(manifest))

    def test_identifying_or_long_extension_is_not_emitted(self):
        source = source_record(b"sku,date,demand\n", "AcmePharma_Q3.TREDEGAR_SITE", "2026-08-30T09:00:00Z", {})
        self.assertEqual(source["extension"], ".other")
        self.assertNotIn("AcmePharma", json.dumps(source))
        self.assertNotIn("TREDEGAR", json.dumps(source))

    def test_reference_canary_detects_altered_baseline(self):
        output = [10.0, 11.0, 12.0]
        baseline = reference_check([1.0, 2.0, 3.0], output, "0" * 64, "2026-08-28T17:12:03Z")
        matched = reference_check([1.0, 2.0, 3.0], output, baseline["reference_output_sha256"], "2026-08-28T17:12:03Z")
        self.assertEqual(matched["status"], "match")
        altered = reference_check([1.0, 2.0, 3.0], output, "f" * 64, "2026-08-28T17:12:03Z")
        self.assertEqual(altered["status"], "drift_detected")

    def test_schema_requires_evidence_for_measured_determinism(self):
        model_required = set(SCHEMA["$defs"]["model_identity"]["required"])
        self.assertTrue({"context_points_supplied", "confidence_level", "interval_bounds", "reference_check"}.issubset(model_required))
        measurement = SCHEMA["$defs"]["determinism_measurement"]
        self.assertEqual(measurement["properties"]["provider_cache_disabled"]["const"], True)
        self.assertTrue({"zero_denominator_points", "points_compared"}.issubset(measurement["required"]))

    def test_forecast_manifest_validates_with_full_model_identity(self):
        base = make_validation_manifest("20_portfolio_mixed.csv")
        validation = base["stages"][0]
        canary = reference_check([1.0, 2.0, 3.0], [4.0, 5.0], "f" * 64, "2026-08-28T17:12:03Z")
        canary["baseline_output_sha256"] = canary["reference_output_sha256"]
        canary["status"] = "match"
        model = model_identity([[1.0] * 35, [2.0] * 8], 12, canary, included=2)
        stage = forecast_stage(
            {"forecast_total": 123.0}, validation["output_ref"], model,
            {"class": "unknown", "tolerance_pct": None, "seed": None, "statement": "Not yet measured."},
            "2026-08-28T17:12:02Z", "2026-08-28T17:12:03Z",
        )
        manifest = build_manifest(
            base["source"], [validation, stage], date(2026, 8, 1), "user", [],
            created_at="2026-08-28T17:12:04Z", environment=deepcopy(ENVIRONMENT),
        )
        Draft202012Validator(SCHEMA).validate(manifest)


if __name__ == "__main__":
    unittest.main()
