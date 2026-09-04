#!/usr/bin/env python3
"""Sprint 2 classification fixture: a portfolio that exercises all four SBC quadrants,
the ABC and XYZ cuts, and the edge cases where classification should refuse to answer."""

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
_ap.add_argument("--out", required=True, help="directory to write the fixture into. The committed copy lives in forecast-app/tests/classification_fixtures")
_ap.add_argument("--metrics-out", required=True,
                 help="where to write the metrics handoff that make_expected_classification.py reads")
_args = _ap.parse_args()
OUT = _args.out
random.seed(20260831)

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


def smooth(base, noise, trend=0.0, peaks=(), amp=0.0, months_=None):
    ms = months_ or ALL
    out = {}
    for i, d in enumerate(ms):
        season = 1.0 + (amp if d.month in peaks else 0.0)
        out[d] = max(1, int(round((base + trend * i) * season + random.gauss(0, noise))))
    return out


def erratic(low, low_sd, high, high_sd, p_high, months_=None):
    """Demand in every period, but the size swings hard."""
    ms = months_ or ALL
    out = {}
    for d in ms:
        if random.random() < p_high:
            out[d] = max(1, int(round(random.gauss(high, high_sd))))
        else:
            out[d] = max(1, int(round(random.gauss(low, low_sd))))
    return out


def intermittent(every, size, size_sd, months_=None):
    """Gaps between orders, consistent size when it comes."""
    ms = months_ or ALL
    out = {}
    for i, d in enumerate(ms):
        out[d] = max(1, int(round(random.gauss(size, size_sd)))) if i % every == 0 else 0
    return out


def lumpy(p_order, low, high, months_=None):
    """Sporadic and variable: the quadrant no model handles well."""
    ms = months_ or ALL
    out = {}
    for d in ms:
        if random.random() < p_order:
            out[d] = int(round(random.choice([
                random.uniform(low, low * 2.2),
                random.uniform(high * 0.55, high)
            ])))
        else:
            out[d] = 0
    return out


S = {}
# --- smooth, the backbone of the portfolio -------------------------------
S["PKG-50001"] = smooth(6100, 380, trend=14, peaks=(3, 9, 10), amp=0.16)
S["PKG-50002"] = smooth(4100, 260, trend=-22, peaks=(11,), amp=0.12)
S["PKG-50003"] = smooth(690, 55)
# --- erratic: every period, wild size ------------------------------------
S["PKG-50101"] = erratic(low=520, low_sd=90, high=4200, high_sd=600, p_high=0.28)
S["PKG-50102"] = erratic(low=140, low_sd=30, high=1500, high_sd=260, p_high=0.22)
# --- intermittent: gaps, consistent size ---------------------------------
S["PKG-50201"] = intermittent(every=3, size=2600, size_sd=130)
S["PKG-50202"] = intermittent(every=2, size=92, size_sd=7)
# --- lumpy: sporadic and variable. 50301 is deliberately material --------
S["PKG-50301"] = lumpy(p_order=0.34, low=900, high=26000)
S["PKG-50302"] = lumpy(p_order=0.26, low=40, high=900)
# --- boundary cases, either side of both cuts ----------------------------
S["PKG-50401"] = intermittent(every=1, size=1, size_sd=0)   # rebuilt below
S["PKG-50402"] = intermittent(every=1, size=1, size_sd=0)   # rebuilt below
# --- refusal cases -------------------------------------------------------
S["PKG-50501"] = {d: 0 for d in ALL}
for d in [ALL[4], ALL[17], ALL[29]]:
    S["PKG-50501"][d] = random.randint(300, 380)            # exactly 3 non-zero
S["PKG-50502"] = {d: 0 for d in ALL}
for d in [ALL[9], ALL[26]]:
    S["PKG-50502"][d] = random.randint(500, 560)            # only 2 non-zero
S["PKG-50601"] = smooth(1450, 95, months_=ALL[-10:])        # short but clean
S["PKG-50602"] = {ALL[13]: 3100}                            # one observation


def build_boundary(target_adi, target_cv2, base=800):
    """Place a series deliberately close to a cut so the threshold itself is tested."""
    n_nonzero = max(3, int(round(N / target_adi)))
    idx = sorted(random.sample(range(N), n_nonzero))
    # two-point mixture whose CV lands near the target
    cv = target_cv2 ** 0.5
    hi = base * (1 + cv)
    lo = base * (1 - cv)
    out = {d: 0 for d in ALL}
    for j, i in enumerate(idx):
        out[ALL[i]] = int(round(hi if j % 2 == 0 else lo))
    return out


