from __future__ import annotations

import json
import os
from datetime import date, timedelta
from typing import Sequence


class BigQueryTimesFMProvider:
    name = "TimesFM 2.5 through BigQuery"

    def __init__(self) -> None:
        from google.cloud import bigquery
        from google.oauth2 import service_account

        project = os.environ.get("GOOGLE_CLOUD_PROJECT", "").strip()
        credentials_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
        if not project or not credentials_json:
            raise RuntimeError("BigQuery TimesFM is not configured")
        try:
            info = json.loads(credentials_json)
        except json.JSONDecodeError as exc:
            raise RuntimeError("The Google service account configuration is invalid") from exc

        credentials = service_account.Credentials.from_service_account_info(info)
        self._bigquery = bigquery
        self._client = bigquery.Client(project=project, credentials=credentials)
        self._location = os.environ.get("BIGQUERY_LOCATION", "europe-west2")
        self._maximum_bytes = int(os.environ.get("BIGQUERY_MAX_BYTES_BILLED", "10000000"))

    def forecast(self, history: Sequence[float], horizon: int, dates: Sequence[date] | None = None) -> list[float]:
        bigquery = self._bigquery
        if dates is None:
            end = date.today()
            dates = [end - timedelta(weeks=len(history) - index - 1) for index in range(len(history))]
        query = f"""
        WITH input AS (
          SELECT observed_date, demand
          FROM UNNEST(@dates) AS observed_date WITH OFFSET position
          JOIN UNNEST(@demand) AS demand WITH OFFSET position USING (position)
        )
        SELECT forecast_value, ai_forecast_status
        FROM AI.FORECAST(
          TABLE input,
          data_col => 'demand',
          timestamp_col => 'observed_date',
          model => 'TimesFM 2.5',
          horizon => {int(horizon)},
          confidence_level => 0.9
        )
        ORDER BY forecast_timestamp
        """
        config = bigquery.QueryJobConfig(
            maximum_bytes_billed=self._maximum_bytes,
            query_parameters=[
                bigquery.ArrayQueryParameter("dates", "DATE", list(dates)),
                bigquery.ArrayQueryParameter("demand", "FLOAT64", [float(value) for value in history]),
            ],
        )
        rows = list(self._client.query(query, job_config=config, location=self._location).result())
        if not rows:
            raise RuntimeError("TimesFM returned no forecast")
        if rows[0].ai_forecast_status:
            raise RuntimeError(f"TimesFM forecast failed: {rows[0].ai_forecast_status}")
        return [max(0.0, float(row.forecast_value)) for row in rows]

