import json
import unittest
from datetime import date
from pathlib import Path

from classification_engine import DEFAULT_CLASSIFICATION_THRESHOLDS, classify_quality
from quality_engine import QualityOptions, assess_quality
from run_manifest import classification_stage
from validator import ValidationOptions, validate_csv


FIXTURES = Path(__file__).parent / "classification_fixtures"
EXPECTED = json.loads((FIXTURES / "expected_classification.json").read_text(encoding="utf-8"))


class ClassificationEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        raw = (FIXTURES / EXPECTED["fixture"]).read_bytes()
        as_of = date.fromisoformat(EXPECTED["as_of_date"])
        cls.validation = validate_csv(raw, ValidationOptions(as_of_date=as_of))
        cls.quality = assess_quality(
            cls.validation,
            QualityOptions(as_of_date=as_of, as_of_date_source="fixture", grain=EXPECTED["grain"]),
        ).to_dict()
        cls.result = classify_quality(cls.quality)

    def test_authoritative_fixture_and_thresholds(self):
        self.assertEqual(self.validation.verdict, "accept")
        expected = {key: value for key, value in EXPECTED["thresholds"].items() if key not in {"note", "abc_rule"}}
        self.assertEqual(DEFAULT_CLASSIFICATION_THRESHOLDS, expected)

    def test_every_sku_matches_expected_classification(self):
        labels = {
            "expected_class": "demand_class",
            "expected_abc_volume": "abc_volume_class",
            "expected_xyz": "xyz",
        }
        tolerances = EXPECTED["tolerance"]
        self.assertEqual(set(self.result["per_sku"]), set(EXPECTED["per_sku"]))
        for sku, expected in EXPECTED["per_sku"].items():
            actual = self.result["per_sku"][sku]
            for field, value in expected.items():
                target = labels.get(field, field)
                if isinstance(value, float):
                    self.assertAlmostEqual(actual[target], value, delta=tolerances.get(field, 0.001), msg=f"{sku} {field}")
                else:
                    self.assertEqual(actual[target], value, f"{sku} {field}")

    def test_portfolio_counts_and_all_fifteen_cells(self):
        portfolio = self.result["portfolio"]
        expected = EXPECTED["portfolio"]
        self.assertEqual(portfolio["sku_count"], expected["sku_count"])
        self.assertEqual(portfolio["class_counts"], expected["class_counts"])
        self.assertEqual(portfolio["abc_counts"], expected["abc_counts"])
        self.assertEqual(portfolio["xyz_meaningful_count"], expected["xyz_meaningful_count"])
        self.assertEqual(len(self.result["matrix"]), 15)
        self.assertEqual(sum(cell["line_count"] > 0 for cell in self.result["matrix"].values()), 11)

    def test_metrics_are_consumed_unchanged_from_quality(self):
        quality_by_sku = {row["sku"]: row for row in self.quality["skus"]}
        for sku, item in self.result["per_sku"].items():
            self.assertEqual(item["adi"], quality_by_sku[sku]["adi"])
            self.assertEqual(item["cv_squared_nonzero"], quality_by_sku[sku]["cv_squared_nonzero"])

    def test_refusal_and_xyz_meaning(self):
        for sku in ("PKG-50502", "PKG-50602"):
            item = self.result["per_sku"][sku]
            self.assertEqual(item["demand_class"], "unclassifiable")
            self.assertIsNone(item["cv_squared_nonzero"])
            self.assertIn("unclassifiable_reason", item)
        self.assertEqual(sum(item["xyz_meaningful"] for item in self.result["per_sku"].values()), 7)

    def test_quality_behaviour_is_preserved(self):
        interaction = EXPECTED["quality_interaction"]["expected_quality"]
        self.assertEqual(self.quality["portfolio"]["band"], interaction["portfolio_band"])
        self.assertEqual(
            {item["code"] for item in self.quality["portfolio"]["findings"]},
            set(interaction["portfolio_findings"]),
        )
        actual = {row["sku"]: [finding["code"] for finding in row["findings"]] for row in self.quality["skus"]}
        for sku, codes in interaction["per_sku_findings"].items():
            self.assertEqual(actual[sku], codes)

    def test_manifest_stage_uses_quality_reference_and_contains_counts_only(self):
        input_ref = {"type": "quality_result", "sha256": "a" * 64, "series": 15}
        stage = classification_stage(
            self.result, input_ref, "2026-09-01T09:00:00Z", "2026-09-01T09:00:01Z"
        )
        self.assertEqual(stage["input_ref"], input_ref)
        self.assertEqual(stage["output_ref"]["type"], "classification_result")
        self.assertEqual(stage["outcome"]["class_counts"], EXPECTED["portfolio"]["class_counts"])
        serialised = json.dumps(stage)
        for sku in EXPECTED["per_sku"]:
            self.assertNotIn(sku, serialised)
        self.assertNotIn("volume_share", serialised)


if __name__ == "__main__":
    unittest.main()
