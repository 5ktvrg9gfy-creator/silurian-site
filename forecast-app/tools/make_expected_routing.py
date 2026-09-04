#!/usr/bin/env python3
"""Build expected_routing.json for story 2.2 from the approved routing table and the
quality bands observed from the live engine on 2026-09-02."""

import json, collections, csv


# Paths. Reads default to the repository copy, resolved from this file's own
# location. Writes have no default and must be named, so a stray run of this
# script cannot overwrite a committed fixture. The committed files are
# authoritative and these scripts are not; see README.md.
import argparse
from pathlib import Path as _Path

_TESTS = _Path(__file__).resolve().parents[1] / "tests"

_ap = argparse.ArgumentParser(description=__doc__)
_ap.add_argument("--metrics", required=True, help="the handoff written by make_fixture31.py --metrics-out")
_ap.add_argument("--fixture", default=str(_TESTS / "fixtures" / "31_routing_portfolio.csv"),
                 help="the routing portfolio CSV the shares are computed from, in units")
_ap.add_argument("--out", required=True, help="file to write. The committed copy is forecast-app/tests/fixtures/expected_routing.json")
_args = _ap.parse_args()

F31 = json.load(open(_args.metrics))["per_sku"]

# Volume shares are computed from the fixture in units, never by summing shares that
# have already been rounded. v1.0 did the latter and reported an eligible share of
# 65.58 where the exact figure is 65.5687. The build session caught it.
UNITS = collections.defaultdict(int)
for _r in csv.DictReader(open(_args.fixture)):
    UNITS[_r["sku"]] += int(_r["demand"])
TOTAL = sum(UNITS.values())

OBSERVED = {  # from the build session's run at analysis date 2026-08-01
    "RTG-60001": ("clean", [], None),
    "RTG-60002": ("clean", [], None),
    "RTG-60101": ("caveated", ["OUTLIER_CANDIDATE"], None),
    "RTG-60201": ("clean", [], None),
    "RTG-60301": ("caveated", ["OUTLIER_CANDIDATE"], None),
    "RTG-60401": ("not_usable", ["HISTORY_TOO_SHORT"], False),
    "RTG-60402": ("not_usable", ["ZERO_VS_MISSING_AMBIGUOUS"], True),
    "RTG-60403": ("not_usable", ["SERIES_DISCONTINUED"], True),
    "RTG-60501": ("clean", [], None),
    "RTG-60502": ("not_usable", ["HISTORY_TOO_SHORT"], False),
    "RTG-60601": ("caveated", ["OUTLIER_CANDIDATE"], None),
    "RTG-60602": ("clean", [], None),
    "RTG-60701": ("caveated", ["OUTLIER_CANDIDATE"], None),
    "RTG-60702": ("clean", [], None),
}

CLASS_ROUTE = {
    "smooth": "model_eligible",
    "erratic": "model_eligible_wide_interval",
    "intermittent": "intermittent_methods",
    "lumpy": "policy_only",
    "unclassifiable": "insufficient_evidence",
}
ELIGIBLE = {"model_eligible", "model_eligible_wide_interval", "intermittent_methods"}

RESOLUTIONS = {
    "DISCONTINUED": ["DISCONTINUED_CONFIRMED", "SUPERSEDED_BY_SKU", "STILL_ACTIVE_DEMAND_GAP",
                     "STILL_ACTIVE_DATA_MISSING", "DEFER"],
    "REFUSED_DATA_QUALITY": ["SUPPLY_LONGER_HISTORY", "SUPPLY_CORRECTED_EXTRACT",
                             "TREAT_AS_NEW_LINE", "EXCLUDE_FROM_SCOPE", "DEFER"],
    "INSUFFICIENT_EVIDENCE": ["SUPPLY_LONGER_HISTORY", "TREAT_AS_NEW_LINE",
                              "EXCLUDE_FROM_SCOPE", "DEFER"],
}

REASON = {
    "model_eligible": "demand in every period at a stable size, so a model and the statistical baselines can both run",
    "model_eligible_wide_interval": "demand in every period but the size swings hard, so the interval carries the value and the point number does not",
    "intermittent_methods": "demand arrives with regular gaps at a consistent size, which needs the Croston family rather than a general model",
    "policy_only": "demand is sporadic and the size varies by an order of magnitude, so no statistical method will forecast it well",
    "insufficient_evidence": "too few non-zero observations to describe a pattern",
    "refused_data_quality": "the quality stage bands this line not usable, so no method may run until the data is corrected",
    "discontinued_confirm_status": "no demand for six periods or more, so there is nothing to forecast forward until the status is confirmed",
}

