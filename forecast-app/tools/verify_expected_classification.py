#!/usr/bin/env python3
"""Independent check: recompute every expectation from the CSV alone and compare
against expected_classification.json. Nothing here imports the generator."""

import csv, json, collections, datetime as dt


# Paths. Reads default to the repository copy, resolved from this file's own
# location. This script only reads; it writes nothing. The committed files are
# authoritative and these scripts are not; see README.md.
import argparse
from pathlib import Path as _Path

_TESTS = _Path(__file__).resolve().parents[1] / "tests"

_ap = argparse.ArgumentParser(description=__doc__)
_ap.add_argument("--fixture", default=str(_TESTS / "classification_fixtures" / "30_classification_portfolio.csv"))
_ap.add_argument("--expected", default=str(_TESTS / "classification_fixtures" / "expected_classification.json"))
_args = _ap.parse_args()

CSV = _args.fixture
EXP = json.load(open(_args.expected))
T = EXP["thresholds"]
fail = []


def chk(cond, msg):
    if not cond:
        fail.append(msg)


series = collections.defaultdict(dict)
with open(CSV) as f:
    for r in csv.DictReader(f):
        series[r["sku"]][dt.date.fromisoformat(r["date"])] = int(r["demand"])

total = sum(sum(v.values()) for v in series.values())
chk(total == EXP["portfolio"]["volume_total"], "portfolio volume mismatch")
chk(len(series) == EXP["portfolio"]["sku_count"], "sku count mismatch")

calc = {}
for sku, pts in series.items():
    ds = sorted(pts)
    vals = [pts[d] for d in ds]
    nz = [v for v in vals if v > 0]
    pres = len(ds)
    span = (ds[-1].year - ds[0].year) * 12 + (ds[-1].month - ds[0].month) + 1
    adi = pres / len(nz) if nz else None
    if len(nz) >= T["cv_squared_min_nonzero_observations"]:
        m = sum(nz) / len(nz)
        cv2 = sum((x - m) ** 2 for x in nz) / len(nz) / (m * m)
    else:
        cv2 = None
    am = sum(vals) / len(vals)
    cva = (sum((x - am) ** 2 for x in vals) / len(vals)) ** 0.5 / am if am else None
    if adi is None or cv2 is None:
        cls = "unclassifiable"
    elif adi < T["adi_cut"]:
        cls = "smooth" if cv2 < T["cv_squared_cut"] else "erratic"
    else:
        cls = "intermittent" if cv2 < T["cv_squared_cut"] else "lumpy"
    calc[sku] = dict(pres=pres, span=span, nz=len(nz), adi=adi, cv2=cv2,
                     cva=cva, cls=cls, vol=sum(vals),
                     share=100 * sum(vals) / total, first=ds[0], last=ds[-1])

rank = sorted(calc.items(), key=lambda kv: -kv[1]["vol"])
cum = 0.0
for i, (sku, c) in enumerate(rank, 1):
    cum += round(c["share"], 2)
    c["rank"] = i
    c["cum"] = round(cum, 2)
    c["abc"] = "A" if cum <= T["abc_a_cumulative_pct"] else ("B" if cum <= T["abc_b_cumulative_pct"] else "C")
    if c["cva"] is None or c["pres"] < T["xyz_min_periods_present"]:
        c["xyz"], c["xyzm"] = None, False
    else:
        c["xyz"] = "X" if c["cva"] < T["xyz_x_max_cv"] else ("Y" if c["cva"] < T["xyz_y_max_cv"] else "Z")
        c["xyzm"] = c["cls"] in ("smooth", "erratic")

tol = EXP["tolerance"]
for sku, e in EXP["per_sku"].items():
    c = calc.get(sku)
    chk(c is not None, "%s in expectations but not in the csv" % sku)
    if not c:
        continue
    chk(e["periods_present"] == c["pres"], "%s periods_present" % sku)
    chk(e["periods_expected_in_span"] == c["span"], "%s span" % sku)
    chk(e["non_zero_periods"] == c["nz"], "%s non_zero" % sku)
    chk(e["zero_periods"] == c["pres"] - c["nz"], "%s zero_periods" % sku)
    chk(e["volume_total"] == c["vol"], "%s volume" % sku)
    chk(e["first_period"] == c["first"].isoformat(), "%s first_period" % sku)
    chk(e["last_period"] == c["last"].isoformat(), "%s last_period" % sku)
    chk(abs(e["volume_share_pct"] - c["share"]) <= tol["volume_share_pct"], "%s share" % sku)
    chk(e["rank_by_volume"] == c["rank"], "%s rank" % sku)
    chk(abs(e["cumulative_volume_share_pct"] - c["cum"]) <= tol["cumulative_volume_share_pct"], "%s cum" % sku)
    chk(abs(e["adi"] - c["adi"]) <= tol["adi"], "%s adi" % sku)
    if c["cv2"] is None:
        chk(e["cv_squared_nonzero"] is None, "%s cv2 should be null" % sku)
    else:
        chk(e["cv_squared_nonzero"] is not None and
            abs(e["cv_squared_nonzero"] - c["cv2"]) <= tol["cv_squared_nonzero"], "%s cv2" % sku)
    chk(abs(e["cv_all_periods"] - c["cva"]) <= tol["cv_all_periods"], "%s cv_all" % sku)
    chk(e["expected_class"] == c["cls"], "%s class: expected %s, recomputed %s" % (sku, e["expected_class"], c["cls"]))
    chk(e["expected_abc_volume"] == c["abc"], "%s abc" % sku)
    chk(e["expected_xyz"] == c["xyz"], "%s xyz" % sku)
    chk(e["xyz_meaningful"] == c["xyzm"], "%s xyz_meaningful" % sku)
