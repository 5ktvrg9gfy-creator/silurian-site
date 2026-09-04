#!/usr/bin/env python3
"""Independent check of expected_routing.json. Recomputes every decision from the stated
rules and the observed bands, and checks the file's claims about itself."""

import json, csv, collections, datetime as dt


# Paths. Reads default to the repository copy, resolved from this file's own
# location. This script only reads; it writes nothing. The committed files are
# authoritative and these scripts are not; see README.md.
import argparse
from pathlib import Path as _Path

_TESTS = _Path(__file__).resolve().parents[1] / "tests"

_ap = argparse.ArgumentParser(description=__doc__)
_ap.add_argument("--expected-routing", default=str(_TESTS / "fixtures" / "expected_routing.json"))
_ap.add_argument("--expected-classification", default=str(_TESTS / "classification_fixtures" / "expected_classification.json"))
_ap.add_argument("--fixture", default=str(_TESTS / "fixtures" / "31_routing_portfolio.csv"))
_args = _ap.parse_args()

E = json.load(open(_args.expected_routing))
C = json.load(open(_args.expected_classification))
CSVP = _args.fixture
fail = []


def chk(c, m):
    if not c:
        fail.append(m)


ELIGIBLE = {"model_eligible", "model_eligible_wide_interval", "intermittent_methods"}
CLASS_ROUTE = {"smooth": "model_eligible", "erratic": "model_eligible_wide_interval",
               "intermittent": "intermittent_methods", "lumpy": "policy_only",
               "unclassifiable": "insufficient_evidence"}
DECISIONS = set(CLASS_ROUTE.values()) | {"refused_data_quality", "discontinued_confirm_status"}
REFUSING = {"discontinued_confirm_status", "refused_data_quality", "insufficient_evidence"}

per = E["per_sku"]
obs = E["quality_inputs_observed"]["per_sku"]

# --- the fixture the file claims to describe ------------------------------
series = collections.defaultdict(dict)
with open(CSVP) as f:
    for r in csv.DictReader(f):
        series[r["sku"]][dt.date.fromisoformat(r["date"])] = int(r["demand"])
chk(set(series) == set(per), "per_sku does not cover the fixture exactly")
chk(set(obs) == set(per), "observed bands do not cover every routed SKU")

total = sum(sum(v.values()) for v in series.values())
CUT = dt.date(2026, 7, 1)

for sku, e in per.items():
    pts = series[sku]
    vals = list(pts.values())
    share = 100 * sum(vals) / total
    chk(abs(e["volume_share_pct"] - share) <= 0.05, "%s volume share" % sku)

    lastd = max([d for d, v in pts.items() if v > 0])
    trail = (CUT.year - lastd.year) * 12 + (CUT.month - lastd.month)
    chk(e["fixture_metadata"]["trailing_periods_since_last_demand"] == trail,
        "%s trailing periods" % sku)

    band, codes = obs[sku]["band"], obs[sku]["finding_codes"]
    chk(e["quality_band_at_decision"] == band, "%s band does not match the observed input" % sku)
    chk(e["quality_finding_codes_referenced"] == codes, "%s finding codes" % sku)

    # recompute the decision from the rules
    if "SERIES_DISCONTINUED" in codes:
        want = "discontinued_confirm_status"
    elif band == "not_usable":
        want = "refused_data_quality"
    else:
        want = CLASS_ROUTE[e["demand_class"]]
    chk(e["decision"] == want, "%s decision: file says %s, rules give %s" % (sku, e["decision"], want))
    chk(e["decision"] in DECISIONS, "%s decision outside the closed set" % sku)
    chk(e["forecast_eligible"] == (e["decision"] in ELIGIBLE), "%s eligibility flag" % sku)

    if e["decision"] in REFUSING:
        r = e.get("refusal")
        chk(isinstance(r, dict), "%s should carry a refusal" % sku)
        if isinstance(r, dict):
            opts = r.get("resolution_options") or []
            chk(opts and set(opts) <= set(sum(E["resolution_vocabulary"].values(), [])),
                "%s resolution options outside the vocabulary" % sku)
            chk("DEFER" in opts, "%s resolution options lack DEFER" % sku)
            chk(r["code"] in E["resolution_vocabulary"], "%s refusal code has no vocabulary" % sku)
    else:
        chk(e["refusal"] is None, "%s should carry a null refusal" % sku)

    # class and ABC must match classification, never be re-derived
    if sku in C.get("per_sku", {}):
        chk(False, "fixture 31 SKUs must not appear in the classification expectations file")

# --- the file's claims about itself ---------------------------------------
counts = collections.Counter(e["decision"] for e in per.values())
chk(counts == collections.Counter(E["portfolio"]["decision_counts"]), "decision counts")
vol = collections.defaultdict(float)
for e in per.values():
    vol[e["decision"]] += e["volume_share_pct"]
# portfolio figures must be computed in units, so they are checked exactly rather than to tolerance
units = collections.defaultdict(int)
for sku, e in per.items():
    units[e["decision"]] += sum(series[sku].values())
T = sum(sum(v.values()) for v in series.values())
for k, v in E["portfolio"]["volume_share_by_decision_pct"].items():
    exact = round(100 * units[k] / T, 2)
    chk(exact == v, "volume share for %s: file %s, computed in units %s" % (k, v, exact))
eu = sum(u for k, u in units.items() if k in ELIGIBLE)
chk(round(100 * eu / T, 2) == E["portfolio"]["forecast_eligible_volume_share_pct"], "eligible volume share")
chk(round(100 * (T - eu) / T, 2) == E["portfolio"]["not_eligible_volume_share_pct"], "not eligible share")
chk("65.57" in E["portfolio"]["headline_must_state"] and "34.43" in E["portfolio"]["headline_must_state"],
    "headline figures are not the unit-computed ones")
elig = sum(v for k, v in vol.items() if k in ELIGIBLE)
chk(abs(sum(vol.values()) - 100) <= 0.05, "decision volumes do not sum to 100")

chk(E["quality_inputs_observed"]["portfolio_band"] == "not_usable", "portfolio band changed")
chk(all(per[b["sku"]]["decision"] == b["expected_decision"] for b in E["boundary_cases"]),
    "a boundary case disagrees with per_sku")
chk(per["RTG-60403"]["decided_by"].startswith("discontinued"), "the precedence case is not decided by rule 1")
chk("TREAT_AS_NEW_LINE" in per["RTG-60401"]["refusal"]["resolution_options"],
    "the launch line cannot be treated as a new line")
chk(per["RTG-60301"]["refusal"] is None and per["RTG-60301"]["forecast_eligible"] is False,
    "policy_only must be ineligible without being a refusal")

raw = open(_args.expected_routing).read()
# Built by codepoint, not written as literals: this is the check that forbids
# these characters, so the file enforcing the rule must not contain them.
for ch in (chr(0x2014), chr(0x2013), chr(0x2012), chr(0x2015)):
    chk(ch not in raw, "dash character U+%04X found" % ord(ch))
chk("nine box" not in raw.lower(), "banned phrase present")

print("checks failed:", len(fail))
for f_ in fail:
    print("  FAIL", f_)
if not fail:
    print("expected_routing.json verified against the fixture and its own rules")