per, counts, vol = {}, collections.Counter(), collections.defaultdict(float)
for sku, f in F31.items():
    band, findings, resolvable = OBSERVED[sku]
    cls = f["expected_class"]
    if "SERIES_DISCONTINUED" in findings:
        decision, rcode = "discontinued_confirm_status", "DISCONTINUED"
        precedence = "discontinued, rule 1"
    elif band == "not_usable":
        decision, rcode = "refused_data_quality", "REFUSED_DATA_QUALITY"
        precedence = "not usable, rule 2"
    else:
        decision = CLASS_ROUTE[cls]
        rcode = "INSUFFICIENT_EVIDENCE" if decision == "insufficient_evidence" else None
        precedence = "class table, rule 3"
    e = {
        "demand_class": cls,
        "abc_volume_class": f["expected_abc_volume"],
        "quality_band_at_decision": band,
        "quality_finding_codes_referenced": findings,
        "fixture_metadata": {
            "trailing_periods_since_last_demand": f["trailing_periods_since_last_demand"],
            "note": ("Describes the fixture, not an output field. No stage owns this value, so "
                     "nothing is required to emit it. It is here so a reader can see why the "
                     "discontinuation rule fires where it does."),
        },
        "volume_share_pct": round(100 * UNITS[sku] / TOTAL, 2),
        "decision": decision,
        "decided_by": precedence,
        "forecast_eligible": decision in ELIGIBLE,
        "reason_must_convey": REASON[decision],
    }
    if rcode:
        e["refusal"] = {
            "code": rcode,
            "driven_by_finding_codes": findings if rcode != "INSUFFICIENT_EVIDENCE" else [],
            "resolution_options": RESOLUTIONS[rcode],
        }
    else:
        e["refusal"] = None
    if band == "caveated":
        e["caveat_codes_shown"] = findings
    per[sku] = e
    counts[decision] += 1
    vol[decision] += UNITS[sku]

vol_units = dict(vol)
vol = {k: round(100 * v / TOTAL, 2) for k, v in sorted(vol_units.items(), key=lambda kv: -kv[1])}
elig_units = sum(v for k, v in vol_units.items() if k in ELIGIBLE)
elig_vol = round(100 * elig_units / TOTAL, 2)
not_elig_vol = round(100 * (TOTAL - elig_units) / TOTAL, 2)

