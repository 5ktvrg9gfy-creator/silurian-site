from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from forecast_engine import BaselineProvider, ForecastError, TimesFMProvider, analyse, analyse_portfolio, parse_demand_csv, parse_portfolio_csv


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


def get_provider():
    global _provider
    if _provider is None:
        name = os.getenv("FORECAST_PROVIDER", "baseline").lower()
        if name == "bigquery_timesfm":
            from bigquery_timesfm import BigQueryTimesFMProvider

            _provider = BigQueryTimesFMProvider()
        else:
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


@app.post("/api/analyse")
async def run_analysis(
    file: UploadFile = File(...),
    horizon: int = Form(13),
    current_inventory: float = Form(...),
    confirmed_inbound: float = Form(0),
    safety_stock: float = Form(...),
):
    if file.content_type not in {"text/csv", "application/vnd.ms-excel", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="Upload a CSV file")
    raw = await file.read()
    if len(raw) > 2_000_000:
        raise HTTPException(status_code=413, detail="The CSV must be smaller than 2 MB")
    try:
        series = parse_demand_csv(raw)
        return analyse(series, get_provider(), horizon, current_inventory, confirmed_inbound, safety_stock)
    except ForecastError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/analyse-portfolio")
async def run_portfolio_analysis(file: UploadFile = File(...), horizon: int = Form(13)):
    if file.content_type not in {"text/csv", "application/vnd.ms-excel", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="Upload a CSV file")
    raw = await file.read()
    if len(raw) > 2_000_000:
        raise HTTPException(status_code=413, detail="The CSV must be smaller than 2 MB")
    try:
        return analyse_portfolio(parse_portfolio_csv(raw), get_provider(), horizon)
    except ForecastError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

