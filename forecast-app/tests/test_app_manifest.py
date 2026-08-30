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
        self.assertEqual(stage["outcome"]["findings"], 8)
        self.assertEqual(stage["outcome"]["blocking"], 4)
        self.assertEqual(stage["outcome"]["rows_out"], 0)

    def test_quality_returns_chained_manifest(self):
        payload = asyncio.run(app.quality_upload(upload("20_portfolio_mixed.csv"), "2026-08-01", "month", "{}"))
        self.assertEqual([stage["stage"] for stage in payload["manifest"]["stages"]], ["validation", "quality"])
        self.assertTrue(payload["manifest"]["integrity"]["chain_verified"])
        self.assertEqual(
            payload["manifest"]["stages"][1]["input_ref"]["sha256"],
            payload["manifest"]["stages"][0]["output_ref"]["sha256"],
        )

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
