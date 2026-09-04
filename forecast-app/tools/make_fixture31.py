#!/usr/bin/env python3
"""Fixture 31: a portfolio built to exercise routing refusal where refusing costs something.

Design rule: every line is here to produce one routing decision. The demand shapes are
reused from fixture 30's generators, but the volumes are arranged so that the refused and
policy-only lines are material rather than trivial.
"""

import csv, json, os, random, datetime as dt
from statistics import mean


# Paths. Reads default to the repository copy, resolved from this file's own
# location. Writes have no default and must be named, so a stray run of this
# script cannot overwrite a committed fixture. The committed files are
# authoritative and these scripts are not; see README.md.
import argparse
from pathlib import Path as _Path

_TESTS = _Path(__file__).resolve().parents[1] / "tests"

_ap = argparse.ArgumentParser(description=__doc__)
_ap.add_argument("--out", required=True, help="directory to write the fixture into. The committed copy lives in forecast-app/tests/fixtures")
_ap.add_argument("--metrics-out", required=True,
                 help="where to write the metrics handoff that make_expected_routing.py reads")
_args = _ap.parse_args()
OUT = _args.out
random.seed(20260902)

AS_OF = dt.date(2026, 8, 1)
START = dt.date(2023, 9, 1)
END = dt.date(2026, 7, 1)
ADI_CUT, CV2_CUT = 1.32, 0.49


def months(a, b):
    out, y, m = [], a.year, a.month
    while dt.date(y, m, 1) <= b:
        out.append(dt.date(y, m, 1)); m += 1
        if m == 13: m, y = 1, y + 1
    return out


ALL = months(START, END)
N = len(ALL)


def smooth(base, noise, trend=0.0, peaks=(), amp=0.0, ms=None):
    ms = ms or ALL
    return {d: max(1, int(round((base + trend * i) * (1 + (amp if d.month in peaks else 0.0))
                                + random.gauss(0, noise)))) for i, d in enumerate(ms)}


def erratic(low, low_sd, high, high_sd, p_high, ms=None):
    ms = ms or ALL
    out = {}
    for d in ms:
        out[d] = max(1, int(round(random.gauss(high, high_sd) if random.random() < p_high
                                  else random.gauss(low, low_sd))))
    return out


def intermittent(every, size, size_sd, ms=None):
    ms = ms or ALL
    return {d: (max(1, int(round(random.gauss(size, size_sd)))) if i % every == 0 else 0)
            for i, d in enumerate(ms)}


def lumpy(p_order, low, high, ms=None):
    ms = ms or ALL
    out = {}
    for d in ms:
        out[d] = int(round(random.choice([random.uniform(low, low * 2.2),
                                          random.uniform(high * 0.55, high)]))) if random.random() < p_order else 0
    return out


S, INTENT = {}, {}

# --- the backbone, clean and forecastable ---------------------------------
S["RTG-60001"] = smooth(5200, 300, trend=11, peaks=(3, 10), amp=0.14)
INTENT["RTG-60001"] = "smooth, clean, the anchor line. Expect model_eligible."
S["RTG-60002"] = smooth(2100, 150, peaks=(11,), amp=0.10)
INTENT["RTG-60002"] = "smooth, clean, mid volume. Expect model_eligible."
S["RTG-60702"] = smooth(240, 22)
INTENT["RTG-60702"] = "smooth, clean, small tail line. Expect model_eligible."

# --- erratic, deliberately material so the wide-interval decision matters --
S["RTG-60101"] = erratic(low=900, low_sd=140, high=6400, high_sd=800, p_high=0.30)
INTENT["RTG-60101"] = "erratic and material. Expect model_eligible_wide_interval on an A line."

# --- intermittent, regular gaps and consistent size ------------------------
S["RTG-60201"] = intermittent(every=3, size=3400, size_sd=160)
INTENT["RTG-60201"] = "intermittent but clockwork, material. Expect intermittent_methods."
S["RTG-60602"] = intermittent(every=4, size=420, size_sd=90)
INTENT["RTG-60602"] = ("intermittent, smaller. Trailing gap of 4 periods puts it stale but inside the 6 period "
                       "discontinuation threshold, so it tests that stale is a caveat and not a reroute.")

