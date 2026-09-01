from __future__ import annotations

from copy import deepcopy
from typing import Any


DEFAULT_CLASSIFICATION_THRESHOLDS: dict[str, Any] = {
    "adi_cut": 1.32,
    "cv_squared_cut": 0.49,
    "cv_squared_estimator": "population",
    "cv_squared_min_nonzero_observations": 3,
    "cv_squared_basis": "non_zero_periods_only",
    "abc_basis": "volume",
    "abc_a_cumulative_pct": 80,
    "abc_b_cumulative_pct": 95,
    "xyz_basis": "cv_all_periods",
    "xyz_x_max_cv": 0.5,
    "xyz_y_max_cv": 1,
    "xyz_min_periods_present": 3,
}

DEMAND_CLASSES = ("smooth", "erratic", "intermittent", "lumpy", "unclassifiable")
ABC_CLASSES = ("A", "B", "C")


def _demand_class(adi: float, cv_squared: float | None, non_zero_periods: int) -> tuple[str, str | None]:
    if cv_squared is None:
        reason = (
            "single observation, no variability can be estimated"
            if non_zero_periods == 1
            else f"only {non_zero_periods} non-zero observations, below the minimum of 3"
        )
        return "unclassifiable", reason
    low_adi = adi < DEFAULT_CLASSIFICATION_THRESHOLDS["adi_cut"]
    low_variability = cv_squared < DEFAULT_CLASSIFICATION_THRESHOLDS["cv_squared_cut"]
    if low_adi and low_variability:
        return "smooth", None
    if low_adi:
        return "erratic", None
    if low_variability:
        return "intermittent", None
    return "lumpy", None


def _xyz(cv_all_periods: float, periods_present: int) -> str | None:
    if periods_present < DEFAULT_CLASSIFICATION_THRESHOLDS["xyz_min_periods_present"]:
        return None
    if cv_all_periods <= DEFAULT_CLASSIFICATION_THRESHOLDS["xyz_x_max_cv"]:
        return "X"
    if cv_all_periods <= DEFAULT_CLASSIFICATION_THRESHOLDS["xyz_y_max_cv"]:
        return "Y"
    return "Z"


def _implication(demand_class: str, abc_class: str, volume_share: float) -> str:
    materiality = "material" if abc_class == "A" else "mid-volume" if abc_class == "B" else "long-tail"
    meanings = {
        "smooth": "Demand is frequent and comparatively stable.",
        "erratic": "Demand is frequent but order size varies materially.",
        "intermittent": "Demand arrives infrequently with comparatively stable non-zero orders.",
        "lumpy": "Demand arrives infrequently and non-zero order size also varies materially.",
        "unclassifiable": "There are too few non-zero observations to assign a reliable demand class.",
    }
    return f"{meanings[demand_class]} This is a {materiality} line carrying {volume_share:.2f}% of portfolio volume."


def classify_quality(quality_result: dict[str, Any]) -> dict[str, Any]:
    """Classify demand using metrics already computed by the quality engine."""
    source_rows = quality_result.get("skus", [])
    ranked = sorted(source_rows, key=lambda row: (-float(row["volume_total"]), str(row["sku"])))
    portfolio_volume = sum(float(row["volume_total"]) for row in ranked)
    per_sku: dict[str, dict[str, Any]] = {}
    cumulative = 0.0

    for rank, quality_row in enumerate(ranked, start=1):
        sku = str(quality_row["sku"])
        adi = quality_row["adi"]
        cv_squared = quality_row["cv_squared_nonzero"]
        non_zero_periods = int(quality_row["periods_present"]) - int(quality_row["zero_periods"])
        demand_class, refusal = _demand_class(adi, cv_squared, non_zero_periods)
        volume = float(quality_row["volume_total"])
        share = 100 * volume / portfolio_volume if portfolio_volume else 0.0
        cumulative += share
        abc_class = (
            "A" if cumulative <= DEFAULT_CLASSIFICATION_THRESHOLDS["abc_a_cumulative_pct"]
            else "B" if cumulative <= DEFAULT_CLASSIFICATION_THRESHOLDS["abc_b_cumulative_pct"]
            else "C"
        )
        periods_present = int(quality_row["periods_present"])
        xyz = _xyz(float(quality_row["cv"]), periods_present)
        meaningful = demand_class in {"smooth", "erratic"}
        item = {
            "first_period": quality_row["first_period"],
            "last_period": quality_row["last_period"],
            "periods_present": periods_present,
            "periods_expected_in_span": int(quality_row["periods_expected_in_span"]),
            "non_zero_periods": non_zero_periods,
            "zero_periods": int(quality_row["zero_periods"]),
            "adi": adi,
            "cv_squared_nonzero": cv_squared,
            "cv_all_periods": quality_row["cv"],
            "demand_class": demand_class,
            "volume_total": quality_row["volume_total"],
            "volume_share_pct": round(share, 6),
            "rank_by_volume": rank,
            "cumulative_volume_share_pct": round(cumulative, 6),
            "abc_volume_class": abc_class,
            "xyz": xyz,
            "xyz_meaningful": meaningful,
            "implication": _implication(demand_class, abc_class, share),
        }
        if refusal:
            item["unclassifiable_reason"] = refusal
        per_sku[sku] = item

    class_counts = {name: 0 for name in DEMAND_CLASSES}
    class_volumes = {name: 0.0 for name in DEMAND_CLASSES}
    abc_counts = {name: 0 for name in ABC_CLASSES}
    matrix = {f"{abc}/{demand}": {"line_count": 0, "volume_share_pct": 0.0} for abc in ABC_CLASSES for demand in DEMAND_CLASSES}
    for item in per_sku.values():
        demand = item["demand_class"]
        abc = item["abc_volume_class"]
        class_counts[demand] += 1
        class_volumes[demand] += item["volume_share_pct"]
        abc_counts[abc] += 1
        cell = matrix[f"{abc}/{demand}"]
        cell["line_count"] += 1
        cell["volume_share_pct"] += item["volume_share_pct"]

    for cell in matrix.values():
        cell["volume_share_pct"] = round(cell["volume_share_pct"], 6)
    portfolio = {
        "sku_count": len(per_sku),
        "volume_total": round(portfolio_volume, 6),
        "class_counts": class_counts,
        "volume_share_by_class_pct": {name: round(class_volumes[name], 6) for name in DEMAND_CLASSES},
        "abc_counts": abc_counts,
        "xyz_meaningful_count": sum(1 for item in per_sku.values() if item["xyz_meaningful"]),
    }
    return {
        "schema_version": "1.0",
        "thresholds": deepcopy(DEFAULT_CLASSIFICATION_THRESHOLDS),
        "per_sku": per_sku,
        "portfolio": portfolio,
        "matrix": matrix,
        "method_note": (
            "ADI and CV squared are consumed unchanged from the quality result. CV squared uses the population estimator "
            "on non-zero periods and is null below three non-zero observations. ABC is based on cumulative volume because "
            "cost is not yet available. Quality bands and findings remain in the quality result and must be joined by SKU for display."
        ),
    }
