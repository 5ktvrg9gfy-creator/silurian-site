from __future__ import annotations

import asyncio
import os
import logging
import json
from datetime import date
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse

from access_gate import (
    COOKIE_NAME,
    FAILURE_DELAY_SECONDS,
    GATE_PATH,
    LOCKED_DETAIL,
    SESSION_SECONDS,
    configured_password,
    cookie_is_valid,
    gate_page,
    is_ungated_path,
    issue_cookie_value,
    log_gate_state,
    password_is_correct,
)
from determinism import measure_forecast_determinism
from classification_engine import classify_quality
from glossary import payload as glossary_payload
from forecast_engine import BaselineProvider, DemandSeries, ForecastError, TimesFMProvider, analyse, analyse_portfolio, parse_portfolio_csv
from quality_engine import DEFAULT_THRESHOLDS, QualityOptions, assess_quality
from routing_engine import RoutingError, route_portfolio
from run_bundle import (
    BundleError,
    build_bundle,
    classification_bundle_result,
    compare_reproduction,
    forecast_bundle_result,
    quality_bundle_result,
    reopen_bundle,
    routing_bundle_result,
    validation_bundle_result,
)
from run_manifest import (
    build_manifest,
    classification_stage,
    forecast_stage,
    model_identity,
    quality_stage,
    reference_check,
    routing_stage,
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


@app.middleware("http")
async def prevent_client_data_caching(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def _locked_response(request: Request):
    """Nothing behind the gate, and nothing about what is behind it.

    An API caller gets JSON so a fetch fails cleanly rather than parsing a login
    page as a result. Everything else gets the gate screen itself, so a planner
    who lands on any URL is asked for the password instead of hitting a dead end.
    """
    headers = {"Cache-Control": "no-store"}
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=401, content={"detail": LOCKED_DETAIL}, headers=headers)
    return HTMLResponse(status_code=401, content=gate_page(), headers=headers)


@app.middleware("http")
async def require_access_password(request: Request, call_next):
    """Added last, so it wraps every other route and serves first.

    The password is read per request rather than at import, so setting it in
    Vercel takes effect on the next request and the test suite can turn the gate
    on and off without reloading the application.
    """
    password = configured_password()
    if password is None:
        return await call_next(request)
    if request.url.path == GATE_PATH or is_ungated_path(request.url.path):
        return await call_next(request)
    if cookie_is_valid(request.cookies.get(COOKIE_NAME), password):
        return await call_next(request)
    return _locked_response(request)


log_gate_state()


@app.exception_handler(Exception)
async def unhandled_diagnostic_error(request: Request, exc: Exception):
    logging.error("Unhandled diagnostic request failed")
    return JSONResponse(
        status_code=500,
        content={"detail": "The diagnostic could not be completed"},
        headers={"Cache-Control": "no-store"},
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


def _all_series_from_validation(validation) -> list[DemandSeries]:
    grouped: dict[str, list[dict]] = {}
    for row in validation.normalised_rows:
        if row.get("demand") is not None and float(row["demand"]) >= 0:
            grouped.setdefault(str(row["sku"]), []).append(row)
    series = []
    for sku, rows in grouped.items():
        rows.sort(key=lambda row: (str(row["date"]), int(row["source_row"])))
        if len(rows) < 12 or len({str(row["date"]) for row in rows}) != len(rows):
            raise ForecastError(f"SKU {sku} cannot be reproduced until its forecast history is unambiguous")
        series.append(DemandSeries(
            sku=sku,
            dates=[date.fromisoformat(str(row["date"])) for row in rows],
            demand=[float(row["demand"]) for row in rows],
        ))
    return series


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


@app.get("/access")
def access_form():
    """The gate screen on its own URL.

    It answers the same way whether or not a gate is configured, so requesting
    it tells a visitor nothing about whether the tool is protected.
    """
    return HTMLResponse(content=gate_page(), headers={"Cache-Control": "no-store"})


@app.post("/access")
async def access_submit(request: Request, password: str = Form("")):
    """The only path the gate lets through.

    A wrong password and an unconfigured gate take the same branch, after the
    same fixed delay, and produce the same words. The submitted value is not
    logged and not echoed.
    """
    configured = configured_password()
    if configured is not None and password_is_correct(password, configured):
        response = RedirectResponse(url="/", status_code=303)
        response.set_cookie(
            COOKIE_NAME,
            issue_cookie_value(configured),
            max_age=SESSION_SECONDS,
            httponly=True,
            samesite="lax",
            secure=request.url.scheme == "https",
            path="/",
        )
        response.headers["Cache-Control"] = "no-store"
        return response
    await asyncio.sleep(FAILURE_DELAY_SECONDS)
    return HTMLResponse(
        status_code=401,
        content=gate_page(error=True),
        headers={"Cache-Control": "no-store"},
    )


@app.get("/")
def home():
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/workspace-assets/{asset_name}")
def workspace_asset(asset_name: str):
    assets = {
        "Archivo-Variable.ttf": (BASE_DIR / "static" / "Archivo-Variable.ttf", "font/ttf"),
        "logo-stone.svg": (BASE_DIR / "static" / "logo-stone.svg", "image/svg+xml"),
    }
    if asset_name not in assets:
        raise HTTPException(status_code=404, detail="Asset not found")
    path, media_type = assets[asset_name]
    return FileResponse(path, media_type=media_type)


@app.get("/health")
def health():
    return {"status": "ok", "provider": os.getenv("FORECAST_PROVIDER", "baseline")}


@app.get("/api/glossary")
def glossary():
    """One source for every specialist term, rendered by the tool and the report."""
    return glossary_payload()


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


def _routing_resolutions(raw_resolutions: str) -> dict:
    if not isinstance(raw_resolutions, str):
        raw_resolutions = "{}"
    try:
        supplied = json.loads(raw_resolutions or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Routing resolutions must be valid JSON") from exc
    if not isinstance(supplied, dict) or not all(isinstance(value, dict) for value in supplied.values()):
        raise HTTPException(status_code=400, detail="Routing resolutions must map a SKU to a resolution record")
    return supplied


def _resolutions_from_bundle(routing_result: dict) -> dict:
    """Rebuild the resolutions a recorded run applied, in pass order, so a reproduction repeats them."""
    resolutions: dict = {}
    per_sku = routing_result.get("per_sku", {})
    for entry in routing_result.get("passes", []):
        sku = entry.get("sku")
        if not sku:
            continue
        recorded = (per_sku.get(sku) or {}).get("resolution") or {}
        resolutions[sku] = {
            "code": entry["code"],
            "applied_at": entry["applied_at"],
            "successor_sku": entry.get("successor_sku"),
            "note": recorded.get("note"),
        }
    return resolutions


@app.post("/api/quality")
async def quality_upload(
    file: UploadFile = File(...),
    analysis_date: str | None = Form(None),
    grain: str | None = Form(None),
    validation_options: str = Form("{}"),
    routing_resolutions: str = Form("{}"),
):
    validation_started = utc_now()
    raw = await file.read()
    _check_upload(raw)
    resolutions = _routing_resolutions(routing_resolutions)
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
    classification_started = utc_now()
    classification_payload = classify_quality(quality.to_dict())
    classification_completed = utc_now()
    classification_record = classification_stage(
        classification_payload,
        quality_record["output_ref"],
        classification_started,
        classification_completed,
    )
    quality_payload = quality.to_dict()
    routing_started = utc_now()
    try:
        routing_payload = route_portfolio(quality_payload, classification_payload, resolutions)
    except RoutingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    routing_completed = utc_now()
    routing_record = routing_stage(
        routing_payload,
        classification_record["output_ref"],
        routing_started,
        routing_completed,
    )
    manifest = build_manifest(
        source,
        [validation_record, quality_record, classification_record, routing_record],
        effective_date,
        "user" if analysis_date else "server_default",
        _source_skus(validation),
    )
    bundle = build_bundle(manifest, {
        "validation": validation_bundle_result(validation, validation_record),
        "quality": quality_bundle_result(quality_payload),
        "classification": classification_bundle_result(classification_payload),
        "routing": routing_bundle_result(routing_payload),
    }, file.filename or "uploaded.csv")
    return {
        "validation": _validation_response(validation),
        "quality": quality_payload,
        "classification_result": classification_payload,
        "routing_result": routing_payload,
        "manifest": manifest,
        "bundle": bundle,
    }


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
        forecast_payload = forecast_bundle_result(result)
        forecast_record = forecast_stage(
            forecast_payload, validation_record["output_ref"], identity, determinism, forecast_started, forecast_completed
        )
        manifest = build_manifest(
            source, [validation_record, forecast_record], date.today(), "server_default", _source_skus(validation)
        )
        result["validation"] = _validation_response(validation)
        result["manifest"] = manifest
        result["bundle"] = build_bundle(manifest, {
            "validation": validation_bundle_result(validation, validation_record),
            "forecast": forecast_payload,
        }, file.filename or "uploaded.csv")
        return result
    except ForecastError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logging.error("TimesFM analysis failed")
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
        forecast_payload = forecast_bundle_result(result)
        forecast_record = forecast_stage(
            forecast_payload, validation_record["output_ref"], identity, determinism, forecast_started, forecast_completed
        )
        manifest = build_manifest(
            source, [validation_record, forecast_record], date.today(), "server_default", _source_skus(validation)
        )
        result["validation"] = _validation_response(validation)
        result["manifest"] = manifest
        result["bundle"] = build_bundle(manifest, {
            "validation": validation_bundle_result(validation, validation_record),
            "forecast": forecast_payload,
        }, file.filename or "uploaded.csv")
        return result
    except ForecastError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logging.error("TimesFM portfolio analysis failed")
        raise HTTPException(status_code=503, detail="TimesFM portfolio analysis could not be completed") from exc


@app.post("/api/reproduce-bundle")
async def reproduce_bundle_upload(
    request: Request,
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
    if original_stages not in (
        ["validation"],
        ["validation", "quality"],
        ["validation", "quality", "classification"],
        ["validation", "quality", "classification", "routing"],
        ["validation", "forecast"],
    ):
        raise HTTPException(status_code=400, detail="This combination of recorded stages is not supported for reproduction")
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
        if "classification" in original_stages:
            classification_started = utc_now()
            classification = classify_quality(quality)
            classification_completed = utc_now()
            classification_record = classification_stage(
                classification,
                quality_record["output_ref"],
                classification_started,
                classification_completed,
            )
            stages.append(classification_record)
            results["classification"] = classification_bundle_result(classification)
            if "routing" in original_stages:
                routing_started = utc_now()
                try:
                    routing = route_portfolio(
                        quality, classification, _resolutions_from_bundle(original["results"].get("routing", {}))
                    )
                except RoutingError as exc:
                    raise HTTPException(status_code=422, detail=str(exc)) from exc
                routing_completed = utc_now()
                routing_record = routing_stage(
                    routing,
                    classification_record["output_ref"],
                    routing_started,
                    routing_completed,
                )
                stages.append(routing_record)
                results["routing"] = routing_bundle_result(routing)
    if "forecast" in original_stages and validation.verdict != "reject":
        forecast_started = utc_now()
        histories = _all_series_from_validation(validation)
        horizon = int(next(stage for stage in original["manifest"]["stages"] if stage["stage"] == "forecast")["options"]["horizon"])
        provider = get_provider(request.headers.get("x-vercel-oidc-token"))
        reproduced_rows = [analyse(item, provider, horizon, 0, 0, 0) for item in histories]
        reproduced = reproduced_rows[0] if len(reproduced_rows) == 1 else {"results": reproduced_rows}
        forecast_payload = forecast_bundle_result(reproduced)
        identity, determinism = _forecast_identity(provider, [item.demand for item in histories], horizon)
        forecast_completed = utc_now()
        forecast_record = forecast_stage(
            forecast_payload, validation_record["output_ref"], identity, determinism, forecast_started, forecast_completed
        )
        stages.append(forecast_record)
        results["forecast"] = forecast_payload
    manifest = build_manifest(
        source, stages, effective_date, original["manifest"]["as_of_source"], _source_skus(validation)
    )
    candidate = build_bundle(manifest, results, source_file.filename or "uploaded.csv")
    reproduction = compare_reproduction(original, candidate)
    return {"reproduction": reproduction, "candidate_manifest": manifest}
