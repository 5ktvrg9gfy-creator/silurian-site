import asyncio
import io
import json
import logging
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.datastructures import UploadFile

import app


FIXTURES = Path(__file__).parent / "run_manifest_fixtures"


def upload(name: str) -> UploadFile:
    return UploadFile(io.BytesIO((FIXTURES / name).read_bytes()), filename=name)


class AppManifestTests(unittest.TestCase):
    def test_validate_returns_manifest(self):
        response = asyncio.run(app.validate_upload(upload("20_portfolio_mixed.csv"), "{}"))
        payload = json.loads(response.body)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["manifest"]["integrity"]["chain_verified"])
        self.assertEqual([stage["stage"] for stage in payload["manifest"]["stages"]], ["validation"])

    def test_rejection_returns_validation_only_manifest(self):
        response = asyncio.run(app.validate_upload(upload("02_date_disorder.csv"), '{"as_of_date":"2026-08-01"}'))
        payload = json.loads(response.body)
        self.assertEqual(response.status_code, 422)
        stage = payload["manifest"]["stages"][0]
        self.assertEqual([item["stage"] for item in payload["manifest"]["stages"]], ["validation"])
        self.assertEqual(stage["outcome"]["findings"], 9)
        self.assertEqual(stage["outcome"]["blocking"], 5)
        self.assertEqual(stage["outcome"]["rows_out"], 0)

    def test_quality_returns_chained_manifest(self):
        payload = asyncio.run(app.quality_upload(upload("20_portfolio_mixed.csv"), "2026-08-01", "month", "{}"))
        self.assertEqual([stage["stage"] for stage in payload["manifest"]["stages"]], ["validation", "quality", "classification", "routing"])
        self.assertTrue(payload["manifest"]["integrity"]["chain_verified"])
        self.assertEqual(
            payload["manifest"]["stages"][1]["input_ref"]["sha256"],
            payload["manifest"]["stages"][0]["output_ref"]["sha256"],
        )
        self.assertEqual(
            payload["manifest"]["stages"][2]["input_ref"]["sha256"],
            payload["manifest"]["stages"][1]["output_ref"]["sha256"],
        )
        self.assertEqual(
            payload["manifest"]["stages"][3]["input_ref"]["sha256"],
            payload["manifest"]["stages"][2]["output_ref"]["sha256"],
        )
        self.assertEqual(payload["classification_result"]["portfolio"]["sku_count"], 12)
        self.assertEqual(payload["routing_result"]["portfolio"]["sku_count"], 12)
        self.assertEqual(set(payload["bundle"]["results"]), {"validation", "quality", "classification", "routing"})
        for item in payload["bundle"]["results"]["routing"]["per_sku"].values():
            self.assertNotIn("band", item)
            self.assertNotIn("findings", item)
        self.assertNotIn("open_items", json.dumps(payload["manifest"]))
        for item in payload["bundle"]["results"]["classification"]["per_sku"].values():
            self.assertNotIn("band", item)
            self.assertNotIn("findings", item)

    def test_quality_records_resolutions_as_passes_without_client_data(self):
        resolutions = json.dumps({
            "PKG-10603": {"code": "DEFER", "applied_at": "2026-09-02T12:00:00Z", "note": "Planner note"},
        })
        baseline = asyncio.run(app.quality_upload(upload("20_portfolio_mixed.csv"), "2026-08-01", "month", "{}"))
        refused = [sku for sku, item in baseline["routing_result"]["per_sku"].items() if item["refusal"]]
        self.assertTrue(refused)
        target = refused[0]
        resolutions = json.dumps({target: {"code": "DEFER", "applied_at": "2026-09-02T12:00:00Z", "note": "Planner note"}})
        payload = asyncio.run(app.quality_upload(upload("20_portfolio_mixed.csv"), "2026-08-01", "month", "{}", resolutions))
        stage = payload["manifest"]["stages"][3]
        self.assertEqual(stage["options"]["passes"][1]["code"], "DEFER")
        self.assertEqual(len(stage["options"]["passes"][1]["sku_sha256"]), 64)
        serialised = json.dumps(payload["manifest"])
        self.assertNotIn(target, serialised)
        self.assertNotIn("Planner note", serialised)
        self.assertEqual(payload["routing_result"]["per_sku"][target]["resolution"]["note"], "Planner note")
        self.assertEqual(payload["routing_result"]["per_sku"][target]["decision"], baseline["routing_result"]["per_sku"][target]["decision"])
        self.assertEqual(payload["bundle"]["results"]["routing"]["passes"][1]["sku"], target)
        self.assertEqual(payload["bundle"]["bundle_schema_version"], "1.3")
        with self.assertRaises(HTTPException) as refused_json:
            asyncio.run(app.quality_upload(upload("20_portfolio_mixed.csv"), "2026-08-01", "month", "{}", "not json"))
        self.assertEqual(refused_json.exception.status_code, 400)
        with self.assertRaises(HTTPException) as refused_code:
            asyncio.run(app.quality_upload(upload("20_portfolio_mixed.csv"), "2026-08-01", "month", "{}", json.dumps({target: {"code": "NOT_A_CODE", "applied_at": "2026-09-02T12:00:00Z"}})))
        self.assertEqual(refused_code.exception.status_code, 400)
        self.assertNotIn(target, refused_code.exception.detail)

    def test_forecast_returns_model_provenance(self):
        class Request:
            headers = {}

        sample = Path(__file__).parents[1] / "sample-data.csv"
        payload = asyncio.run(app.run_analysis(
            Request(), UploadFile(io.BytesIO(sample.read_bytes()), filename="sample-data.csv"),
            13, 8900, 10000, 1500, "", "Established", 0, 1, 13, "", "{}",
        ))
        stages = payload["manifest"]["stages"]
        self.assertEqual([stage["stage"] for stage in stages], ["validation", "forecast"])
        self.assertTrue(payload["manifest"]["integrity"]["chain_verified"])
        self.assertEqual(stages[1]["model"]["context_window_requested"], 512)
        self.assertEqual(stages[1]["model"]["reference_check"]["status"], "match")

    def test_api_responses_are_not_cacheable(self):
        client = TestClient(app.app)
        raw = (FIXTURES / "20_portfolio_mixed.csv").read_bytes()
        response = client.post("/api/validate", files={"file": ("portfolio.csv", raw, "text/csv")})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_unhandled_api_error_is_generic_and_not_cacheable(self):
        client = TestClient(app.app, raise_server_exceptions=False)
        raw = (FIXTURES / "20_portfolio_mixed.csv").read_bytes()
        with patch.object(app, "assess_quality", side_effect=ValueError("failure for PKG-10432")):
            response = client.post(
                "/api/quality",
                files={"file": ("portfolio.csv", raw, "text/csv")},
                data={"analysis_date": "2026-08-01", "grain": "month"},
            )
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(response.json()["detail"], "The diagnostic could not be completed")
        self.assertNotIn("PKG-10432", response.text)

    def test_full_fixture_and_unexpected_error_never_log_a_sku(self):
        class Request:
            headers = {}

        fixture = FIXTURES / "20_portfolio_mixed.csv"
        skus = {line.split(",", 1)[0] for line in fixture.read_text(encoding="utf-8").splitlines()[1:] if line}
        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        root = logging.getLogger()
        previous_level = root.level
        root.addHandler(handler)
        root.setLevel(logging.ERROR)
        try:
            asyncio.run(app.quality_upload(upload("20_portfolio_mixed.csv"), "2026-08-01", "month", "{}"))
            with patch.object(app, "parse_portfolio_csv", side_effect=ValueError(f"forced test failure for {next(iter(skus))}")):
                with self.assertRaises(HTTPException):
                    asyncio.run(app.run_portfolio_analysis(Request(), upload("20_portfolio_mixed.csv"), 13, "{}"))
        finally:
            root.removeHandler(handler)
            root.setLevel(previous_level)
        output = stream.getvalue()
        self.assertIn("TimesFM portfolio analysis failed", output)
        for sku in skus:
            self.assertNotIn(sku, output)

    def test_reopen_is_browser_only(self):
        html = (Path(__file__).parents[1] / "static" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("fetch('/api/reopen-bundle'", html)
        self.assertIn("crypto.subtle.digest", html)
        self.assertIn("The bundle never leaves your device", html)


if __name__ == "__main__":
    unittest.main()