chk(set(EXP["per_sku"]) == set(calc), "sku set mismatch")

# stated assertions, checked rather than trusted
counts = collections.Counter(c["cls"] for c in calc.values())
chk(counts == collections.Counter(EXP["portfolio"]["class_counts"]), "class counts")
for q in ("smooth", "erratic", "intermittent", "lumpy"):
    chk(counts[q] > 0, "quadrant %s empty" % q)
chk(all(e["cv_squared_nonzero"] is None for e in EXP["per_sku"].values()
        if e["non_zero_periods"] < 3), "cv2 not null below the minimum")
chk(all(e["expected_class"] == "unclassifiable" for e in EXP["per_sku"].values()
        if e["cv_squared_nonzero"] is None), "null cv2 did not force unclassifiable")
chk(all(e["expected_xyz"] is None for e in EXP["per_sku"].values()
        if e["expected_class"] == "unclassifiable" and e["periods_present"] < 3),
    "xyz set on a sub-3-period line")
chk(all(e["xyz_meaningful"] == (e["expected_class"] in ("smooth", "erratic"))
        for e in EXP["per_sku"].values()), "xyz_meaningful not aligned to class")
chk(abs(sum(e["volume_share_pct"] for e in EXP["per_sku"].values()) - 100) <= 0.05, "shares do not sum to 100")
chk(len({e["expected_abc_volume"] for e in EXP["per_sku"].values()}) == 3, "not all three ABC bands present")
for b in EXP["boundary_cases"]:
    e = EXP["per_sku"][b["sku"]]
    chk(e["expected_class"] == b["expected_class"], "boundary case %s disagrees with per_sku" % b["sku"])
for p in EXP["planted_findings"]:
    chk(p["sku"] in EXP["per_sku"], "planted finding %s missing" % p["sku"])
top = EXP["per_sku"]["PKG-50301"]
chk(top["expected_abc_volume"] == "A" and top["expected_class"] == "lumpy",
    "the planted A-class lumpy line is no longer A-class lumpy")

# quality_interaction block, internal consistency only. The engine is authoritative for the
# finding codes themselves; what is checkable here is that the block covers the fixture exactly.
qi = EXP.get("quality_interaction")
chk(qi is not None, "quality_interaction block missing")
if qi:
    flagged = set(qi["expected_quality"]["per_sku_findings"])
    quiet = set(qi["expected_quality"]["sku_with_no_quality_findings"])
    chk(flagged | quiet == set(calc), "quality_interaction does not cover every sku in the fixture")
    chk(not (flagged & quiet), "a sku is listed as both flagged and quiet")
    chk(qi["expected_validation"]["verdict"] == "accept", "validation verdict changed")
    chk(qi["expected_quality"]["portfolio_band"] == "caveated", "portfolio band changed")
    # the two claims in the block that are checkable against the data
    outl = [s for s, v in qi["expected_quality"]["per_sku_findings"].items() if "OUTLIER_CANDIDATE" in v]
    chk(all(EXP["per_sku"][s]["expected_class"] in ("erratic", "lumpy") for s in outl),
        "the block claims every outlier line is erratic or lumpy, and one is not")
    chk(EXP["per_sku"]["PKG-50602"]["expected_class"] == "unclassifiable",
        "the PKG-50602 non-contradiction example no longer holds")
    chk("classification runs on validated data and emits no quality findings" not in
        " ".join(EXP["assertions"]).lower(), "the withdrawn zero-quality-findings assertion is still present")

# house rules
raw = open(_args.expected).read()
chk("nine box" not in raw.lower() and "nine-box" not in raw.lower(),
    "the phrase nine box is back in the expectations file")
chk("value" not in raw.lower().split("abc_basis")[1][:40], "abc basis is not volume")
# Built by codepoint, not written as literals: this is the check that forbids
# these characters, so the file enforcing the rule must not contain them.
for ch in (chr(0x2014), chr(0x2013), chr(0x2012), chr(0x2015)):
    chk(ch not in raw, "dash character U+%04X found" % ord(ch))

print("checks failed:", len(fail))
for f in fail:
    print("  FAIL", f)
if not fail:
    print("expected_classification.json verified against the csv from scratch")
