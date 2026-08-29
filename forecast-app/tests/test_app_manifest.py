import asyncio
import io
import json
import unittest
from pathlib import Path

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
        response = asyncio.run(app.validate_upload(upload("02_date_disorder.csv"), "{}"))
        payload = json.loads(response.body)
        self.assertEqual(response.status_code, 422)
        stage = payload["manifest"]["stages"][0]
        self.assertEqual([item["stage"] for item in payload["manifest"]["stages"]], ["validation"])
        self.assertEqual(stage["outcome"]["findings"], 7)
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


if __name__ == "__main__":
    unittest.main()
