from __future__ import annotations

import os
import logging
import json
from datetime import date
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from determinism import measure_forecast_determinism
from forecast_engine import BaselineProvider, DemandSeries, ForecastError, TimesFMProvider, analyse, analyse_portfolio, parse_portfolio_csv
from quality_engine import DEFAULT_THRESHOLDS, QualityOptions, assess_quality
from run_bundle import (
    BundleError,
    build_bundle,
    compare_reproduction,
    forecast_bundle_result,
    quality_bundle_result,
    reopen_bundle,
    validation_bundle_result,
)
from run_manifest import (
    build_manifest,
    forecast_stage,
    model_identity,
    quality_stage,
    reference_check,
    sha256_json,
    source_record,
    utc_now,
    validation_stage,
)
from validator import ValidationOptions, validate_csv


BASE_DIR = Path(__file__).resolve().parent
app = FastAPI(title="Silurian Forecast Diagnostic", version="0.1.0")
origins = [value.strip() for value in os.getenv("ALLOWED_ORIGINS", "http://localhost:8000").split(",") if value.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_provider = None


def _validation_options(raw_options: str, analysis_date: str | None = None) -> ValidationOptions:
    try:
        supplied = json.loads(raw_options or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Validation options must be valid JSON") from exc
    supplied["as_of_date"] = analysis_date or supplied.get("as_of_date") or date.today().isoformat()
    return ValidationOptions.from_value(supplied)


def _validation_response(validation):
    return {
        "verdict": validation.verdict,
        "findings": [finding.to_dict() for finding in validation.findings],
        "run_record": validation.run_record,
    }


def _source_skus(validation) -> list[str]:
    return [str(row.get("sku", "")) for row in validation.normalised_rows]


def _validation_manifest(raw: bytes, filename: str, validation, started_at: str, completed_at: str, as_of_source: str):
    source = source_record(raw, filename, started_at, validation.metadata)
    stage = validation_stage(validation, source, started_at, completed_at)
    manifest = build_manifest(
        source,
        [stage],
        date.fromisoformat(validation.run_record["options"]["as_of_date"]),
        as_of_source,
        _source_skus(validation),
    )
    return manifest, stage, source


REFERENCE_SERIES = [100.0 + (index % 12) * 3.0 + (index // 12) * 2.0 for index in range(36)]
REFERENCE_DATES = [date(2023 + index // 12, index % 12 + 1, 1) for index in range(36)]
REFERENCE_DECIMAL_PLACES = 6


def _forecast_identity(provider, histories: list[list[float]], horizon: int):
    raw_canary_output = provider.forecast(REFERENCE_SERIES, 12, REFERENCE_DATES)
    # BigQuery TimesFM can return immaterial floating-point noise between calls.
    # Quantise only the canary fingerprint, never the forecast delivered to users.
    canary_output = [round(float(value), REFERENCE_DECIMAL_PLACES) for value in raw_canary_output]
    actual_hash = sha256_json(canary_output)
    baseline_hash = os.getenv("TIMESFM_REFERENCE_BASELINE_SHA256", "").strip().lower()
    is_managed = provider.__class__.__name__ == "BigQueryTimesFMProvider"
    if is_managed and len(baseline_hash) != 64:
        raise RuntimeError(
            "The TimesFM reference baseline is not configured. "
            f"Set TIMESFM_REFERENCE_BASELINE_SHA256 to {actual_hash}."
        )
    baseline_hash = baseline_hash or actual_hash
    check = reference_check(REFERENCE_SERIES, canary_output, baseline_hash)
    if check["status"] == "drift_detected":
        raise RuntimeError(
            "The managed forecasting model has changed since the reference baseline was set. "
            f"Current reference output: {actual_hash}."
        )
    if is_managed:
        identity = model_identity(histories, horizon, check, included=len(histories))
    else:
        identity = model_identity(
            histories, horizon, check, included=len(histories),
            family="Silurian statistical baseline", version="1.0",
            provider=provider.name, checkpoint="silurian-baseline-v1",
            backend="python", precision="float64", provider_limitations=[],
        )
    raw_measurement = os.getenv("TIMESFM_DETERMINISM_JSON", "").strip()
    if raw_measurement:
        determinism = json.loads(raw_measurement)
    elif is_managed and os.getenv("TIMESFM_MEASURE_DETERMINISM", "").strip() == "1":
        determinism = measure_forecast_determinism(
            provider,
            REFERENCE_SERIES,
            REFERENCE_DATES,
            12,
            runs=10,
            environment_ref=(
                os.getenv("VERCEL_DEPLOYMENT_ID")
                or os.getenv("VERCEL_GIT_COMMIT_SHA")
                or "vercel-preview"
            ),
        )
    else:
        determinism = {
            "class": "unknown",
            "tolerance_pct": None,
            "seed": None,
            "statement": "Forecast reproducibility has not yet been measured on this deployment.",
        }
    return identity, determinism


def _check_upload(raw: bytes) -> None:
    if len(raw) > 4_000_000:
        raise HTTPException(
            status_code=413,
            detail="This diagnostic accepts files up to 4 MB. Request the top 500 SKUs by value or the last 36 months of history.",
        )


def _series_from_validation(validation) -> DemandSeries:
    rows = [row for row in validation.normalised_rows if row.get("demand") is not None and float(row["demand"]) >= 0]
    skus = {str(row["sku"]) for row in rows}
    if len(skus) != 1:
        raise ForecastError(
            "This file contains multiple products. Use the Portfolio Diagnostic, "
            "or upload a file containing only one SKU."
        )
    if len(rows) < 12:
        # Superseded by forecastability routing in story 2.3.
        raise ForecastError("At least 12 historical periods are required before this forecast can run")
    rows.sort(key=lambda row: (str(row["date"]), int(row["source_row"])))
    if len({str(row["date"]) for row in rows}) != len(rows):
        raise ForecastError("Resolve duplicate periods before this forecast can run")
    return DemandSeries(
        sku=next(iter(skus)),
        dates=[date.fromisoformat(str(row["date"])) for row in rows],
        demand=[float(row["demand"]) for row in rows],
    )


def get_provider(oidc_token: str | None = None):
    global _provider
    name = os.getenv("FORECAST_PROVIDER", "baseline").lower()
    if name == "bigquery_timesfm":
        from bigquery_timesfm import BigQueryTimesFMProvider

        return BigQueryTimesFMProvider(oidc_token or "")
    if _provider is None:
        if name != "bigquery_timesfm":
            _provider = TimesFMProvider() if name == "timesfm" else BaselineProvider()
    return _provider


@app.get("/")
def home():
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/health")
def health():
    return {"status": "ok", "provider": os.getenv("FORECAST_PROVIDER", "baseline")}


@app.get("/sample-data.csv")
def sample_data():
    return FileResponse(BASE_DIR / "sample-data.csv", media_type="text/csv", filename="silurian-sample-demand.csv")


@app.get("/sample-portfolio.csv")
def sample_portfolio():
    return FileResponse(BASE_DIR / "sample-portfolio.csv", media_type="text/csv", filename="silurian-sample-portfolio.csv")


@app.post("/api/validate")
async def validate_upload(file: UploadFile = File(...), validation_options: str = Form("{}")):
    started_at = utc_now()
    raw = await file.read()
    if len(raw) > 4_000_000:
        raise HTTPException(status_code=413, detail="This diagnostic accepts files up to 4 MB. Request the top 500 SKUs by value or the last 36 months of history.")
    validation = validate_csv(raw, _validation_options(validation_options))
    completed_at = utc_now()
    supplied = json.loads(validation_options or "{}")
    manifest, _, _ = _validation_manifest(
        raw, file.filename or "uploaded.csv", validation, started_at, completed_at,
        "user" if supplied.get("as_of_date") else "server_default",
    )
    status_code = 422 if validation.verdict == "reject" else 200
    return JSONResponse(status_code=status_code, content={"validation": _validation_response(validation), "manifest": manifest})


@app.post("/api/quality")
async def quality_upload(
    file: UploadFile = File(...),
    analysis_date: str | None = Form(None),
    grain: str | None = Form(None),
    validation_options: str = Form("{}"),
):
    validation_started = utc_now()
    raw = await file.read()
    _check_upload(raw)
    try:
        effective_date = date.fromisoformat(analysis_date) if analysis_date else date.today()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Analysis date must use YYYY-MM-DD format") from exc
    if grain and grain not in {"day", "week", "month"}:
        raise HTTPException(status_code=400, detail="Grain must be day, week or month")
    validation = validate_csv(raw, _validation_options(validation_options, effective_date.isoformat()))
    validation_completed = utc_now()
    validation_manifest, validation_record, source = _validation_manifest(
        raw, file.filename or "uploaded.csv", validation, validation_started, validation_completed,
        "user" if analysis_date else "server_default",
    )
    if validation.verdict == "reject":
        return JSONResponse(status_code=422, content={"detail": "Resolve the validation findings before assessing data quality.", "validation": _validation_response(validation), "manifest": validation_manifest})
    quality_started = utc_now()
    quality = assess_quality(validation, QualityOptions(
        as_of_date=effective_date,
        as_of_date_source="user_supplied" if analysis_date else "server_default",
        grain=grain,
        thresholds=dict(DEFAULT_THRESHOLDS),
    ))
    quality_completed = utc_now()
    quality_record = quality_stage(quality.to_dict(), validation_record["output_ref"], quality_started, quality_completed)
    manifest = build_manifest(
        source,
        [validation_record, quality_record],
        effective_date,
        "user" if analysis_date else "server_default",
        _source_skus(validation),
    )
    quality_payload = quality.to_dict()
    bundle = build_bundle(manifest, {
        "validation": validation_bundle_result(validation, validation_record),
        "quality": quality_bundle_result(quality_payload),
    }, file.filename or "uploaded.csv")
    return {"validation": _validation_response(validation), "quality": quality_payload, "manifest": manifest, "bundle": bundle}


@app.post("/api/analyse")
async def run_analysis(
    request: Request,
    file: UploadFile = File(...),
    horizon: int = Form(13),
    current_inventory: float = Form(...),
    confirmed_inbound: float = Form(0),
    safety_stock: float = Form(...),
    product_description: str = Form(""),
    lifecycle_stage: str = Form("Established"),
    adjustment_percent: float = Form(0),
    adjustment_start: int = Form(1),
    adjustment_end: int = Form(52),
    adjustment_reason: str = Form(""),
    validation_options: str = Form("{}"),
):
    validation_started = utc_now()
    raw = await file.read()
    if len(raw) > 4_000_000:
        raise HTTPException(status_code=413, detail="This diagnostic accepts files up to 4 MB. Request the top 500 SKUs by value or the last 36 months of history.")
    try:
        validation = validate_csv(raw, _validation_options(validation_options))
        validation_completed = utc_now()
        validation_manifest, validation_record, source = _validation_manifest(
            raw, file.filename or "uploaded.csv", validation, validation_started, validation_completed, "server_default"
        )
        if validation.verdict == "reject":
            return JSONResponse(status_code=422, content={"detail": "The file cannot proceed until the validation findings are resolved.", "validation": _validation_response(validation), "manifest": validation_manifest})
        series = _series_from_validation(validation)
        provider = get_provider(request.headers.get("x-vercel-oidc-token"))
        forecast_started = utc_now()
        result = analyse(
            series,
            provider,
            horizon,
            current_inventory,
            confirmed_inbound,
            safety_stock,
            product_description=product_description,
            lifecycle_stage=lifecycle_stage,
            adjustment_percent=adjustment_percent,
            adjustment_start=adjustment_start,
            adjustment_end=adjustment_end,
            adjustment_reason=adjustment_reason,
        )
        identity, determinism = _forecast_identity(provider, [series.demand], horizon)
        forecast_completed = utc_now()
        forecast_record = forecast_stage(
            result, validation_record["output_ref"], identity, determinism, forecast_started, forecast_completed
        )
        manifest = build_manifest(
            source, [validation_record, forecast_record], date.today(), "server_default", _source_skus(validation)
        )
        result["validation"] = _validation_response(validation)
        result["manifest"] = manifest
        result["bundle"] = build_bundle(manifest, {
            "validation": validation_bundle_result(validation, validation_record),
            "forecast": forecast_bundle_result(result),
        }, file.filename or "uploaded.csv")
        return result
    except ForecastError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logging.exception("TimesFM analysis failed")
        raise HTTPException(status_code=503, detail="TimesFM analysis could not be completed") from exc


@app.post("/api/analyse-portfolio")
async def run_portfolio_analysis(
    request: Request,
    file: UploadFile = File(...),
    horizon: int = Form(13),
    validation_options: str = Form("{}"),
):
    validation_started = utc_now()
    raw = await file.read()
    if len(raw) > 4_000_000:
        raise HTTPException(status_code=413, detail="This diagnostic accepts files up to 4 MB. Request the top 500 SKUs by value or the last 36 months of history.")
    try:
        validation = validate_csv(raw, _validation_options(validation_options))
        validation_completed = utc_now()
        validation_manifest, validation_record, source = _validation_manifest(
            raw, file.filename or "uploaded.csv", validation, validation_started, validation_completed, "server_default"
        )
        if validation.verdict == "reject":
            return JSONResponse(status_code=422, content={"detail": "The file cannot proceed until the validation findings are resolved.", "validation": _validation_response(validation), "manifest": validation_manifest})
        items = parse_portfolio_csv(raw)
        provider = get_provider(request.headers.get("x-vercel-oidc-token"))
        forecast_started = utc_now()
        result = analyse_portfolio(
            items,
            provider,
            horizon,
        )
        identity, determinism = _forecast_identity(provider, [item.series.demand for item in items], horizon)
        forecast_completed = utc_now()
        forecast_record = forecast_stage(
            result, validation_record["output_ref"], identity, determinism, forecast_started, forecast_completed
        )
        manifest = build_manifest(
            source, [validation_record, forecast_record], date.today(), "server_default", _source_skus(validation)
        )
        result["validation"] = _validation_response(validation)
        result["manifest"] = manifest
        result["bundle"] = build_bundle(manifest, {
            "validation": validation_bundle_result(validation, validation_record),
            "forecast": forecast_bundle_result(result),
        }, file.filename or "uploaded.csv")
        return result
    except ForecastError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logging.exception("TimesFM portfolio analysis failed")
        raise HTTPException(status_code=503, detail="TimesFM portfolio analysis could not be completed") from exc


@app.post("/api/reopen-bundle")
async def reopen_bundle_upload(file: UploadFile = File(...)):
    raw = await file.read()
    _check_upload(raw)
    try:
        bundle = reopen_bundle(raw)
    except BundleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    current_versions = {"validation": "1.0.0", "quality": "1.0.0", "forecast": "1.0.0"}
    version_differences = [
        {
            "stage": stage["stage"],
            "recorded": stage["engine_version"],
            "current": current_versions[stage["stage"]],
        }
        for stage in bundle["manifest"]["stages"]
        if stage["engine_version"] != current_versions.get(stage["stage"])
    ]
    return {"bundle": bundle, "version_differences": version_differences}


@app.post("/api/reproduce-bundle")
async def reproduce_bundle_upload(
    source_file: UploadFile = File(...),
    bundle_file: UploadFile = File(...),
    analysis_date: str | None = Form(None),
    grain: str | None = Form(None),
    validation_options: str = Form("{}"),
):
    source_raw = await source_file.read()
    bundle_raw = await bundle_file.read()
    _check_upload(source_raw)
    _check_upload(bundle_raw)
    try:
        original = reopen_bundle(bundle_raw)
    except BundleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    original_stages = [stage["stage"] for stage in original["manifest"]["stages"]]
    if original_stages not in (["validation"], ["validation", "quality"]):
        raise HTTPException(status_code=400, detail="This first Story 1.4 release reproduces validation and quality bundles. Forecast comparison remains available in the bundle contract and automated checks.")
    try:
        effective_date = date.fromisoformat(analysis_date) if analysis_date else date.fromisoformat(original["manifest"]["as_of_date"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Analysis date must use YYYY-MM-DD format") from exc
    validation_started = utc_now()
    validation = validate_csv(source_raw, _validation_options(validation_options, effective_date.isoformat()))
    validation_completed = utc_now()
    _, validation_record, source = _validation_manifest(
        source_raw, source_file.filename or "uploaded.csv", validation, validation_started, validation_completed,
        original["manifest"]["as_of_source"],
    )
    stages = [validation_record]
    results = {"validation": validation_bundle_result(validation, validation_record)}
    if "quality" in original_stages and validation.verdict != "reject":
        quality_started = utc_now()
        quality = assess_quality(validation, QualityOptions(
            as_of_date=effective_date,
            as_of_date_source="user_supplied" if analysis_date else original["manifest"]["as_of_source"],
            grain=grain,
            thresholds=dict(DEFAULT_THRESHOLDS),
        )).to_dict()
        quality_completed = utc_now()
        quality_record = quality_stage(quality, validation_record["output_ref"], quality_started, quality_completed)
        stages.append(quality_record)
        results["quality"] = quality_bundle_result(quality)
    manifest = build_manifest(
        source, stages, effective_date, original["manifest"]["as_of_source"], _source_skus(validation)
    )
    candidate = build_bundle(manifest, results, source_file.filename or "uploaded.csv")
    reproduction = compare_reproduction(original, candidate)
    return {"reproduction": reproduction, "candidate_manifest": manifest}
