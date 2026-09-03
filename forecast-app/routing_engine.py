from __future__ import annotations

import hashlib
import re
from copy import deepcopy
from datetime import datetime
from typing import Any


"""Story 2.2 routing and Story 2.3 planner action.

Routing runs nothing and computes nothing. It reads the demand class that
classification owns and the band, findings and SERIES_DISCONTINUED flag that
quality owns, then writes one decision per line from a closed set of seven,
the reason for it and the action a planner takes next. Every number a reason
or an action names is copied unchanged from the stage that owns it.

A resolution records an answer and changes scope membership. It never changes
a routing decision or a quality band by assertion.
"""


ROUTING_SCHEMA_VERSION = "1.1"
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

# Story 2.3 section 3. A resolution records an answer and changes scope
# membership. Status: resolved leaves the open items list, data_requested and
# deferred stay on it. The routing decision never moves on any of them.
RESOLUTION_EFFECTS: dict[str, dict[str, Any]] = {
    "DISCONTINUED_CONFIRMED": {
        "status": "resolved",
        "in_forecast_scope": False,
        "flags": ("obsolescence_review", "master_data_review"),
        "consequence": (
            "This line is marked out of forecast scope and leaves the open items list, flagged for obsolescence "
            "and master data review. The routing decision does not change."
        ),
    },
    "SUPERSEDED_BY_SKU": {
        "status": "resolved",
        "in_forecast_scope": False,
        "flags": ("successor_recorded",),
        "consequence": (
            "This line is marked out of forecast scope with the successor recorded as a link, and leaves the open "
            "items list. History is not chained in this run and the routing decision does not change."
        ),
    },
    "STILL_ACTIVE_DEMAND_GAP": {
        "status": "resolved",
        "in_forecast_scope": True,
        "flags": (),
        "consequence": (
            "The answer is recorded and the line leaves the open items list. The decision does not change: "
            "the line may well be alive, but this extract still cannot support a forecast for it."
        ),
    },
    "STILL_ACTIVE_DATA_MISSING": {
        "status": "resolved",
        "in_forecast_scope": True,
        "flags": ("new_extract_required",),
        "consequence": (
            "The answer is recorded, the line leaves the open items list and is flagged as needing a new extract. "
            "The decision does not change in this run."
        ),
    },
    "SUPPLY_LONGER_HISTORY": {
        "status": "data_requested",
        "in_forecast_scope": True,
        "flags": ("data_request",),
        "consequence": (
            "A data request for more periods of history is recorded and the line stays on the open items list "
            "until the data arrives. The decision does not change in this run; a new run with the longer history "
            "is the route to a different answer."
        ),
    },
    "SUPPLY_CORRECTED_EXTRACT": {
        "status": "data_requested",
        "in_forecast_scope": True,
        "flags": ("data_request",),
        "consequence": (
            "A data request for a corrected extract is recorded and the line stays on the open items list until "
            "the extract arrives. The decision does not change in this run; a new run with the corrected extract "
            "is the route to a different answer."
        ),
    },
    "TREAT_AS_NEW_LINE": {
        "status": "resolved",
        "in_forecast_scope": False,
        "flags": ("launch_line",),
        "consequence": (
            "This line is marked as a launch line, out of statistical scope, and leaves the open items list. "
            "Sprint 3 decides what a launch route does. The routing decision does not change."
        ),
    },
    "EXCLUDE_FROM_SCOPE": {
        "status": "resolved",
        "in_forecast_scope": False,
        "flags": (),
        "consequence": "This line is marked out of scope and leaves the open items list. The routing decision does not change.",
    },
    "DEFER": {
        "status": "deferred",
        "in_forecast_scope": True,
        "flags": (),
        "consequence": "Nothing changes. The line stays on the open items list.",
    },
}

OPEN_STATUSES = ("unresolved", "data_requested", "deferred")

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

