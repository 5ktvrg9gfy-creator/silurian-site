#!/usr/bin/env python3
"""Quality fixtures for story 1.2. Every file here passes 1.1 validation."""

import os, json, math, random, datetime as dt
from statistics import median, mean


# Paths. Reads default to the repository copy, resolved from this file's own
# location. Writes have no default and must be named, so a stray run of this
# script cannot overwrite a committed fixture. The committed files are
# authoritative and these scripts are not; see README.md.
import argparse
from pathlib import Path as _Path

_TESTS = _Path(__file__).resolve().parents[1] / "tests"

_ap = argparse.ArgumentParser(description=__doc__)
_ap.add_argument("--out", required=True, help="directory to write the fixtures into. The committed copies live in forecast-app/tests/quality_fixtures")
_ap.add_argument("--control", default=str(_TESTS / "quality_fixtures" / "00_clean_control.csv"),
                 help="the clean control CSV this reads")
_args = _ap.parse_args()
OUT, CONTROL = _args.out, _args.control
os.makedirs(OUT, exist_ok=True)
random.seed(4419)

AS_OF = dt.date(2026, 8, 1)          # first of the month after the last complete period
SPAN_START = dt.date(2023, 9, 1)
SPAN_END = dt.date(2026, 7, 1)       # last complete month


def month_range(a, b):
    out, y, m = [], a.year, a.month
    while dt.date(y, m, 1) <= b:
        out.append(dt.date(y, m, 1))
        m += 1
        if m == 13:
            m, y = 1, y + 1
    return out


ALL_MONTHS = month_range(SPAN_START, SPAN_END)


def midx(d):
    return (d.year - SPAN_START.year) * 12 + (d.month - SPAN_START.month)


def seasonal(d, peaks, amp):
    return 1.0 + (amp if d.month in peaks else 0.0)


def write_long(name, series):
    """series: {sku: {date: value}} preserving insertion order."""
    rows = ["sku,date,demand"]
    for sku, points in series.items():
        for d in sorted(points):
            rows.append("%s,%s,%d" % (sku, d.isoformat(), points[d]))
    with open(os.path.join(OUT, name), "w") as f:
        f.write("\n".join(rows) + "\n")
    return series


# ----------------------------------------------------------- 20 mixed portfolio
def mixed_portfolio():
    s = {}

    def build(sku, base, noise, trend=0.0, peaks=(), amp=0.0, months=None, floor=0):
        pts = {}
        for d in (months if months is not None else ALL_MONTHS):
            i = midx(d)
            v = (base + trend * i) * seasonal(d, peaks, amp) + random.gauss(0, noise)
            pts[d] = max(floor, int(round(v)))
        s[sku] = pts
        return pts

    # three clean high volume lines carrying most of the portfolio
    build("PKG-10432", 8200, 620, trend=12, peaks=(3, 9, 10), amp=0.20)
    build("PKG-10518", 5400, 380, trend=-18, peaks=(11,), amp=0.15)
    build("PKG-20077", 11800, 900, trend=-45, peaks=(4, 5), amp=0.12)

    # intermittent, zeros recorded
    pts = {}
    for d in ALL_MONTHS:
        pts[d] = random.choice([0, 0, 0, 0, 210, 260, 180]) if random.random() < 0.9 else 0
    s["PKG-30219"] = pts

    # same shape, zero months simply absent from the export
    pts = {}
    for d in ALL_MONTHS:
        if random.random() < 0.28:
            pts[d] = random.randint(150, 300)
    s["PKG-30220"] = pts

    # new introduction, five periods
    build("PKG-40001", 640, 70, months=month_range(dt.date(2026, 3, 1), SPAN_END))

    # discontinued in October 2025
    build("PKG-40002", 1150, 120, months=month_range(SPAN_START, dt.date(2025, 10, 1)))

    # mid-history gap block, four months missing during a system migration
    gap = set(month_range(dt.date(2024, 6, 1), dt.date(2024, 9, 1)))
    build("PKG-40003", 2300, 210, months=[d for d in ALL_MONTHS if d not in gap])

    # flat line with two one-off spikes
    pts = build("PKG-40004", 300, 25)
    pts[dt.date(2024, 11, 1)] = 2400
    pts[dt.date(2025, 12, 1)] = 1980

    # stale, stops five months before as_of
    build("PKG-40005", 760, 80, months=month_range(SPAN_START, dt.date(2026, 2, 1)))

    # very low volume noise
    pts = {}
    for d in ALL_MONTHS:
        pts[d] = random.randint(0, 5)
    s["PKG-40006"] = pts

    # clean but short, started June 2025
    build("PKG-40007", 1900, 150, months=month_range(dt.date(2025, 6, 1), SPAN_END))

    return write_long("20_portfolio_mixed.csv", s)


