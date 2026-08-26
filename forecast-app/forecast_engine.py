from __future__ import annotations

import csv
import io
import math
from dataclasses import dataclass
from datetime import date
from statistics import mean
from typing import Protocol, Sequence


class ForecastError(ValueError):
    pass


@dataclass(frozen=True)
class DemandSeries:
    sku: str
    dates: list[date]
    demand: list[float]


@dataclass(frozen=True)
class PortfolioItem:
    series: DemandSeries
    current_inventory: float
    confirmed_inbound: float
    safety_stock: float


class ForecastProvider(Protocol):
    name: str

    def forecast(self, history: Sequence[float], horizon: int) -> list[float]: ...


class BaselineProvider:
    name = "best statistical baseline"

    @staticmethod
    def _candidates(history: Sequence[float], horizon: int) -> dict[str, list[float]]:
        window = min(4, len(history))
        candidates = {
            "naive": [float(history[-1])] * horizon,
            "four-period moving average": [mean(history[-window:])] * horizon,
        }
        if len(history) >= 52:
            candidates["seasonal naive"] = [float(history[-52 + (i % 52)]) for i in range(horizon)]
        return candidates

    def score(self, history: Sequence[float]) -> list[dict[str, float | str]]:
        holdout = min(13, max(1, len(history) // 4))
        train, actual = history[:-holdout], history[-holdout:]
        if len(train) < 4:
            train, actual = history[:-1], history[-1:]
        rows = []
        for name, values in self._candidates(train, len(actual)).items():
            errors = [forecast - observed for forecast, observed in zip(values, actual)]
            absolute_errors = [abs(value) for value in errors]
            actual_total = sum(actual)
            rows.append({
                "method": name,
                "mae": mean(absolute_errors),
                "rmse": math.sqrt(mean(value**2 for value in errors)),
                "wape": (sum(absolute_errors) / actual_total * 100) if actual_total else 0.0,
                "bias": mean(errors),
                "bias_percent": (sum(errors) / actual_total * 100) if actual_total else 0.0,
                "holdout_periods": len(actual),
            })
        return sorted(rows, key=lambda row: (float(row["wape"]), float(row["mae"])))

    def forecast(self, history: Sequence[float], horizon: int) -> list[float]:
        winner = str(self.score(history)[0]["method"])
        return self._candidates(history, horizon)[winner]


class TimesFMProvider:
    name = "TimesFM 2.5"

    def __init__(self) -> None:
        try:
            import numpy as np
            import timesfm
            import torch
        except ImportError as exc:
            raise RuntimeError("TimesFM dependencies are not installed") from exc

        torch.set_float32_matmul_precision("high")
        self._np = np
        self._model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
            "google/timesfm-2.5-200m-pytorch"
        )
        self._model.compile(
            timesfm.ForecastConfig(
                max_context=1024,
                max_horizon=256,
                normalize_inputs=True,
                use_continuous_quantile_head=True,
                force_flip_invariance=True,
                infer_is_positive=True,
                fix_quantile_crossing=True,
            )
        )

    def forecast(self, history: Sequence[float], horizon: int) -> list[float]:
        point, _ = self._model.forecast(
            horizon=horizon,
            inputs=[self._np.asarray(history, dtype=float)],
        )
        return [max(0.0, float(value)) for value in point[0]]


def parse_demand_csv(raw: bytes) -> DemandSeries:
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ForecastError("The CSV must use UTF-8 encoding") from exc

    reader = csv.DictReader(io.StringIO(text))
    required = {"sku", "date", "demand"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise ForecastError("The CSV requires sku, date and demand columns")

    rows: list[tuple[date, float, str]] = []
    for line_number, row in enumerate(reader, start=2):
        try:
            sku = (row.get("sku") or "").strip()
            observed_date = date.fromisoformat((row.get("date") or "").strip())
            demand = float((row.get("demand") or "").strip())
        except (TypeError, ValueError) as exc:
            raise ForecastError(f"Invalid value on CSV line {line_number}") from exc
        if not sku or not math.isfinite(demand) or demand < 0:
            raise ForecastError(f"Invalid value on CSV line {line_number}")
        rows.append((observed_date, demand, sku))

    if len(rows) < 12:
        raise ForecastError("At least 12 historical periods are required")
    skus = {row[2] for row in rows}
    if len(skus) != 1:
        raise ForecastError("The first demo accepts one SKU per upload")
    rows.sort(key=lambda row: row[0])
    if len({row[0] for row in rows}) != len(rows):
        raise ForecastError("Each date must appear only once")
    return DemandSeries(
        sku=rows[0][2],
        dates=[row[0] for row in rows],
        demand=[row[1] for row in rows],
    )


def parse_portfolio_csv(raw: bytes) -> list[PortfolioItem]:
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ForecastError("The CSV must use UTF-8 encoding") from exc

    reader = csv.DictReader(io.StringIO(text))
    required = {"sku", "date", "demand", "inventory", "receipts", "safety_stock"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise ForecastError("The portfolio CSV requires sku, date, demand, inventory, receipts and safety_stock columns")

    grouped: dict[str, list[tuple[date, float, float, float, float]]] = {}
    for line_number, row in enumerate(reader, start=2):
        try:
            sku = (row.get("sku") or "").strip()
            values = (
                date.fromisoformat((row.get("date") or "").strip()),
                float((row.get("demand") or "").strip()),
                float((row.get("inventory") or "").strip()),
                float((row.get("receipts") or "").strip()),
                float((row.get("safety_stock") or "").strip()),
            )
        except (TypeError, ValueError) as exc:
            raise ForecastError(f"Invalid value on CSV line {line_number}") from exc
        if not sku or any(not math.isfinite(value) or value < 0 for value in values[1:]):
            raise ForecastError(f"Invalid value on CSV line {line_number}")
        grouped.setdefault(sku, []).append(values)

    if not grouped:
        raise ForecastError("The portfolio CSV contains no data")
    if len(grouped) > 250:
        raise ForecastError("The demo accepts up to 250 SKUs per upload")

    items = []
    for sku, rows in grouped.items():
        rows.sort(key=lambda row: row[0])
        if len(rows) < 12:
            raise ForecastError(f"SKU {sku} requires at least 12 historical periods")
        if len({row[0] for row in rows}) != len(rows):
            raise ForecastError(f"SKU {sku} contains duplicate dates")
        latest = rows[-1]
        items.append(PortfolioItem(
            series=DemandSeries(sku=sku, dates=[row[0] for row in rows], demand=[row[1] for row in rows]),
            current_inventory=latest[2],
            confirmed_inbound=latest[3],
            safety_stock=latest[4],
        ))
    return items


def analyse_portfolio(items: Sequence[PortfolioItem], provider: ForecastProvider, horizon: int) -> dict:
    results = [analyse(item.series, provider, horizon, item.current_inventory, item.confirmed_inbound, item.safety_stock) for item in items]
    priority = {"RED": 0, "AMBER": 1, "EXCESS": 2, "GREEN": 3}
    results.sort(key=lambda row: (priority[row["risk"]], row["minimum_inventory"]))
    return {
        "total_skus": len(results),
        "red_exceptions": sum(row["risk"] == "RED" for row in results),
        "amber_exceptions": sum(row["risk"] == "AMBER" for row in results),
        "stockout_risks": sum(row["stockout_period"] is not None for row in results),
        "excess_inventory_risks": sum(row["excess_inventory"] for row in results),
        "results": results,
        "disclaimer": "Indicative planning output. Review operational context before acting.",
    }


def analyse(
    series: DemandSeries,
    provider: ForecastProvider,
    horizon: int,
    current_inventory: float,
    confirmed_inbound: float,
    safety_stock: float,
) -> dict:
    if horizon < 1 or horizon > 52:
        raise ForecastError("The forecast horizon must be between 1 and 52 periods")
    if min(current_inventory, confirmed_inbound, safety_stock) < 0:
        raise ForecastError("Inventory inputs cannot be negative")

    baseline = BaselineProvider()
    baseline_scores = baseline.score(series.demand)
    forecast = provider.forecast(series.demand, horizon)
    if len(forecast) != horizon:
        raise RuntimeError("The forecast provider returned the wrong horizon")

    inventory = current_inventory
    receipt_weeks = {min(2, horizon - 1): confirmed_inbound * 0.45}
    receipt_weeks[min(7, horizon - 1)] = receipt_weeks.get(min(7, horizon - 1), 0) + confirmed_inbound * 0.55
    projection = []
    for index, demand in enumerate(forecast):
        inventory += receipt_weeks.get(index, 0) - demand
        projection.append(inventory)

    minimum = min(projection)
    breach = next((index + 1 for index, value in enumerate(projection) if value < safety_stock), None)
    stockout = next((index + 1 for index, value in enumerate(projection) if value < 0), None)
    excess = minimum > safety_stock + mean(forecast) * 8
    if stockout:
        risk, action = "RED", "Intervene"
    elif breach:
        risk, action = "AMBER", "Review"
    elif excess:
        risk, action = "EXCESS", "Review capital"
    else:
        risk, action = "GREEN", "Monitor"

    ranges = []
    for index, value in enumerate(forecast):
        spread = 0.08 + (index / max(1, horizon - 1)) * 0.08
        ranges.append({"lower": max(0, value * (1 - spread)), "median": value, "upper": value * (1 + spread)})

    return {
        "sku": series.sku,
        "provider": provider.name,
        "periods": len(series.demand),
        "horizon": horizon,
        "history": series.demand,
        "history_dates": [value.isoformat() for value in series.dates],
        "forecast": forecast,
        "ranges": ranges,
        "inventory_projection": projection,
        "total_forecast": sum(forecast),
        "average_demand": mean(forecast),
        "minimum_inventory": minimum,
        "safety_stock": safety_stock,
        "safety_stock_breach_period": breach,
        "stockout_period": stockout,
        "excess_inventory": excess,
        "risk": risk,
        "action": action,
        "baseline_scores": baseline_scores,
        "selected_baseline": baseline_scores[0]["method"],
        "backtest_periods": baseline_scores[0]["holdout_periods"],
        "disclaimer": "Indicative planning output. Review operational context before acting.",
    }

