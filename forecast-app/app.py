from __future__ import annotations

import os
import logging
import json
from datetime import date
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from forecast_engine import BaselineProvider, DemandSeries, ForecastError, TimesFMProvider, analyse, analyse_portfolio, parse_portfolio_csv
from quality_engine import DEFAULT_THRESHOLDS, QualityOptions, assess_quality
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
    raw = await file.read()
    if len(raw) > 4_000_000:
        raise HTTPException(status_code=413, detail="This diagnostic accepts files up to 4 MB. Request the top 500 SKUs by value or the last 36 months of history.")
    validation = validate_csv(raw, _validation_options(validation_options))
    status_code = 422 if validation.verdict == "reject" else 200
    return JSONResponse(status_code=status_code, content={"validation": _validation_response(validation)})


@app.post("/api/quality")
async def quality_upload(
    file: UploadFile = File(...),
    analysis_date: str | None = Form(None),
    grain: str | None = Form(None),
    validation_options: str = Form("{}"),
):
    raw = await file.read()
    _check_upload(raw)
    try:
        effective_date = date.fromisoformat(analysis_date) if analysis_date else date.today()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Analysis date must use YYYY-MM-DD format") from exc
    if grain and grain not in {"day", "week", "month"}:
        raise HTTPException(status_code=400, detail="Grain must be day, week or month")
    validation = validate_csv(raw, _validation_options(validation_options, effective_date.isoformat()))
    if validation.verdict == "reject":
        return JSONResponse(status_code=422, content={"detail": "Resolve the validation findings before assessing data quality.", "validation": _validation_response(validation)})
    quality = assess_quality(validation, QualityOptions(
        as_of_date=effective_date,
        as_of_date_source="user_supplied" if analysis_date else "server_default",
        grain=grain,
        thresholds=dict(DEFAULT_THRESHOLDS),
    ))
    return {"validation": _validation_response(validation), "quality": quality.to_dict()}


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
    raw = await file.read()
    if len(raw) > 4_000_000:
        raise HTTPException(status_code=413, detail="This diagnostic accepts files up to 4 MB. Request the top 500 SKUs by value or the last 36 months of history.")
    try:
        validation = validate_csv(raw, _validation_options(validation_options))
        if validation.verdict == "reject":
            return JSONResponse(status_code=422, content={"detail": "The file cannot proceed until the validation findings are resolved.", "validation": _validation_response(validation)})
        series = _series_from_validation(validation)
        result = analyse(
            series,
            get_provider(request.headers.get("x-vercel-oidc-token")),
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
        result["validation"] = _validation_response(validation)
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
    raw = await file.read()
    if len(raw) > 4_000_000:
        raise HTTPException(status_code=413, detail="This diagnostic accepts files up to 4 MB. Request the top 500 SKUs by value or the last 36 months of history.")
    try:
        validation = validate_csv(raw, _validation_options(validation_options))
        if validation.verdict == "reject":
            return JSONResponse(status_code=422, content={"detail": "The file cannot proceed until the validation findings are resolved.", "validation": _validation_response(validation)})
        result = analyse_portfolio(
            parse_portfolio_csv(raw),
            get_provider(request.headers.get("x-vercel-oidc-token")),
            horizon,
        )
        result["validation"] = _validation_response(validation)
        return result
    except ForecastError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logging.exception("TimesFM portfolio analysis failed")
        raise HTTPException(status_code=503, detail="TimesFM portfolio analysis could not be completed") from exc
