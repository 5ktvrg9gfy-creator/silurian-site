import json
import unittest
from datetime import date
from pathlib import Path

from quality_engine import DEFAULT_THRESHOLDS, QualityOptions, assess_quality
from validator import ValidationOptions, validate_csv


FIXTURES = Path(__file__).parent / "quality_fixtures"
VALIDATION_FIXTURES = Path(__file__).parent / "fixtures"
EXPECTED = json.loads((FIXTURES / "expected_quality.json").read_text(encoding="utf-8"))


class QualityEngineTests(unittest.TestCase):
    def test_runtime_thresholds_match_authoritative_fixture(self):
        expected = {key: value for key, value in EXPECTED["thresholds"].items() if key != "note"}
        self.assertEqual(DEFAULT_THRESHOLDS, expected)

    def run_fixture(self, name):
        expected = EXPECTED["files"][name]
        as_of = date.fromisoformat(expected.get("as_of_date_override", EXPECTED["as_of_date"]))
        raw = (FIXTURES / name).read_bytes()
        validation = validate_csv(raw, ValidationOptions(as_of_date=as_of))
        self.assertNotEqual(validation.verdict, "reject", f"1.1 regression for {name}: {[item.code for item in validation.findings]}")
        options = QualityOptions(as_of_date=as_of, as_of_date_source="fixture", grain=EXPECTED["grain"], thresholds=EXPECTED["thresholds"])
        return assess_quality(validation, options).to_dict(), expected

    def test_structural_metrics(self):
        tolerance = EXPECTED["tolerance"]
        for name in EXPECTED["files"]:
            with self.subTest(file=name):
                report, expected = self.run_fixture(name)
                actual_by_sku = {item["sku"]: item for item in report["skus"]}
                self.assertEqual(report["headline"]["skus_analysed"], expected["sku_count"])
                self.assertAlmostEqual(report["portfolio"]["portfolio_volume"], expected["portfolio_volume"], places=4)
                for sku, metrics in expected["per_sku"].items():
                    actual = actual_by_sku[sku]
                    for field, expected_value in metrics.items():
                        if isinstance(expected_value, float):
                            allowed = tolerance.get(field, 0.001)
                            self.assertAlmostEqual(actual[field], expected_value, delta=allowed, msg=f"{name} {sku} {field}")
                        else:
                            self.assertEqual(actual[field], expected_value, f"{name} {sku} {field}")

    def test_required_and_prohibited_findings_and_bands(self):
        for name in EXPECTED["files"]:
            with self.subTest(file=name):
                report, expected = self.run_fixture(name)
                assertions = expected["assertions"]
                actual = {item["sku"]: {finding["code"] for finding in item["findings"]} for item in report["skus"]}
                self.assertEqual(report["portfolio"]["band"], assertions["portfolio_band"])
                must_flag = assertions.get("must_flag", {})
                for sku, codes in (must_flag.items() if isinstance(must_flag, dict) else []):
                    self.assertTrue(set(codes).issubset(actual[sku]), f"{name} {sku}: {actual[sku]}")
                for sku in assertions.get("must_not_flag", []):
                    self.assertEqual(actual[sku], set(), f"{name} {sku}: {actual[sku]}")
                for sku, codes in assertions.get("must_not_raise", {}).items():
                    self.assertTrue(set(codes).isdisjoint(actual[sku]), f"{name} {sku}: {actual[sku]}")
                for sku, band in assertions.get("expected_bands", {}).items():
                    item = next(row for row in report["skus"] if row["sku"] == sku)
                    self.assertEqual(item["band"], band, f"{name} {sku}")
                for sku, resolvable in assertions.get("resolvable", {}).items():
                    item = next(row for row in report["skus"] if row["sku"] == sku)
                    self.assertEqual(item["resolvable"], resolvable, f"{name} {sku}")

    def test_stale_extract_is_one_portfolio_finding(self):
        report, _ = self.run_fixture("21_stale_extract.csv")
        portfolio_codes = [finding["code"] for finding in report["portfolio"]["findings"]]
        sku_codes = [finding["code"] for item in report["skus"] for finding in item["findings"]]
        self.assertEqual(portfolio_codes.count("EXTRACT_STALE"), 1)
        self.assertNotIn("SERIES_STALE", sku_codes)
        self.assertNotIn("SERIES_DISCONTINUED", sku_codes)

    def test_fixture_07_reports_undefined_cv_and_stale_extract(self):
        raw = (VALIDATION_FIXTURES / "07_zeros_versus_gaps.csv").read_bytes()
        as_of = date(2026, 8, 1)
        validation = validate_csv(raw, ValidationOptions(as_of_date=as_of))
        report = assess_quality(
            validation,
            QualityOptions(as_of_date=as_of, as_of_date_source="fixture", grain="month"),
        ).to_dict()
        by_sku = {item["sku"]: item for item in report["skus"]}
        self.assertIsNone(by_sku["PKG-30223"]["cv_squared_nonzero"])
        self.assertEqual(report["context"]["thresholds"]["cv_squared_estimator"], "population")
        self.assertEqual(report["context"]["thresholds"]["cv_squared_min_nonzero_observations"], 3)
        self.assertIn("EXTRACT_STALE", {item["code"] for item in report["portfolio"]["findings"]})
        self.assertEqual(by_sku["PKG-30219"]["trailing_gap_periods_as_of"], 7)
        self.assertEqual(by_sku["PKG-30219"]["trailing_gap_periods_to_portfolio_cutoff"], 0)

    def test_cv_squared_estimator_is_explicit_and_effective(self):
        raw = (VALIDATION_FIXTURES / "07_zeros_versus_gaps.csv").read_bytes()
        as_of = date(2026, 8, 1)
        validation = validate_csv(raw, ValidationOptions(as_of_date=as_of))
        population = assess_quality(validation, QualityOptions(as_of_date=as_of, grain="month")).to_dict()
        sample_thresholds = {**DEFAULT_THRESHOLDS, "cv_squared_estimator": "sample"}
        sample = assess_quality(validation, QualityOptions(as_of_date=as_of, grain="month", thresholds=sample_thresholds)).to_dict()
        population_metric = next(item for item in population["skus"] if item["sku"] == "PKG-30220")["cv_squared_nonzero"]
        sample_metric = next(item for item in sample["skus"] if item["sku"] == "PKG-30220")["cv_squared_nonzero"]
        self.assertAlmostEqual(sample_metric / population_metric, 1.5, delta=0.001)

    def test_flagged_sku_and_volume_shares_tell_both_sides(self):
        report, expected = self.run_fixture("20_portfolio_mixed.csv")
        headline = expected["assertions"]["headline_expectations"]
        self.assertAlmostEqual(report["headline"]["clean_volume_share_pct"], headline["clean_volume_share_pct"], delta=headline["tolerance_pct"])
        self.assertAlmostEqual(report["portfolio"]["flagged_sku_share_pct"], headline["flagged_sku_share_pct"], delta=headline["tolerance_pct"])
        self.assertAlmostEqual(report["portfolio"]["flagged_volume_share_pct"], headline["flagged_volume_share_pct"], delta=headline["tolerance_pct"])
        self.assertGreater(abs(report["portfolio"]["flagged_sku_share_pct"] - report["portfolio"]["flagged_volume_share_pct"]), 40)
        long_tail = next(item for item in report["portfolio"]["findings"] if item["code"] == "LONG_TAIL_CONCENTRATION")
        self.assertEqual(long_tail["metric"]["skus"], headline["long_tail_skus_beyond_99pct"])
        self.assertAlmostEqual(long_tail["metric"]["combined_volume_share_pct"], headline["long_tail_volume_share_pct"], delta=headline["tolerance_pct"])

    def test_report_is_stable_and_volume_sorted(self):
        expected = EXPECTED["files"]["20_portfolio_mixed.csv"]
        as_of = date.fromisoformat(EXPECTED["as_of_date"])
        raw = (FIXTURES / "20_portfolio_mixed.csv").read_bytes()
        validation = validate_csv(raw, ValidationOptions(as_of_date=as_of))
        options = QualityOptions(as_of_date=as_of, as_of_date_source="fixture", grain="month", thresholds=EXPECTED["thresholds"])
        first = assess_quality(validation, options)
        second = assess_quality(validation, options)
        self.assertEqual(first.stable_json(), second.stable_json())
        volumes = [item["volume_total"] for item in first.to_dict()["skus"]]
        self.assertEqual(volumes, sorted(volumes, reverse=True))
        self.assertEqual(expected["assertions"]["portfolio_band"], first.to_dict()["portfolio"]["band"])

    def test_outlier_wording_uses_correct_number(self):
        mixed, _ = self.run_fixture("20_portfolio_mixed.csv")
        shifted, _ = self.run_fixture("22_outliers_and_shift.csv")
        mixed_detail = next(
            finding["detail"]
            for item in mixed["skus"]
            for finding in item["findings"]
            if finding["code"] == "OUTLIER_CANDIDATE"
        )
        shifted_detail = next(
            finding["detail"]
            for item in shifted["skus"]
            for finding in item["findings"]
            if finding["code"] == "OUTLIER_CANDIDATE"
        )
        self.assertEqual(mixed_detail, "2 periods are robust outlier candidates.")
        self.assertEqual(shifted_detail, "1 period is a robust outlier candidate.")


if __name__ == "__main__":
    unittest.main()
