from __future__ import annotations

from copy import deepcopy
from typing import Any


"""Story 2.2 routing: record a decision, a reason and a refusal state.

Routing runs nothing and computes nothing. It reads the demand class that
classification owns and the band, findings and SERIES_DISCONTINUED flag that
quality owns, then writes one decision per line from a closed set of seven.
Every number a reason names is copied unchanged from the stage that owns it.
"""


ROUTING_SCHEMA_VERSION = "1.0"
ROUTING_TABLE_VERSION = "1.2"

DECISIONS: dict[str, bool] = {
    "model_eligible": True,
    "model_eligible_wide_interval": True,
    "intermittent_methods": True,
    "policy_only": False,
    "insufficient_evidence": False,
    "refused_data_quality": False,
    "discontinued_confirm_status": False,
}

CLASS_TABLE: dict[str, str] = {
    "smooth": "model_eligible",
    "erratic": "model_eligible_wide_interval",
    "intermittent": "intermittent_methods",
    "lumpy": "policy_only",
    "unclassifiable": "insufficient_evidence",
}

REFUSAL_CODES: dict[str, str] = {
    "discontinued_confirm_status": "DISCONTINUED",
    "refused_data_quality": "REFUSED_DATA_QUALITY",
    "insufficient_evidence": "INSUFFICIENT_EVIDENCE",
}

RESOLUTION_VOCABULARY: dict[str, tuple[str, ...]] = {
    "DISCONTINUED": (
        "DISCONTINUED_CONFIRMED",
        "SUPERSEDED_BY_SKU",
        "STILL_ACTIVE_DEMAND_GAP",
        "STILL_ACTIVE_DATA_MISSING",
        "DEFER",
    ),
    "REFUSED_DATA_QUALITY": (
        "SUPPLY_LONGER_HISTORY",
        "SUPPLY_CORRECTED_EXTRACT",
        "TREAT_AS_NEW_LINE",
        "EXCLUDE_FROM_SCOPE",
        "DEFER",
    ),
    "INSUFFICIENT_EVIDENCE": (
        "SUPPLY_LONGER_HISTORY",
        "TREAT_AS_NEW_LINE",
        "EXCLUDE_FROM_SCOPE",
        "DEFER",
    ),
}

PRECEDENCE: tuple[str, ...] = (
    "1. A line carrying SERIES_DISCONTINUED routes to discontinued_confirm_status, whatever its class and whatever its band.",
    "2. Otherwise a not_usable band routes to refused_data_quality, whatever its class.",
    "3. Otherwise the demand class decides, including unclassifiable to insufficient_evidence.",
)

DISCONTINUED_CODE = "SERIES_DISCONTINUED"
NOT_USABLE_BAND = "not_usable"

# Quality codes that accompany the conditions under which the quality engine
# bands a line not usable. Routing does not recompute those conditions; it
# names the codes already present on the line so the refusal shows its source.
NOT_USABLE_DRIVER_CODES = ("HISTORY_TOO_SHORT", "ZERO_VS_MISSING_AMBIGUOUS", "GAP_BLOCK", DISCONTINUED_CODE)


class RoutingError(ValueError):
    pass


def _metric(findings: list[dict[str, Any]], code: str, key: str) -> Any:
    for finding in findings:
        if finding.get("code") == code:
            return finding.get("metric", {}).get(key)
    return None


def _not_usable_detail(findings: list[dict[str, Any]], codes: list[str]) -> str:
    parts: list[str] = []
    for code in codes:
        if code == "HISTORY_TOO_SHORT":
            span = _metric(findings, code, "span_periods")
            parts.append(f"{span} periods of history" if span is not None else "a short history")
        elif code == "ZERO_VS_MISSING_AMBIGUOUS":
            coverage = _metric(findings, code, "coverage_pct")
            parts.append(f"{coverage:.1f}% of periods carry a row" if coverage is not None else "omitted periods that may be zero or missing")
        elif code == "GAP_BLOCK":
            longest = _metric(findings, code, "longest_gap")
            parts.append(f"a block of {longest} missing periods" if longest is not None else "a block of missing periods")
        else:
            parts.append(code.replace("_", " ").lower())
    return ", ".join(parts)