# --- lumpy, the policy-only cases -----------------------------------------
S["RTG-60301"] = lumpy(p_order=0.26, low=900, high=17000)
INTENT["RTG-60301"] = "lumpy and material. Expect policy_only on an A or B line."
S["RTG-60701"] = lumpy(p_order=0.24, low=60, high=1100)
INTENT["RTG-60701"] = "lumpy, small. Expect policy_only in class C."

# --- THE MATERIAL REFUSAL: a recent launch, five periods, high volume ------
S["RTG-60401"] = smooth(9800, 420, ms=ALL[-5:])
INTENT["RTG-60401"] = ("recent launch, 5 periods of strong demand and nothing before. Span is below the "
                       "6 period not-usable threshold, so the expectation is a not usable band and a "
                       "refusal on a line carrying real volume. This is the line the story exists for.")

# --- sparse coverage: long span, most periods absent rather than zero ------
_sparse = smooth(2600, 200)
_keep = sorted(random.sample(range(N), 12))
S["RTG-60402"] = {ALL[i]: _sparse[ALL[i]] for i in _keep}
INTENT["RTG-60402"] = ("12 periods present across a 35 period span, with the rest absent rather than zero. "
                       "Coverage near 34 percent sits below the 50 percent not-usable threshold. Tests that "
                       "refusal is driven by coverage, not by age.")

# --- discontinued, and it used to matter ----------------------------------
S["RTG-60403"] = {d: v for d, v in smooth(4300, 260, peaks=(6,), amp=0.12).items() if d <= ALL[-15]}
INTENT["RTG-60403"] = ("was a substantial line, last transacted 14 periods before the cut-off. Tests a "
                       "discontinued series that carries history rather than a stub. Band to be observed.")

# --- refusal on evidence rather than on data quality ----------------------
S["RTG-60501"] = {d: 0 for d in ALL}
for d in [ALL[8], ALL[22]]:
    S["RTG-60501"][d] = random.randint(700, 780)
INTENT["RTG-60501"] = ("2 non-zero observations across a full span, the most recent one period back so the line "
                       "is neither discontinued nor stale. Classification refuses on evidence, so the "
                       "expectation is insufficient_evidence rather than a data quality refusal.")

# --- the precedence case: unclassifiable AND expected not usable ----------
S["RTG-60502"] = {ALL[-3]: 5200, ALL[-2]: 4900}
INTENT["RTG-60502"] = ("2 periods, both recent, material volume. Unclassifiable on evidence and expected "
                       "not usable on span. Precedence says refused_data_quality wins, because the data "
                       "problem is the one you fix first. Fixture 30 has this case only at 0.49 percent of "
                       "volume; here it is material.")

# --- smooth but caveated, so a caveat is proven not to change the route ----
_out = smooth(1750, 90)
_out[ALL[14]] = int(_out[ALL[14]] * 2.4)
_out[ALL[27]] = int(_out[ALL[27]] * 2.2)
S["RTG-60601"] = _out
INTENT["RTG-60601"] = ("smooth with two spikes large enough to raise outlier candidates but small enough to leave CV "
                       "squared well below the 0.49 cut. Expect a caveated "
                       "band and model_eligible unchanged, which is the rule that a caveat attaches rather "
                       "than reroutes.")

# --- deterministic control of trailing gaps, so discontinuation is designed
# rather than left to the random draw. Discontinuation is measured on the last
# period with DEMAND, not the last period present.
def last_demand_index(sku):
    return max(i for i, d in enumerate(ALL) if S[sku].get(d, 0) > 0)


# RTG-60301 must stay a live lumpy line, so guarantee an order in the final period.
S["RTG-60301"][ALL[-1]] = int(round(random.uniform(9000, 15000)))

# RTG-60501 must refuse on evidence, not on discontinuation. Place both
# observations so the line is current.
S["RTG-60501"] = {d: 0 for d in ALL}
S["RTG-60501"][ALL[-14]] = 740
S["RTG-60501"][ALL[-2]] = 705

