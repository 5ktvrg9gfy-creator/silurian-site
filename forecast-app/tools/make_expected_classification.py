#!/usr/bin/env python3
"""Build expected_classification.json from the generated sprint 2 fixture metrics."""

import json, collections


# Paths. Reads default to the repository copy, resolved from this file's own
# location. Writes have no default and must be named, so a stray run of this
# script cannot overwrite a committed fixture. The committed files are
# authoritative and these scripts are not; see README.md.
import argparse
from pathlib import Path as _Path

_TESTS = _Path(__file__).resolve().parents[1] / "tests"

_ap = argparse.ArgumentParser(description=__doc__)
_ap.add_argument("--metrics", required=True, help="the handoff written by make_sprint2_fixture.py --metrics-out")
_ap.add_argument("--out", required=True, help="file to write. The committed copy is forecast-app/tests/classification_fixtures/expected_classification.json")
_args = _ap.parse_args()

M = json.load(open(_args.metrics))
per = M["per_sku"]
total = M["portfolio_volume"]

ORDER = sorted(per.items(), key=lambda kv: kv[1]["rank_by_volume"])

reasons = {
    "PKG-50502": "only 2 non-zero observations, below the minimum of 3",
    "PKG-50602": "single observation, no variability can be estimated",
}

per_sku = {}
for sku, v in ORDER:
    e = {
        "rank_by_volume": v["rank_by_volume"],
        "first_period": v["first_period"],
        "last_period": v["last_period"],
        "periods_present": v["periods_present"],
        "periods_expected_in_span": v["periods_expected_in_span"],
        "non_zero_periods": v["non_zero_periods"],
        "zero_periods": v["zero_periods"],
        "volume_total": v["volume_total"],
        "volume_share_pct": v["volume_share_pct"],
        "cumulative_volume_share_pct": v["cumulative_volume_share_pct"],
        "adi": v["adi"],
        "cv_squared_nonzero": v["cv_squared_nonzero"],
        "cv_all_periods": v["cv_all_periods"],
        "expected_class": v["expected_class"],
        "expected_abc_volume": v["expected_abc_volume"],
        "expected_xyz": v["expected_xyz"],
        "xyz_meaningful": v["xyz_meaningful"],
    }
    if v["expected_class"] == "unclassifiable":
        e["unclassifiable_reason"] = reasons.get(sku, "insufficient non-zero observations")
    per_sku[sku] = e

counts = collections.Counter(v["expected_class"] for v in per.values())
vol_by_class = collections.defaultdict(float)
for v in per.values():
    vol_by_class[v["expected_class"]] += v["volume_share_pct"]
vol_by_class = {k: round(x, 2) for k, x in sorted(vol_by_class.items(), key=lambda kv: -kv[1])}

# ABC crossed with demand class, the recommended primary grid
cells = collections.defaultdict(list)
for sku, v in ORDER:
    cells["%s/%s" % (v["expected_abc_volume"], v["expected_class"])].append(sku)
cells = {k: sorted(x) for k, x in sorted(cells.items())}