def _class_reason(demand_class: str, item: dict[str, Any]) -> str:
    present = int(item["periods_present"])
    non_zero = int(item["non_zero_periods"])
    adi = item["adi"]
    cv_squared = item["cv_squared_nonzero"]
    if demand_class == "smooth":
        return (
            f"Demand arrives in {non_zero} of {present} periods at a stable size (ADI {adi:.2f}, CV squared {cv_squared:.3f}), "
            "so a model and the statistical baselines can both run."
        )
    if demand_class == "erratic":
        return (
            f"Demand arrives in {non_zero} of {present} periods but its size swings hard (ADI {adi:.2f}, CV squared {cv_squared:.3f}), "
            "so the interval is the useful output and the point number is not."
        )
    if demand_class == "intermittent":
        return (
            f"Demand arrives in {non_zero} of {present} periods with regular gaps (ADI {adi:.2f}) at a consistent size "
            f"(CV squared {cv_squared:.3f}), which needs the Croston family rather than a general model."
        )
    if demand_class == "lumpy":
        return (
            f"Demand arrives in {non_zero} of {present} periods (ADI {adi:.2f}) and its size varies widely (CV squared {cv_squared:.3f}), "
            "so no statistical method will forecast it well."
        )
    return f"Only {non_zero} non-zero observations in {present} periods, too few to describe a pattern."


def _validate_resolution(sku: str, line: dict[str, Any], supplied: dict[str, Any], present_skus: set[str]) -> dict[str, Any]:
    refusal = line["refusal"]
    if refusal is None:
        raise RoutingError(f"A resolution was supplied for a line that is not refused: {line['decision']}")
    if not isinstance(supplied, dict) or not supplied.get("code"):
        raise RoutingError("A routing resolution requires a code")
    code = str(supplied["code"])
    if code not in refusal["resolution_options"]:
        raise RoutingError(f"{code} is not a resolution option for {refusal['code']}")
    successor = supplied.get("successor_sku")
    if code == "SUPERSEDED_BY_SKU":
        if not successor or str(successor) not in present_skus or str(successor) == sku:
            raise RoutingError("SUPERSEDED_BY_SKU requires a successor SKU selected from the SKUs present in the file")
    elif successor:
        raise RoutingError("A successor SKU is only accepted with SUPERSEDED_BY_SKU")
    note = supplied.get("note")
    if note is not None and not isinstance(note, str):
        raise RoutingError("A resolution note must be text")
    return {"code": code, "successor_sku": str(successor) if successor else None, "note": note or None}