# RTG-60602 is the stale but not discontinued case: 4 trailing periods, inside
# the 6 period discontinuation threshold, so a caveat rather than a route change.
for d in ALL[-4:]:
    S["RTG-60602"][d] = 0
S["RTG-60602"][ALL[-5]] = 455

rows = ["sku,date,demand"]
for sku in sorted(S):
    for d in sorted(S[sku]):
        rows.append("%s,%s,%d" % (sku, d.isoformat(), S[sku][d]))
path = os.path.join(OUT, "31_routing_portfolio.csv")
open(path, "w").write("\n".join(rows) + "\n")


def classify(adi, cv2):
    if adi is None or cv2 is None: return "unclassifiable"
    if adi < ADI_CUT and cv2 < CV2_CUT: return "smooth"
    if adi < ADI_CUT and cv2 >= CV2_CUT: return "erratic"
    if adi >= ADI_CUT and cv2 < CV2_CUT: return "intermittent"
    return "lumpy"


per, total = {}, sum(sum(v.values()) for v in S.values())
for sku, pts in S.items():
    ds = sorted(pts); vals = [pts[d] for d in ds]
    pres = len(ds)
    span = (ds[-1].year - ds[0].year) * 12 + (ds[-1].month - ds[0].month) + 1
    nz = [v for v in vals if v > 0]
    adi = round(pres / len(nz), 2) if nz else None
    if len(nz) >= 3:
        m = mean(nz)
        cv2 = round((sum((x - m) ** 2 for x in nz) / len(nz)) / (m * m), 6)
    else:
        cv2 = None
    allm = mean(vals)
    cv_all = round((sum((x - allm) ** 2 for x in vals) / len(vals)) ** 0.5 / allm, 4) if allm else None
    lastd = max([d for d in ds if pts[d] > 0], default=ds[-1])
    trailing = (ALL[-1].year - lastd.year) * 12 + (ALL[-1].month - lastd.month)
    per[sku] = {
        "first_period": ds[0].isoformat(), "last_period": ds[-1].isoformat(),
        "periods_present": pres, "periods_expected_in_span": span,
        "coverage_pct": round(100 * pres / span, 2),
        "trailing_periods_since_last_demand": trailing,
        "non_zero_periods": len(nz), "zero_periods": pres - len(nz),
        "adi": adi, "cv_squared_nonzero": cv2, "cv_all_periods": cv_all,
        "expected_class": classify(adi, cv2),
        "volume_total": sum(vals), "volume_share_pct": round(100 * sum(vals) / total, 2),
        "design_intent": INTENT[sku],
    }

cum = 0
for rank, (sku, v) in enumerate(sorted(per.items(), key=lambda kv: -kv[1]["volume_total"]), 1):
    cum += v["volume_share_pct"]
    v["rank_by_volume"] = rank
    v["cumulative_volume_share_pct"] = round(cum, 2)
    v["expected_abc_volume"] = "A" if cum <= 80 else ("B" if cum <= 95 else "C")

print("%-12s %4s %5s %5s %5s %7s %6s %6s %-14s %3s %6s" % (
    "sku", "rank", "pres", "span", "nz", "cov%", "trail", "cv2", "class", "abc", "vol%"))
for sku, v in sorted(per.items(), key=lambda kv: kv[1]["rank_by_volume"]):
    print("%-12s %4d %5d %5d %5d %7.1f %6d %6s %-14s %3s %6.2f" % (
        sku, v["rank_by_volume"], v["periods_present"], v["periods_expected_in_span"],
        v["non_zero_periods"], v["coverage_pct"], v["trailing_periods_since_last_demand"],
        v["cv_squared_nonzero"], v["expected_class"], v["expected_abc_volume"],
        v["volume_share_pct"]))
print()
import collections
print("class counts:", dict(collections.Counter(v["expected_class"] for v in per.values())))
print("rows:", len(rows) - 1, "| skus:", len(S), "| bytes:", os.path.getsize(path))
json.dump({"per_sku": per, "portfolio_volume": total}, open(_args.metrics_out, "w"))
