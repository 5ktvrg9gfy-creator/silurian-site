import ast
import asyncio
import io
import json
import unittest
from datetime import date
from pathlib import Path

from starlette.datastructures import UploadFile

import app
from classification_engine import classify_quality
from quality_engine import DEFAULT_THRESHOLDS, QualityOptions, assess_quality
from run_manifest import quality_stage, sha256_json, source_record, validation_stage
from validator import ValidationOptions, validate_csv


APP = Path(__file__).parents[1]
FIXTURES = Path(__file__).parent / "fixtures"
QUALITY_FIXTURES = Path(__file__).parent / "quality_fixtures"
EXPECTED = json.loads((FIXTURES / "expected_findings.json").read_text(encoding="utf-8"))
QUALITY_EXPECTED = json.loads((QUALITY_FIXTURES / "expected_quality.json").read_text(encoding="utf-8"))
PRE_CHANGE_FIXTURE_07_QUALITY_HASH = "868ef3921f4ddb427106cef46d112f6be05a55b2d63c29df71fef6551c681a5f"
POST_STAGE_SPLIT_FIXTURE_07_QUALITY_HASH = "48797966072510f99af973003150e4c0d95b59a60bcb687d1a3982b7d4faa290"
POST_REVIEW_FIXTURE_07_QUALITY_HASH = "166118438a54da533227cbc68f80aa3373cda6276d042989fc41b11e5bc36e9e"
POST_REVIEW_FIXTURE_07_NORMALISED_QUALITY_HASH = "856302975305fd0ee820546764de955978430ca1ce6ea966b4dd3b5c9f1ed02c"

FINDING_PROPERTIES = {
    "HISTORY_TOO_SHORT": "history_sufficiency",
    "SINGLE_OBSERVATION_SERIES": "history_sufficiency",
    "SERIES_DISCONTINUED": "recency",
    "SERIES_STALE": "recency",
    "ZERO_VS_MISSING_AMBIGUOUS": "zero_or_missing",
}


