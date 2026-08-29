# Silurian Forecast Diagnostic

Low-cost hosted application foundation for the Silurian forecast and inventory risk diagnostic.

## Current stage

The application accepts single-SKU and portfolio CSV files, validates the history, runs statistical baselines and converts the forecast into an inventory-risk assessment. TimesFM 2.5 is implemented as an optional provider but remains disabled by default.

No database is used. Uploaded files are held in memory for the request and are not deliberately retained.

## CSV format

Required columns:

```csv
sku,date,demand
SLR-101,2026-01-05,1010
```

Dates use `YYYY-MM-DD`. The first demonstration accepts one SKU and requires at least 12 periods.

## Run the no-cost baseline locally

```text
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/uvicorn app:app --reload
```

Open `http://localhost:8000` and upload `sample-data.csv`.

## Enable TimesFM

Install `requirements-timesfm.txt` and set `FORECAST_PROVIDER=timesfm` before starting the app. The first run downloads the Google Research model weights.

### Platform note

The official PyTorch dependency is not currently available for native Windows ARM through PyPI. The baseline application runs on Windows ARM, but TimesFM must be tested and hosted in an x86-64 Linux environment. The included container is designed for that deployment target.

## BigQuery TimesFM connector

The production-oriented connector uses BigQuery's built-in TimesFM 2.5 model through `AI.FORECAST`. It is dormant unless explicitly enabled. Do not add credentials to this repository.

Required server-side environment variables:

- `FORECAST_PROVIDER=bigquery_timesfm`
- `GOOGLE_CLOUD_PROJECT`: the Google Cloud project ID
- `GCP_PROJECT_NUMBER`: the numeric Google Cloud project identifier
- `GCP_WORKLOAD_IDENTITY_POOL_ID`: the workload identity pool trusted by Vercel
- `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`: the Vercel identity provider
- `GCP_SERVICE_ACCOUNT_EMAIL`: the restricted service account impersonated with a short-lived token
- `BIGQUERY_LOCATION`: defaults to `europe-west2`
- `BIGQUERY_MAX_BYTES_BILLED`: defaults to `10000000` bytes per query
- `TIMESFM_REFERENCE_BASELINE_SHA256`: the approved synthetic canary output hash
- `TIMESFM_DETERMINISM_JSON`: the ten-run, uncached measurement result
- `APP_VERSION`: the deployed application version recorded in every manifest

The service account should receive only the permissions required to run BigQuery jobs and access approved forecasting data. Configure a Google Cloud budget and alerts before enabling the connector. The browser never receives Google credentials. Keep the statistical baseline active until the connector has passed an authenticated test.

Every BigQuery forecast explicitly requests a 512-point context window and disables query caching. The downloaded run manifest records the effective options, model limitations, reference canary, deployment region and measured reproducibility evidence.

## Deployment cost gate

The included Dockerfile can build either the small baseline application or the TimesFM application. Do not deploy the TimesFM image until memory, cold-start time, access control and expected monthly usage have been agreed.