S["PKG-50401"] = build_boundary(target_adi=1.20, target_cv2=0.40)   # smooth side of both
S["PKG-50402"] = build_boundary(target_adi=1.45, target_cv2=0.60)   # lumpy side of both

# ------------------------------------------------------------------ write
rows = ["sku,date,demand"]
for sku in S:
    for d in sorted(S[sku]):
        rows.append("%s,%s,%d" % (sku, d.isoformat(), S[sku][d]))
path = os.path.join(OUT, "30_classification_portfolio.csv")
open(path, "w").write("\n".join(rows) + "\n")


# ------------------------------------------------------------- metrics
def classify(adi, cv2):
    if adi is None or cv2 is None:
        return "unclassifiable"
    if adi < ADI_CUT and cv2 < CV2_CUT: return "smooth"
    if adi < ADI_CUT and cv2 >= CV2_CUT: return "erratic"
    if adi >= ADI_CUT and cv2 < CV2_CUT: return "intermittent"
    return "lumpy"


per = {}
total = sum(sum(v.values()) for v in S.values())
for sku, pts in S.items():
    ds = sorted(pts); vals = [pts[d] for d in ds]
    pres = len(ds); span = (ds[-1].year - ds[0].year) * 12 + (ds[-1].month - ds[0].month) + 1
    nz = [v for v in vals if v > 0]
    adi = round(pres / len(nz), 2) if nz else None
    if len(nz) >= 3:
        m = mean(nz)
        pvar = sum((x - m) ** 2 for x in nz) / len(nz)      # population estimator
        cv2 = round((pvar ** 0.5 / m) ** 2, 6)
    else:
        cv2 = None
    allm = mean(vals) if vals else 0
    cv_all = round((sum((x - allm) ** 2 for x in vals) / len(vals)) ** 0.5 / allm, 4) if allm else None
    vol = sum(vals)
    per[sku] = {
        "first_period": ds[0].isoformat(), "last_period": ds[-1].isoformat(),
        "periods_present": pres, "periods_expected_in_span": span,
        "non_zero_periods": len(nz), "zero_periods": pres - len(nz),
        "adi": adi, "cv_squared_nonzero": cv2, "cv_all_periods": cv_all,
        "expected_class": classify(adi, cv2),
        "volume_total": vol, "volume_share_pct": round(100 * vol / total, 2),
    }

order = sorted(per.items(), key=lambda kv: -kv[1]["volume_total"])
cum = 0
for rank, (sku, v) in enumerate(order, 1):
    cum += v["volume_share_pct"]
    v["rank_by_volume"] = rank
    v["cumulative_volume_share_pct"] = round(cum, 2)
    v["expected_abc_volume"] = "A" if cum <= 80 else ("B" if cum <= 95 else "C")

cvs = sorted(v["cv_all_periods"] for v in per.values() if v["cv_all_periods"] is not None)
for v in per.values():
    c = v["cv_all_periods"]
    if c is None or v["periods_present"] < 3:
        v["expected_xyz"] = None
        v["xyz_meaningful"] = False
    else:
        v["expected_xyz"] = "X" if c < 0.5 else ("Y" if c < 1.0 else "Z")
        # XYZ measures variability of a regular series. On an intermittent or lumpy
        # line the coefficient is driven by the zeros, so the letter is not a
        # statement about demand stability.
        v["xyz_meaningful"] = v["expected_class"] in ("smooth", "erratic")

print("%-12s %5s %5s %6s %9s %8s %-14s %6s %5s %3s %3s" % (
    "sku", "pres", "nz", "adi", "cv2", "cv_all", "class", "vol%", "cum%", "abc", "xyz"))
counts = {}
for sku, v in order:
    counts[v["expected_class"]] = counts.get(v["expected_class"], 0) + 1
    print("%-12s %5d %5d %6s %9s %8s %-14s %6.2f %5.1f %3s %3s" % (
        sku, v["periods_present"], v["non_zero_periods"], v["adi"],
        v["cv_squared_nonzero"], v["cv_all_periods"], v["expected_class"],
        v["volume_share_pct"], v["cumulative_volume_share_pct"],
        v["expected_abc_volume"], v["expected_xyz"]))
print()
print("class counts:", counts)
print("rows:", len(rows) - 1, "| skus:", len(S), "| bytes:", os.path.getsize(path))

json.dump({"per_sku": per, "portfolio_volume": total}, open(_args.metrics_out, "w"))
