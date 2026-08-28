import json
import time
import unittest
from datetime import date
from pathlib import Path

from validator import ValidationOptions, validate_csv


FIXTURES = Path(__file__).parent / "fixtures"


class ValidatorFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.expectations = json.loads((FIXTURES / "expected_findings.json").read_text(encoding="utf-8"))
        cls.as_of_date = date.fromisoformat(cls.expectations["as_of_date"])

    def test_every_fixture_pass(self):
        for fixture in self.expectations["files"]:
            raw = (FIXTURES / fixture["file"]).read_bytes()
            for expected_pass in fixture["passes"]:
                with self.subTest(file=fixture["file"], validation_pass=expected_pass["pass"]):
                    supplied = dict(expected_pass.get("options", {}))
                    supplied["as_of_date"] = self.as_of_date
                    result = validate_csv(raw, ValidationOptions.from_value(supplied))
                    self.assertEqual(result.verdict, expected_pass["verdict"])
                    actual_codes = {finding.code for finding in result.findings}
                    expected_codes = {defect["code"] for defect in expected_pass["defects"]}
                    self.assertTrue(expected_codes.issubset(actual_codes), expected_codes - actual_codes)

    def test_clean_control_has_no_findings(self):
        result = validate_csv(
            (FIXTURES / "00_clean_control.csv").read_bytes(),
            ValidationOptions(as_of_date=self.as_of_date),
        )
        self.assertEqual(result.verdict, "accept")
        self.assertEqual(result.findings, ())

    def test_deterministic_serialisation_and_order(self):
        raw = (FIXTURES / "05_duplicates_and_aliases.csv").read_bytes()
        options = ValidationOptions(as_of_date=self.as_of_date)
        first = validate_csv(raw, options)
        second = validate_csv(raw, options)
        self.assertEqual(first.stable_json(), second.stable_json())
        self.assertEqual(first.findings, second.findings)

    def test_encoding_stop_rule(self):
        result = validate_csv(
            (FIXTURES / "06_semicolon_latin1.csv").read_bytes(),
            ValidationOptions(as_of_date=self.as_of_date),
        )
        self.assertEqual(result.verdict, "reject")
        self.assertIn("ENCODING_NOT_UTF8", {finding.code for finding in result.findings})
        self.assertTrue(all(finding.stage == "bytes" for finding in result.findings))

    def test_every_blocking_expectation_has_resolution(self):
        for fixture in self.expectations["files"]:
            for expected_pass in fixture["passes"]:
                for defect in expected_pass["defects"]:
                    if defect["severity"] == "blocking":
                        self.assertTrue(defect.get("resolution"), f"{fixture['file']} {defect['code']}")

    def test_no_blocking_expectation_has_non_reject_verdict(self):
        for fixture in self.expectations["files"]:
            for expected_pass in fixture["passes"]:
                if any(defect["severity"] == "blocking" for defect in expected_pass["defects"]):
                    self.assertEqual(expected_pass["verdict"], "reject")

    def test_50000_rows_under_five_seconds(self):
        lines = ["sku,date,demand"]
        for sku_index in range(500):
            for period in range(100):
                year = 2018 + period // 12
                month = period % 12 + 1
                lines.append(f"SKU-{sku_index:04d},{year:04d}-{month:02d}-01,{100 + period % 7}")
        raw = ("\n".join(lines) + "\n").encode("utf-8")
        started = time.perf_counter()
        result = validate_csv(raw, ValidationOptions(as_of_date=date(2030, 1, 1)))
        elapsed = time.perf_counter() - started
        self.assertNotEqual(result.verdict, "reject")
        self.assertLess(elapsed, 5.0)


if __name__ == "__main__":
    unittest.main()