doc = {
    "version": "1.0",
    "story": "2.1 Demand classification and portfolio segmentation",
    "fixture": "30_classification_portfolio.csv",
    "as_of_date": "2026-08-01",
    "portfolio_cutoff": "2026-07-01",
    "grain": "month",
    "tolerance": {
        "adi": 0.02,
        "cv_squared_nonzero": 0.005,
        "cv_all_periods": 0.005,
        "volume_share_pct": 0.05,
        "cumulative_volume_share_pct": 0.1,
    },
    "note": (
        "Metrics are generated from the fixture data and are exact within tolerance. "
        "Class, ABC and XYZ are functions of those metrics under the thresholds below, "
        "so any disagreement is either a threshold difference or a metric defect, and "
        "the boundary_cases block tells you which. This fixture validates cleanly: it "
        "carries no quality defects, so classification is tested on its own."
    ),
    "thresholds": {
        "adi_cut": 1.32,
        "cv_squared_cut": 0.49,
        "cv_squared_estimator": "population",
        "cv_squared_min_nonzero_observations": 3,
        "cv_squared_basis": "non_zero_periods_only",
        "abc_basis": "volume",
        "abc_a_cumulative_pct": 80,
        "abc_b_cumulative_pct": 95,
        "abc_rule": "cumulative share is taken inclusive of the ranked line, and the line that crosses a cut sits in the band it crosses into",
        "xyz_basis": "cv_all_periods",
        "xyz_x_max_cv": 0.5,
        "xyz_y_max_cv": 1.0,
        "xyz_min_periods_present": 3,
        "note": (
            "ADI is periods present divided by non-zero periods, counted over the span "
            "from a line's first to its last period, not over the portfolio span. "
            "CV squared is computed on non-zero periods only, with the population "
            "estimator dividing by n, matching the quality engine shipped in 1.2. "
            "XYZ is computed on all periods including zeros, which is why it is not "
            "meaningful on intermittent and lumpy lines."
        ),
    },
    "portfolio": {
        "sku_count": len(per),
        "row_count": sum(v["periods_present"] for v in per.values()),
        "volume_total": total,
        "class_counts": dict(counts),
        "volume_share_by_class_pct": vol_by_class,
        "abc_counts": dict(collections.Counter(v["expected_abc_volume"] for v in per.values())),
        "xyz_meaningful_count": sum(1 for v in per.values() if v["xyz_meaningful"]),
        "abc_by_class_cells": cells,
    },
    "boundary_cases": [
        {
            "sku": "PKG-50401",
            "tests": "both cuts from the smooth side",
            "adi": per["PKG-50401"]["adi"],
            "cv_squared_nonzero": per["PKG-50401"]["cv_squared_nonzero"],
            "expected_class": "smooth",
            "assertion": "adi below 1.32 and cv squared below 0.49, so a wrong-sided comparison operator or a sample estimator moves this line",
        },
        {
            "sku": "PKG-50402",
            "tests": "both cuts from the lumpy side",
            "adi": per["PKG-50402"]["adi"],
            "cv_squared_nonzero": per["PKG-50402"]["cv_squared_nonzero"],
            "expected_class": "lumpy",
            "assertion": "adi at or above 1.32 and cv squared at or above 0.49, the mirror of PKG-50401",
        },
        {
            "sku": "PKG-50501",
            "tests": "the minimum observation rule at exactly the minimum",
            "non_zero_periods": 3,
            "expected_class": "intermittent",
            "assertion": "3 non-zero observations is enough, so cv squared is a number and the line classifies",
        },
        {
            "sku": "PKG-50502",
            "tests": "the minimum observation rule one below the minimum",
            "non_zero_periods": 2,
            "expected_class": "unclassifiable",
            "assertion": "cv squared is null, never 0.0, and the line must not fall into smooth by default",
        },
        {
            "sku": "PKG-50602",
            "tests": "a single observation",
            "non_zero_periods": 1,
            "expected_class": "unclassifiable",
            "assertion": "adi is 1.0 and cv squared is null. A line that reports smooth here has the 1.2 defect back",
        },
        {
            "sku": "PKG-50601",
            "tests": "a short but complete history",
            "periods_present": 10,
            "expected_class": "smooth",
            "assertion": "10 periods is short, not unclassifiable. Classification refuses on observation count, not on history length, and any history caveat comes from the quality stage",
        },
    ],
    "planted_findings": [
        {
            "sku": "PKG-50301",
            "finding": "a material line that no statistical method will forecast well",
            "why_it_matters": (
                "third by volume at %s percent of the portfolio and ABC class A, yet lumpy. "
                "This is the consulting finding the nine box exists to surface. If the "
                "interface shows the grid but a client cannot see this line inside a minute, "
                "the presentation has failed even though the numbers are right."
            ) % per["PKG-50301"]["volume_share_pct"],
        },
        {
            "sku": "PKG-50201",
            "finding": "intermittent but regular, at 5 percent of volume",
            "why_it_matters": "orders every third month at a consistent size. Routing should treat this differently from PKG-50301 despite both being sporadic, which is the whole point of separating ADI from CV squared",
        },
        {
            "sku": "PKG-50102",
            "finding": "erratic on a small line",
            "why_it_matters": "demand every period, size swinging by an order of magnitude. Sits in class C, so it tests that the grid does not hide non-A problems entirely",
        },
    ],
    "assertions": [
        "All four SBC quadrants are populated, so a run that returns three classes has a threshold or estimator defect.",
        "Two lines are unclassifiable and neither carries a class letter. Unclassifiable is a fifth state, not a nulled smooth.",
        "cv_squared_nonzero is null, not zero, on every line with fewer than 3 non-zero observations.",
        "expected_xyz is null on any line with fewer than 3 periods present.",
        "xyz_meaningful is true only for smooth and erratic lines. It is a property of the class, not of the value.",
        "Volume shares sum to 100 within 0.05.",
        "ABC bands are assigned on cumulative volume in rank order, and the fixture contains a line at each band.",
        "Classification runs on validated data and emits no quality findings. Any quality finding on this fixture is a stage boundary defect, per the 1.6 rule.",
    ],
    "per_sku": per_sku,
}

json.dump(doc, open(_args.out, "w"), indent=2)
print("written")
print("class counts:", dict(counts))
print("volume by class:", vol_by_class)
print("cells:")
for k, v in cells.items():
    print("  ", k, v)