# Which stage produced each statement on a line. Shown beside the statement so
# a disagreement between two numbers on one screen is readable from the screen.
STATEMENT_SOURCES: dict[str, str] = {
    "decision": "routing",
    "decided_by": "routing",
    "reason": "routing",
    "action": "routing",
    "forecast_eligible": "routing",
    "refusal": "routing",
    "resolution": "routing",
    "in_forecast_scope": "routing",
    "quality_band_at_decision": "quality",
    "quality_finding_codes_referenced": "quality",
    "caveat_codes_shown": "quality",
    "engine_resolvable_flag": "quality",
    "demand_class": "classification",
    "abc_volume_class": "classification",
    "volume_share_pct": "classification",
    "rank_by_volume": "classification",
    "evidence.adi": "quality, reused unchanged by classification",
    "evidence.cv_squared_nonzero": "quality, reused unchanged by classification",
    "evidence.non_zero_periods": "classification",
    "evidence.periods_present": "quality",
    "evidence.trailing_periods": "quality",
    "evidence.span_periods": "quality",
    "evidence.coverage_pct": "quality",
}


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


def _action(decision: str, item: dict[str, Any], findings: list[dict[str, Any]], driven_by: list[str], resolvable: bool | None, thresholds: dict[str, Any]) -> str:
    """The do this: the planner's next move, written against Story 2.3 section 2.

    It names no method beyond the decision families and repeats no sentence
    from the reason or the classification implication.
    """
    present = int(item["periods_present"])
    non_zero = int(item["non_zero_periods"])
    if decision == "model_eligible":
        return (
            "Nothing to decide. This line goes into the forecast comparison, and what it is worth comes from the "
            "accuracy work in sprint 3."
        )
    if decision == "model_eligible_wide_interval":
        return (
            f"{non_zero} of {present} periods carry demand, so forecast the range rather than the number. "
            "Size the buffer from the spread and the service level you have promised, and expect the monthly "
            "figure to be wrong in both directions. Chasing the average here adds work and no accuracy."
        )
    if decision == "intermittent_methods":
        return (
            f"{non_zero} of {present} periods carried demand, so this is an order-cycle conversation. Ask the customer how "
            "they actually order, then decide whether a min-max, a call-off schedule or a consignment arrangement fits "
            "better than a monthly forecast."
        )
    if decision == "policy_only":
        return (
            f"{non_zero} of {present} periods carry demand and no forecasting method will predict this line, so the "
            "answer is an arrangement rather than a number. Pick one: agree committed volumes with the customer, "
            "make to order against an agreed lead time, or hold a buffer you have priced and accepted. "
            "Start by asking the customer how they actually order."
        )
    if decision == "insufficient_evidence":
        return (
            f"{non_zero} non-zero observations is a scoping decision, not a forecasting one. Either supply more history, "
            "forecast it by analogue to a comparable line, or take it out of scope for this engagement and say so."
        )
    if decision == "refused_data_quality":
        requests: list[str] = []
        for code in driven_by:
            if code == "HISTORY_TOO_SHORT":
                span = _metric(findings, code, "span_periods")
                needed = thresholds.get("history_short_periods")
                if resolvable is False:
                    requests.append(
                        f"confirmation that this line is genuinely new, since {span} periods of history"
                        f"{f' cannot be lengthened to the {needed} the quality stage looks for' if needed else ' cannot be lengthened'} "
                        "without more time"
                    )
                else:
                    requests.append(f"more periods of history, from {span} towards {needed}" if needed else f"more periods of history than the {span} supplied")
            elif code == "ZERO_VS_MISSING_AMBIGUOUS":
                coverage = _metric(findings, code, "coverage_pct")
                requests.append(
                    f"a corrected extract that records whether the omitted periods were zero demand or missing rows, "
                    f"since only {coverage:.1f}% of periods carry a row"
                )
            elif code == "GAP_BLOCK":
                longest = _metric(findings, code, "longest_gap")
                requests.append(f"a corrected extract that recovers the block of {longest} missing periods")
            else:
                requests.append(f"a corrected extract that settles {code.replace('_', ' ').lower()}")
        request = "; ".join(requests) if requests else "more periods, a corrected extract, or confirmation that this line is genuinely new"
        return f"Make a data request, and name it: {request}."
    trailing = _metric(findings, DISCONTINUED_CODE, "trailing_periods")
    lead = f"{trailing} periods without demand is a status question for the business" if trailing is not None else "This is a status question for the business"
    return (
        f"{lead}: ask whether this line is finished. If it is, take it out of the master data and the stock "
        "holding as well, which is usually where the money is."
    )


