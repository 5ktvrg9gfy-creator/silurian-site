from __future__ import annotations

from datetime import date
from typing import Any, Sequence

from run_manifest import ManifestError, utc_now


def measure_forecast_determinism(
    provider: Any,
    history: Sequence[float],
    dates: Sequence[date],
    horizon: int,
    *,
    runs: int = 10,
    environment_ref: str,
) -> dict[str, Any]:
    if runs < 2:
        raise ValueError("At least two runs are required")
    outputs: list[list[float]] = []
    cache_hits: list[bool] = []
    for _ in range(runs):
        outputs.append([float(value) for value in provider.forecast(history, horizon, dates)])
        cache_hits.append(bool(getattr(provider, "last_cache_hit", True)))
    if any(cache_hits):
        raise ManifestError("Determinism measurement is invalid because a provider result came from cache")

    reference = outputs[0]
    max_abs_diff = 0.0
    max_pct_diff = 0.0
    zero_denominator_points = 0
    points_compared = 0
    for candidate in outputs[1:]:
        if len(candidate) != len(reference):
            raise ManifestError("The provider returned inconsistent forecast horizons")
        for expected, actual in zip(reference, candidate):
            difference = abs(actual - expected)
            max_abs_diff = max(max_abs_diff, difference)
            points_compared += 1
            if expected == 0:
                zero_denominator_points += 1
            else:
                max_pct_diff = max(max_pct_diff, difference / abs(expected) * 100)

    measured = {
        "runs": runs,
        "provider_cache_disabled": True,
        "max_abs_diff": max_abs_diff,
        "max_pct_diff": max_pct_diff,
        "zero_denominator_rule": "Reference values of zero use absolute difference only and are excluded from percentage statistics.",
        "zero_denominator_points": zero_denominator_points,
        "points_compared": points_compared,
        "measured_at": utc_now(),
        "environment_ref": environment_ref,
    }
    if max_abs_diff == 0:
        return {
            "class": "bitwise",
            "tolerance_pct": None,
            "seed": None,
            "measurement": measured,
            "statement": f"Forecast output was identical across {runs} uncached runs in this deployment.",
        }
    return {
        "class": "tolerant",
        "tolerance_pct": max_pct_diff,
        "seed": None,
        "measurement": measured,
        "statement": f"Forecast output reproduced within {max_pct_diff:.6f}% across {runs} uncached runs in this deployment.",
    }