# --------------------------------------------------------------- 21 stale extract
def stale_extract():
    s = {}
    months = month_range(SPAN_START, dt.date(2026, 3, 1))   # four months stale
    for sku, base, noise in [("PKG-10432", 8200, 600), ("PKG-10518", 5400, 380),
                             ("PKG-20077", 11800, 900), ("PKG-40007", 1900, 150)]:
        s[sku] = {d: max(0, int(round(base + random.gauss(0, noise)))) for d in months}
    return write_long("21_stale_extract.csv", s)


# ------------------------------------------------------- 22 outliers and level shift
def outliers_and_shift():
    s = {}

    # A: genuine December peak every year. Must NOT be flagged as an outlier.
    s["SKU-SEASONAL"] = {d: max(0, int(round((900 if d.month != 12 else 2700) + random.gauss(0, 60))))
                         for d in ALL_MONTHS}

    # B: flat with one true one-off spike. Must be flagged.
    pts = {d: max(0, int(round(300 + random.gauss(0, 22)))) for d in ALL_MONTHS}
    pts[dt.date(2025, 5, 1)] = 2400
    s["SKU-SPIKE"] = pts

    # C: level shift of 1.6x, not a pack factor. Level shift, not a unit break.
    pts = {}
    for d in ALL_MONTHS:
        base = 400 if d < dt.date(2025, 7, 1) else 650
        pts[d] = max(0, int(round(base + random.gauss(0, 30))))
    s["SKU-LEVELSHIFT"] = pts

    # D: otherwise steady line with a single zero month, likely a stockout
    pts = {d: max(0, int(round(520 + random.gauss(0, 35)))) for d in ALL_MONTHS}
    pts[dt.date(2025, 3, 1)] = 0
    s["SKU-SUSPECTZERO"] = pts

    return write_long("22_outliers_and_shift.csv", s)


# ---------------------------------------------------------------------- metrics
def metrics_for(series, as_of=AS_OF):
    out = {}
    portfolio_volume = sum(sum(p.values()) for p in series.values())
    for sku, pts in series.items():
        ds = sorted(pts)
        first, last = ds[0], ds[-1]
        expected = len(month_range(first, last))
        present = len(ds)
        gaps = expected - present
        # longest run of missing months inside the span
        idx = {midx(d) for d in ds}
        longest_gap, run = 0, 0
        for i in range(midx(first), midx(last) + 1):
            run = 0 if i in idx else run + 1
            longest_gap = max(longest_gap, run)
        vals = [pts[d] for d in ds]
        zeros = sum(1 for v in vals if v == 0)
        nz = [v for v in vals if v > 0]
        longest_zero, run = 0, 0
        for v in vals:
            run = run + 1 if v == 0 else 0
            longest_zero = max(longest_zero, run)
        adi = (present / len(nz)) if nz else None
        if len(nz) > 1:
            m = mean(nz)
            cv = (sum((x - m) ** 2 for x in nz) / (len(nz) - 1)) ** 0.5 / m if m else None
            cv2 = round(cv ** 2, 3) if cv is not None else None
        else:
            cv, cv2 = None, None
        trailing = midx(as_of) - midx(last) - 1
        vol = sum(vals)
        out[sku] = {
            "first_period": first.isoformat(),
            "last_period": last.isoformat(),
            "periods_present": present,
            "periods_expected_in_span": expected,
            "gap_count": gaps,
            "longest_gap": longest_gap,
            "coverage_pct": round(100.0 * present / expected, 1),
            "zero_periods": zeros,
            "zero_share_pct": round(100.0 * zeros / present, 1),
            "longest_zero_run": longest_zero,
            "adi": round(adi, 2) if adi else None,
            "cv_squared_nonzero": cv2,
            "trailing_gap_periods": trailing,
            "volume_total": vol,
            "volume_share_pct": round(100.0 * vol / portfolio_volume, 2),
        }
    return out, portfolio_volume


clean = {}
with open(CONTROL) as f:
    next(f)
    for line in f:
        sku, d, v = line.strip().split(",")
        clean.setdefault(sku, {})[dt.date.fromisoformat(d)] = int(v)

mixed = mixed_portfolio()
stale = stale_extract()
outl = outliers_and_shift()

expectations = {
  "version": "1.0",
  "story": "1.2 Data quality report",
  "as_of_date": AS_OF.isoformat(),
  "grain": "month",
  "tolerance": {
    "coverage_pct": 0.1,
    "zero_share_pct": 0.1,
    "adi": 0.05,
    "cv_squared_nonzero": 0.05,
    "volume_share_pct": 0.1
  },
  "note": "Structural metrics are exact and generated from the fixture data. Outlier expectations are stated as must_flag and must_not_flag rather than counts, because the method may legitimately vary.",
  "files": {}
}