def emitted_codes(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    codes = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not node.args:
            continue
        function = node.func
        if isinstance(function, ast.Name) and function.id == "_finding":
            value = node.args[0]
            if isinstance(value, ast.Constant) and isinstance(value.value, str):
                codes.add(value.value)
    return codes


def upload(path: Path) -> UploadFile:
    return UploadFile(io.BytesIO(path.read_bytes()), filename=path.name)


class StageConsistencyTests(unittest.TestCase):
    def test_finding_code_ownership_is_disjoint(self):
        validation_codes = emitted_codes(APP / "validator.py")
        quality_codes = emitted_codes(APP / "quality_engine.py")
        classification_codes = emitted_codes(APP / "classification_engine.py")
        self.assertEqual(validation_codes & quality_codes, set())
        self.assertEqual(classification_codes, set())

    def test_no_fixture_has_cross_stage_property_conflicts(self):
        as_of = date.fromisoformat(EXPECTED["as_of_date"])
        for fixture in EXPECTED["files"]:
            raw = (FIXTURES / fixture["file"]).read_bytes()
            for expected_pass in fixture["passes"]:
                if expected_pass["verdict"] == "reject":
                    continue
                with self.subTest(file=fixture["file"], validation_pass=expected_pass["pass"]):
                    supplied = dict(expected_pass.get("options", {}))
                    supplied["as_of_date"] = as_of
                    validation = validate_csv(raw, ValidationOptions.from_value(supplied))
                    self.assertNotEqual(validation.verdict, "reject")
                    quality = assess_quality(validation, QualityOptions(
                        as_of_date=as_of,
                        as_of_date_source="fixture",
                        grain="month",
                        thresholds=dict(DEFAULT_THRESHOLDS),
                    )).to_dict()
                    validation_by_sku = {}
                    for finding in validation.findings:
                        if finding.ref and finding.code in FINDING_PROPERTIES:
                            validation_by_sku.setdefault(finding.ref, set()).add(FINDING_PROPERTIES[finding.code])
                    for item in quality["skus"]:
                        quality_properties = {
                            FINDING_PROPERTIES[finding["code"]]
                            for finding in item["findings"]
                            if finding["code"] in FINDING_PROPERTIES
                        }
                        self.assertEqual(validation_by_sku.get(item["sku"], set()) & quality_properties, set())

    def test_mixed_portfolio_endpoint_has_no_cross_stage_code_duplicates(self):
        fixture = QUALITY_FIXTURES / "20_portfolio_mixed.csv"
        payload = asyncio.run(app.quality_upload(upload(fixture), "2026-08-01", "month", "{}"))
        validation_codes = {finding["code"] for finding in payload["validation"]["findings"]}
        quality_codes = {
            finding["code"]
            for item in payload["quality"]["skus"]
            for finding in item["findings"]
        } | {finding["code"] for finding in payload["quality"]["portfolio"]["findings"]}
        self.assertEqual(validation_codes & quality_codes, set())

    def test_classification_does_not_copy_findings_or_contradict_refusal(self):
        fixture = Path(__file__).parent / "classification_fixtures" / "30_classification_portfolio.csv"
        as_of = date(2026, 8, 1)
        validation = validate_csv(fixture.read_bytes(), ValidationOptions(as_of_date=as_of))
        quality = assess_quality(validation, QualityOptions(as_of_date=as_of, grain="month")).to_dict()
        classification = classify_quality(quality)
        for item in classification["per_sku"].values():
            self.assertNotIn("band", item)
            self.assertNotIn("findings", item)
        quality_50602 = next(item for item in quality["skus"] if item["sku"] == "PKG-50602")
        self.assertEqual({finding["code"] for finding in quality_50602["findings"]}, {"HISTORY_TOO_SHORT", "SERIES_DISCONTINUED"})
        self.assertEqual(classification["per_sku"]["PKG-50602"]["demand_class"], "unclassifiable")

    def test_fixture_07_quality_engine_payload_matches_reviewed_contract(self):
        fixture = FIXTURES / "07_zeros_versus_gaps.csv"
        raw = fixture.read_bytes()
        as_of = date(2026, 8, 1)
        validation = validate_csv(raw, ValidationOptions(as_of_date=as_of))
        self.assertEqual(validation.verdict, "accept")
        self.assertEqual(validation.findings, ())
        source = source_record(raw, fixture.name, "2026-08-31T09:00:00Z", validation.metadata)
        validation_record = validation_stage(
            validation, source, "2026-08-31T09:00:00Z", "2026-08-31T09:00:01Z"
        )
        quality = assess_quality(validation, QualityOptions(
            as_of_date=as_of,
            as_of_date_source="fixture",
            grain="month",
            thresholds=dict(DEFAULT_THRESHOLDS),
        )).to_dict()
        quality_record = quality_stage(
            quality, validation_record["output_ref"], "2026-08-31T09:00:01Z", "2026-08-31T09:00:02Z"
        )
        self.assertNotEqual(PRE_CHANGE_FIXTURE_07_QUALITY_HASH, POST_STAGE_SPLIT_FIXTURE_07_QUALITY_HASH)
        self.assertNotEqual(POST_STAGE_SPLIT_FIXTURE_07_QUALITY_HASH, POST_REVIEW_FIXTURE_07_QUALITY_HASH)
        self.assertEqual(quality_record["output_ref"]["sha256"], POST_REVIEW_FIXTURE_07_QUALITY_HASH)
        quality_without_validation_verdict = dict(quality)
        quality_without_validation_verdict["source"] = dict(quality["source"])
        quality_without_validation_verdict["source"].pop("validation_verdict")
        self.assertEqual(
            sha256_json(quality_without_validation_verdict),
            POST_REVIEW_FIXTURE_07_NORMALISED_QUALITY_HASH,
        )
        self.assertEqual(
            QUALITY_EXPECTED["files"]["07_zeros_versus_gaps.csv"]["assertions"]["normalised_source_sha256"],
            POST_REVIEW_FIXTURE_07_NORMALISED_QUALITY_HASH,
        )


if __name__ == "__main__":
    unittest.main()