doc = {
    "version": "1.1",
    "revision_note": (
        "v1.1 corrects the portfolio volume figures. v1.0 summed per-SKU shares that had already "
        "been rounded to two decimals and reported 65.58 percent eligible; the exact figure computed "
        "in units is 65.5687, which prints as 65.57. Six of the seven by-decision shares moved by a "
        "hundredth. No decision, eligibility flag, refusal or resolution list has changed. The build "
        "session found this, and it is the same error class I flagged in the 2.1 brief for cumulative "
        "ABC shares, made in my own file this time. trailing_periods_since_last_demand has also moved "
        "under fixture_metadata, because no stage owns that value and nothing should be required to "
        "emit it."
    ),
    "story": "2.2 Routing decision, reason and refusal state",
    "fixture": "31_routing_portfolio.csv",
    "fixture_sha256": "2c55f4f7c30e6f708c7389a2df3850a8fb7947b1187f19c95531b4aaca9601f6",
    "as_of_date": "2026-08-01",
    "grain": "month",
    "routing_table_version": "1.2",
    "note": (
        "Routing records a decision. It does not run a method. Every decision in this file is a "
        "function of two inputs: the demand class, which classification owns, and the quality band, "
        "which the quality stage owns. Routing computes neither. The bands in quality_inputs_observed "
        "were taken from a live engine run rather than predicted, so this file is exact."
    ),
    "quality_inputs_observed": {
        "status": "observed, not specified",
        "observed_on": "2026-09-02, build session run at analysis date 2026-08-01",
        "authority": (
            "The engine is authoritative for bands and findings. If the engine changes, this block is "
            "updated to match it and the decisions are recomputed. The engine is never weakened to make "
            "a routing expectation pass."
        ),
        "validation": {"verdict": "accept", "findings": []},
        "portfolio_band": "not_usable",
        "portfolio_findings": ["LONG_TAIL_CONCENTRATION"],
        "portfolio_flagged_volume_share_pct": 55.2657,
        "per_sku": {k: {"band": v[0], "finding_codes": v[1], "engine_resolvable_flag": v[2]}
                    for k, v in OBSERVED.items()},
    },
    "rules": {
        "precedence": [
            "1. A line carrying SERIES_DISCONTINUED routes to discontinued_confirm_status, whatever its class and whatever its band.",
            "2. Otherwise a not_usable band routes to refused_data_quality, whatever its class.",
            "3. Otherwise the demand class decides, including unclassifiable to insufficient_evidence.",
        ],
        "caveated_band_does_not_reroute": True,
        "abc_volume_class_never_affects_the_decision": True,
        "portfolio_band_never_affects_a_line_decision": (
            "The portfolio band on this fixture is not_usable, and no per-line decision depends on it. "
            "The portfolio band describes the portfolio; routing reads the per-SKU band."
        ),
        "routing_computes_no_metric": (
            "Routing reads demand_class from classification and band, findings and SERIES_DISCONTINUED "
            "from quality. It recomputes no trailing gap, no ADI, no CV squared and no coverage."
        ),
        "finding_codes_are_referenced_not_emitted": (
            "quality_finding_codes_referenced and driven_by_finding_codes hold quality codes as "
            "provenance. Routing emits none of them, so the 1.6 cross-stage test still holds."
        ),
        "quality_band_at_decision": (
            "Recorded beside the decision as the one approved exception to implementation default 4, "
            "because a decision that cannot show its input is not reproducible."
        ),
    },
    "resolution_vocabulary": RESOLUTIONS,
    "resolution_rules": [
        "The resolution code is required. A free-text note may accompany it and carries no behaviour.",
        "The note is client data: it belongs in the bundle and never in the manifest.",
        "SUPERSEDED_BY_SKU requires a successor SKU chosen from the SKUs present in the uploaded file, never typed.",
        "A supplied resolution produces a new pass recorded in the manifest options, as story 1.1 does for validation.",
        "DEFER is a legitimate answer. Unresolved lines appear on the open items list and are not a failure state.",
    ],
    "portfolio": {
        "sku_count": len(per),
        "decision_counts": dict(counts),
        "volume_share_by_decision_pct": vol,
        "forecast_eligible_volume_share_pct": elig_vol,
        "not_eligible_volume_share_pct": not_elig_vol,
        "computed_from": "unit volumes, not from rounded per-SKU shares",
        "exact_before_rounding": {"forecast_eligible_pct": round(100 * elig_units / TOTAL, 4),
                                  "not_eligible_pct": round(100 * (TOTAL - elig_units) / TOTAL, 4)},
        "headline_must_state": (
            "%.2f percent of volume is forecast eligible and %.2f percent is not, split by reason."
            % (elig_vol, not_elig_vol)
        ),
    },
    "boundary_cases": [
        {"sku": "RTG-60403", "tests": "precedence rule 1 against rule 2",
         "detail": "not_usable band AND SERIES_DISCONTINUED, 12.85 percent of volume, rank two",
         "expected_decision": "discontinued_confirm_status",
         "assertion": "discontinued wins over the not usable band. A result of refused_data_quality here means the precedence order is reversed."},
        {"sku": "RTG-60502", "tests": "precedence rule 2 against rule 3",
         "detail": "not_usable band AND unclassifiable class",
         "expected_decision": "refused_data_quality",
         "assertion": "the band wins over the class. A result of insufficient_evidence here means rule 2 is not being applied."},
        {"sku": "RTG-60501", "tests": "refusal on evidence with clean data",
         "detail": "clean band, unclassifiable class, 2 non-zero observations in 35",
         "expected_decision": "insufficient_evidence",
         "assertion": "a clean line can still be refused. Any data quality refusal here is wrong."},
        {"sku": "RTG-60601", "tests": "a caveat must not reroute",
         "detail": "caveated band with OUTLIER_CANDIDATE, smooth class",
         "expected_decision": "model_eligible",
         "assertion": "the decision is unchanged and the caveat is shown alongside it."},
        {"sku": "RTG-60301", "tests": "a caveat must not reroute on a non-eligible line either",
         "detail": "caveated band with OUTLIER_CANDIDATE, lumpy class, 8.28 percent of volume",
         "expected_decision": "policy_only",
         "assertion": "policy_only is a route rather than a refusal, so refusal is null even though forecast_eligible is false."},
        {"sku": "RTG-60401", "tests": "the material refusal",
         "detail": "not_usable on HISTORY_TOO_SHORT, 6.59 percent of volume, five period launch",
         "expected_decision": "refused_data_quality",
         "assertion": "TREAT_AS_NEW_LINE must appear in its resolution options. A launch is forecast by analogue, not from five points of its own history."},
    ],
    "assertions": [
        "Every SKU carries exactly one decision from the closed set of seven.",
        "forecast_eligible is true only for model_eligible, model_eligible_wide_interval and intermittent_methods.",
        "refusal is non-null exactly for discontinued_confirm_status, refused_data_quality and insufficient_evidence. policy_only carries a null refusal despite being ineligible.",
        "Every non-null refusal carries a resolution_options list from the closed vocabulary, and every list contains DEFER.",
        "No routing code appears in the validation or quality code sets, per the 1.6 cross-stage test.",
        "Volume shares by decision sum to 100 within 0.05.",
        "Routing emits no metric of its own: every number it shows traces to classification or quality.",
    ],
    "per_sku": per,
}

json.dump(doc, open(_args.out, "w"), indent=2)
print("decision counts:", dict(counts))
print("volume by decision:", vol)
print("eligible:", elig_vol, "| not eligible:", not_elig_vol)