def route_portfolio(
    quality_result: dict[str, Any],
    classification_result: dict[str, Any],
    resolutions: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Record one routing decision per SKU from the quality and classification results.

    The inputs are read only. Nothing in them is recomputed, corrected or
    re-banded, and the returned result carries no metric of its own.
    """
    quality_by_sku = {str(row["sku"]): row for row in quality_result.get("skus", [])}
    per_class = classification_result.get("per_sku", {})
    missing = set(per_class) ^ set(quality_by_sku)
    if missing:
        raise RoutingError("Quality and classification results describe different SKUs")

    per_sku: dict[str, dict[str, Any]] = {}
    for sku, item in per_class.items():
        quality_row = quality_by_sku[sku]
        band = str(quality_row["band"])
        findings = list(quality_row.get("findings", []))
        codes = [str(finding["code"]) for finding in findings]
        demand_class = str(item["demand_class"])
        if demand_class not in CLASS_TABLE:
            raise RoutingError(f"Unknown demand class {demand_class}")

        if DISCONTINUED_CODE in codes:
            decision, decided_by = "discontinued_confirm_status", "discontinued, rule 1"
            trailing = _metric(findings, DISCONTINUED_CODE, "trailing_periods")
            reason = (
                f"No demand for {trailing} periods before the portfolio cut-off, "
                "so there is nothing to forecast forward until the status is confirmed."
            )
            driven_by = [DISCONTINUED_CODE]
        elif band == NOT_USABLE_BAND:
            decision, decided_by = "refused_data_quality", "not usable, rule 2"
            driven_by = [code for code in codes if code in NOT_USABLE_DRIVER_CODES] or [code for code in codes if code != "VOLUME_IMMATERIAL"]
            detail = _not_usable_detail(findings, driven_by)
            reason = (
                f"The quality stage bands this line not usable ({detail}), "
                "so no method may run until the data is corrected."
            )
        else:
            decision, decided_by = CLASS_TABLE[demand_class], "class table, rule 3"
            reason = _class_reason(demand_class, item)
            driven_by = []

        refusal_code = REFUSAL_CODES.get(decision)
        refusal = None
        if refusal_code:
            refusal = {
                "code": refusal_code,
                "driven_by_finding_codes": driven_by,
                "resolution_options": list(RESOLUTION_VOCABULARY[refusal_code]),
            }
        evidence: dict[str, Any] = {
            "adi": item["adi"],
            "cv_squared_nonzero": item["cv_squared_nonzero"],
            "non_zero_periods": item["non_zero_periods"],
            "periods_present": item["periods_present"],
        }
        for finding in findings:
            metric = finding.get("metric", {})
            if finding["code"] == DISCONTINUED_CODE and "trailing_periods" in metric:
                evidence["trailing_periods"] = metric["trailing_periods"]
            if finding["code"] == "HISTORY_TOO_SHORT" and "span_periods" in metric:
                evidence["span_periods"] = metric["span_periods"]
            if finding["code"] == "ZERO_VS_MISSING_AMBIGUOUS" and "coverage_pct" in metric:
                evidence["coverage_pct"] = metric["coverage_pct"]
        per_sku[sku] = {
            "demand_class": demand_class,
            "abc_volume_class": item["abc_volume_class"],
            "volume_share_pct": item["volume_share_pct"],
            "rank_by_volume": item["rank_by_volume"],
            "quality_band_at_decision": band,
            "quality_finding_codes_referenced": codes,
            "caveat_codes_shown": codes if band == "caveated" else [],
            "engine_resolvable_flag": quality_row.get("resolvable"),
            "decision": decision,
            "decided_by": decided_by,
            "forecast_eligible": DECISIONS[decision],
            "reason": reason,
            "refusal": refusal,
            "resolution": None,
            "evidence": evidence,
        }

    present_skus = set(per_sku)
    for sku, supplied in (resolutions or {}).items():
        if sku not in per_sku:
            raise RoutingError("A resolution was supplied for a SKU that is not in the file")
        per_sku[sku]["resolution"] = _validate_resolution(sku, per_sku[sku], supplied, present_skus)

    decision_counts = {name: 0 for name in DECISIONS}
    decision_volume = {name: 0.0 for name in DECISIONS}
    refusal_counts = {code: 0 for code in RESOLUTION_VOCABULARY}
    resolution_counts: dict[str, int] = {}
    open_items: list[str] = []
    eligible_volume = 0.0
    for sku in sorted(per_sku, key=lambda name: (per_sku[name]["rank_by_volume"], name)):
        line = per_sku[sku]
        decision_counts[line["decision"]] += 1
        decision_volume[line["decision"]] += float(line["volume_share_pct"])
        if line["forecast_eligible"]:
            eligible_volume += float(line["volume_share_pct"])
        if line["refusal"]:
            refusal_counts[line["refusal"]["code"]] += 1
            resolution = line["resolution"]
            if resolution:
                resolution_counts[resolution["code"]] = resolution_counts.get(resolution["code"], 0) + 1
            if resolution is None or resolution["code"] == "DEFER":
                open_items.append(sku)
    total_volume = sum(decision_volume.values())
    eligible_count = sum(1 for line in per_sku.values() if line["forecast_eligible"])
    portfolio = {
        "sku_count": len(per_sku),
        "decision_counts": decision_counts,
        "volume_share_by_decision_pct": {name: round(decision_volume[name], 6) for name in DECISIONS},
        "eligible_count": eligible_count,
        "ineligible_count": len(per_sku) - eligible_count,
        "forecast_eligible_volume_share_pct": round(eligible_volume, 6),
        "not_eligible_volume_share_pct": round(total_volume - eligible_volume, 6),
        "refusal_code_counts": refusal_counts,
        "resolution_code_counts": dict(sorted(resolution_counts.items())),
        "open_item_count": len(open_items),
        "open_items": open_items,
    }
    return {
        "schema_version": ROUTING_SCHEMA_VERSION,
        "routing_table_version": ROUTING_TABLE_VERSION,
        "decisions": {name: {"forecast_eligible": eligible} for name, eligible in DECISIONS.items()},
        "precedence": list(PRECEDENCE),
        "resolution_vocabulary": {code: list(options) for code, options in RESOLUTION_VOCABULARY.items()},
        "per_sku": per_sku,
        "portfolio": portfolio,
        "method_note": (
            "Routing records a decision and runs no method. The demand class is read from the classification result and the "
            "band, findings and discontinuation flag from the quality result; routing recomputes none of them. A caveated band "
            "attaches to the decision and never reroutes. ABC volume class and the portfolio band never affect a line decision. "
            "A resolution changes what happens to a line next and never changes its quality band. Quality codes named inside a "
            "refusal are references to the quality result, not findings raised by routing."
        ),
    }