for name, series in [("00_clean_control.csv", clean),
                     ("20_portfolio_mixed.csv", mixed),
                     ("21_stale_extract.csv", stale),
                     ("22_outliers_and_shift.csv", outl)]:
    m, vol = metrics_for(series)
    expectations["files"][name] = {
        "sku_count": len(series),
        "portfolio_volume": vol,
        "per_sku": m
    }

# hand-written behavioural assertions on top of the computed facts
expectations["files"]["00_clean_control.csv"]["assertions"] = {
    "portfolio_band": "clean",
    "must_flag": [],
    "must_not_flag": ["PKG-10432", "PKG-10518", "PKG-20077", "PKG-30219"],
    "note": "Control. Any quality flag here is a false positive. Note the file ends well before as_of_date, so staleness is expected to be reported as a fact about the extract, not as a per-SKU defect."
}
expectations["files"]["20_portfolio_mixed.csv"]["assertions"] = {
    "portfolio_band": "caveated",
    "must_flag": {
        "PKG-30220": ["ZERO_VS_MISSING_AMBIGUOUS"],
        "PKG-40001": ["HISTORY_TOO_SHORT"],
        "PKG-40002": ["SERIES_DISCONTINUED"],
        "PKG-40003": ["GAP_BLOCK"],
        "PKG-40004": ["OUTLIER_CANDIDATE"],
        "PKG-40005": ["SERIES_STALE"],
        "PKG-40006": ["VOLUME_IMMATERIAL"],
        "PKG-40007": ["HISTORY_TOO_SHORT"]
    },
    "must_not_flag": ["PKG-10432", "PKG-10518", "PKG-20077"],
    "value_weighting": "The three clean SKUs must carry the large majority of portfolio volume. The report must state both the share of SKUs flagged and the share of volume flagged, and they must differ materially.",
    "note": "Flagship demo file. Also the seed for the sprint 5.6 worked demo dataset."
}
expectations["files"]["21_stale_extract.csv"]["assertions"] = {
    "portfolio_band": "caveated",
    "must_flag_portfolio": ["EXTRACT_STALE"],
    "must_not_flag": ["PKG-10432", "PKG-10518", "PKG-20077", "PKG-40007"],
    "note": "Every series ends four periods before as_of_date. This is one finding about the extract, not four findings about SKUs. Reporting it per SKU is the failure mode to avoid."
}
expectations["files"]["22_outliers_and_shift.csv"]["assertions"] = {
    "portfolio_band": "caveated",
    "must_flag": {
        "SKU-SPIKE": ["OUTLIER_CANDIDATE"],
        "SKU-LEVELSHIFT": ["LEVEL_SHIFT"],
        "SKU-SUSPECTZERO": ["SUSPECT_ZERO"]
    },
    "must_not_flag": ["SKU-SEASONAL"],
    "must_not_raise": {
        "SKU-LEVELSHIFT": ["UNIT_SCALE_BREAK_SUSPECTED"],
        "SKU-SEASONAL": ["OUTLIER_CANDIDATE"]
    },
    "note": "SKU-SEASONAL has a genuine 3x December peak in all three years. Flagging it as an outlier is the single most common defect in naive implementations. SKU-LEVELSHIFT moves by 1.6x, which is not a pack factor, so it is a level shift and not a unit break."
}

with open(os.path.join(OUT, "expected_quality.json"), "w") as f:
    json.dump(expectations, f, indent=2)
    f.write("\n")

for name in ["20_portfolio_mixed.csv", "21_stale_extract.csv", "22_outliers_and_shift.csv"]:
    print(name, os.path.getsize(os.path.join(OUT, name)), "bytes")

print("\nmixed portfolio volume share, top 3:")
m = expectations["files"]["20_portfolio_mixed.csv"]["per_sku"]
top = sorted(m.items(), key=lambda kv: -kv[1]["volume_share_pct"])[:3]
for sku, d in top:
    print("  %-12s %5.2f%%  coverage %5.1f%%  periods %2d" % (sku, d["volume_share_pct"], d["coverage_pct"], d["periods_present"]))
print("  top 3 combined: %.1f%%" % sum(d["volume_share_pct"] for _, d in top))
flagged = set(expectations["files"]["20_portfolio_mixed.csv"]["assertions"]["must_flag"])
print("  flagged SKUs: %d of %d (%.0f%% of SKUs), carrying %.1f%% of volume"
      % (len(flagged), len(m), 100.0 * len(flagged) / len(m),
         sum(m[s]["volume_share_pct"] for s in flagged)))
