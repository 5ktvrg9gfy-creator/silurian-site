from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Sequence

from google.auth import identity_pool


# Vercel supplies a short-lived token with each function request.
class _VercelTokenSupplier(identity_pool.SubjectTokenSupplier):
    def __init__(self, token: str) -> None:
        self._token = token

    def get_subject_token(self, context, request) -> str:
        return self._token


class BigQueryTimesFMProvider:
    name = "TimesFM 2.5 through BigQuery"
    context_window = 512
    confidence_level = 0.9

    def __init__(self, oidc_token: str) -> None:
        from google.cloud import bigquery

        project = os.environ.get("GOOGLE_CLOUD_PROJECT", "").strip()
        project_number = os.environ.get("GCP_PROJECT_NUMBER", "").strip()
        pool_id = os.environ.get("GCP_WORKLOAD_IDENTITY_POOL_ID", "").strip()
        provider_id = os.environ.get("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID", "").strip()
        service_account = os.environ.get("GCP_SERVICE_ACCOUNT_EMAIL", "").strip()
        if not all((project, project_number, pool_id, provider_id, service_account, oidc_token)):
            raise RuntimeError("BigQuery TimesFM is not configured")

        audience = (
            f"//iam.googleapis.com/projects/{project_number}/locations/global/"
            f"workloadIdentityPools/{pool_id}/providers/{provider_id}"
        )
        credentials = identity_pool.Credentials(
            audience=audience,
            subject_token_type="urn:ietf:params:oauth:token-type:jwt",
            subject_token_supplier=_VercelTokenSupplier(oidc_token),
            service_account_impersonation_url=(
                "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"
                f"{service_account}:generateAccessToken"
            ),
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        self._bigquery = bigquery
        self._client = bigquery.Client(project=project, credentials=credentials)
        self._location = os.environ.get("BIGQUERY_LOCATION", "europe-west2")
        self._maximum_bytes = int(os.environ.get("BIGQUERY_MAX_BYTES_BILLED", "10000000"))
        self.last_cache_hit = True

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
          confidence_level => {self.confidence_level},
          context_window => {self.context_window}
        )
        ORDER BY forecast_timestamp
        """
        config = bigquery.QueryJobConfig(
            maximum_bytes_billed=self._maximum_bytes,
            use_query_cache=False,
            query_parameters=[
                bigquery.ArrayQueryParameter("dates", "DATE", list(dates)),
                bigquery.ArrayQueryParameter("demand", "FLOAT64", [float(value) for value in history]),
            ],
        )
        job = self._client.query(query, job_config=config, location=self._location)
        rows = list(job.result())
        self.last_cache_hit = bool(job.cache_hit)
        if not rows:
            raise RuntimeError("TimesFM returned no forecast")
        if rows[0].ai_forecast_status:
            raise RuntimeError(f"TimesFM forecast failed: {rows[0].ai_forecast_status}")
        return [max(0.0, float(row.forecast_value)) for row in rows]