def _sentences(text: str) -> set[str]:
    return {part.strip().lower() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()}


def _parse_timestamp(value: Any) -> str:
    if not isinstance(value, str) or not value:
        raise RoutingError("A routing resolution requires the time it was applied")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RoutingError("A routing resolution timestamp must be ISO 8601") from exc
    if parsed.tzinfo is None:
        raise RoutingError("A routing resolution timestamp must carry a UTC offset")
    return value


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
    effect = RESOLUTION_EFFECTS[code]
    return {
        "code": code,
        "successor_sku": str(successor) if successor else None,
        "note": note or None,
        "applied_at": _parse_timestamp(supplied.get("applied_at")),
        "status": effect["status"],
        "in_forecast_scope": effect["in_forecast_scope"],
        "flags": list(effect["flags"]),
        "consequence": effect["consequence"],
        "decision_unchanged": True,
    }


def sku_reference(sku: str) -> str:
    """A SKU reference safe for the manifest: the identifier's hash, never the identifier."""
    return hashlib.sha256(str(sku).encode("utf-8")).hexdigest()


def route_portfolio(
    quality_result: dict[str, Any],
    classification_result: dict[str, Any],
    resolutions: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Record one routing decision per SKU from the quality and classification results.

    The inputs are read only. Nothing in them is recomputed, corrected or
    re-banded, and the returned result carries no metric of its own. Supplied
    resolutions are validated against the refusal's own list, recorded on the
    line and reported as passes; they change scope membership and nothing else.
    """
    quality_by_sku = {str(row["sku"]): row for row in quality_result.get("skus", [])}
    thresholds = dict(quality_result.get("context", {}).get("thresholds", {}))
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
        resolvable = quality_row.get("resolvable")

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
            "engine_resolvable_flag": resolvable,
            "decision": decision,
            "decided_by": decided_by,
            "forecast_eligible": DECISIONS[decision],
            "reason": reason,
            "action": _action(decision, item, findings, driven_by, resolvable, thresholds),
            "refusal": refusal,
            "resolution": None,
            "resolution_status": "unresolved" if refusal else "not_refused",
            "in_forecast_scope": True,
            "evidence": evidence,
        }

    present_skus = set(per_sku)
    passes: list[dict[str, Any]] = [{"pass": 1, "resolutions_applied": 0}]
    for sku, supplied in (resolutions or {}).items():
        if sku not in per_sku:
            raise RoutingError("A resolution was supplied for a SKU that is not in the file")
        resolution = _validate_resolution(sku, per_sku[sku], supplied, present_skus)
        per_sku[sku]["resolution"] = resolution
        per_sku[sku]["resolution_status"] = resolution["status"]
        per_sku[sku]["in_forecast_scope"] = resolution["in_forecast_scope"]
        entry = {
            "pass": len(passes) + 1,
            "sku": sku,
            "code": resolution["code"],
            "applied_at": resolution["applied_at"],
            "status": resolution["status"],
        }
        if resolution["successor_sku"]:
            entry["successor_sku"] = resolution["successor_sku"]
        passes.append(entry)

    decision_counts = {name: 0 for name in DECISIONS}
    decision_volume = {name: 0.0 for name in DECISIONS}
    refusal_counts = {code: 0 for code in RESOLUTION_VOCABULARY}
    resolution_counts: dict[str, int] = {}
    status_counts = {"unresolved": 0, "data_requested": 0, "deferred": 0, "resolved": 0}
    flag_counts: dict[str, int] = {}
    open_items: list[dict[str, Any]] = []
    eligible_volume = 0.0
    open_volume = 0.0
    last_resolved_at: str | None = None
    for sku in sorted(per_sku, key=lambda name: (per_sku[name]["rank_by_volume"], name)):
        line = per_sku[sku]
        decision_counts[line["decision"]] += 1
        decision_volume[line["decision"]] += float(line["volume_share_pct"])
        if line["forecast_eligible"]:
            eligible_volume += float(line["volume_share_pct"])
        if not line["refusal"]:
            continue
        refusal_counts[line["refusal"]["code"]] += 1
        status = line["resolution_status"]
        status_counts[status] += 1
        resolution = line["resolution"]
        if resolution:
            resolution_counts[resolution["code"]] = resolution_counts.get(resolution["code"], 0) + 1
            for flag in resolution["flags"]:
                flag_counts[flag] = flag_counts.get(flag, 0) + 1
            if status == "resolved" and (last_resolved_at is None or resolution["applied_at"] > last_resolved_at):
                last_resolved_at = resolution["applied_at"]
        if status in OPEN_STATUSES:
            open_volume += float(line["volume_share_pct"])
            open_items.append({
                "sku": sku,
                "volume_share_pct": line["volume_share_pct"],
                "decision": line["decision"],
                "reason": line["reason"],
                "refusal_code": line["refusal"]["code"],
                "resolution_options": list(line["refusal"]["resolution_options"]),
                "status": status,
                "resolution_code": resolution["code"] if resolution else None,
            })
    open_items.sort(key=lambda item: (-float(item["volume_share_pct"]), item["sku"]))
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
        "resolution_status_counts": status_counts,
        "flag_counts": dict(sorted(flag_counts.items())),
        "out_of_scope_count": sum(1 for line in per_sku.values() if not line["in_forecast_scope"]),
        "open_item_count": len(open_items),
        "open_volume_share_pct": round(open_volume, 6),
        "open_items": open_items,
        "last_resolved_at": last_resolved_at,
    }
    return {
        "schema_version": ROUTING_SCHEMA_VERSION,
        "routing_table_version": ROUTING_TABLE_VERSION,
        "decisions": {name: {"forecast_eligible": eligible} for name, eligible in DECISIONS.items()},
        "precedence": list(PRECEDENCE),
        "resolution_vocabulary": {code: list(options) for code, options in RESOLUTION_VOCABULARY.items()},
        "resolution_effects": {
            code: {"status": effect["status"], "in_forecast_scope": effect["in_forecast_scope"], "flags": list(effect["flags"]), "consequence": effect["consequence"]}
            for code, effect in RESOLUTION_EFFECTS.items()
        },
        "statement_sources": dict(STATEMENT_SOURCES),
        "per_sku": per_sku,
        "passes": passes,
        "portfolio": portfolio,
        "method_note": (
            "Routing records a decision and runs no method. The demand class is read from the classification result and the "
            "band, findings and discontinuation flag from the quality result; routing recomputes none of them. A caveated band "
            "attaches to the decision and never reroutes. ABC volume class and the portfolio band never affect a line decision. "
            "A resolution records an answer and changes scope membership; it never changes a routing decision or a quality "
            "band by assertion, and a different answer needs a new run with corrected data. Quality codes named inside a "
            "refusal are references to the quality result, not findings raised by routing."
        ),
    }


def sentence_overlap(action: str, *others: str) -> set[str]:
    """Sentences the do this shares with the so what or the reason. Must be empty."""
    return _sentences(action) & set().union(*(_sentences(other) for other in others))
