#!/usr/bin/env python3
"""
Verify a real Silurian Assay run against expected_classification.json v1.2.

Usage:
    python verify_2.1_production.py run.json expected_classification.json

`run.json` is whatever the deployed site returned. The script accepts any of:
  - the full API response containing results.classification and results.quality
  - a bare classification_result
  - {"classification_result": {...}, "quality_result": {...}}

It checks acceptance criteria 1 to 11 and 15 from build brief 2.1 revision 1.2,
and prints one line per criterion. Exit code 0 means every check passed.
No dependencies beyond the standard library.
"""

import json, sys, collections

FIELD = {  # expectations file name -> production name, first match wins
    "expected_class": ["demand_class", "class", "expected_class"],
    "expected_abc_volume": ["abc_volume_class", "abc_volume", "abc", "expected_abc_volume"],
    "expected_xyz": ["xyz", "xyz_class", "expected_xyz"],
}
PASSTHROUGH = ["adi", "cv_squared_nonzero", "cv_all_periods", "volume_share_pct",
               "cumulative_volume_share_pct", "rank_by_volume", "periods_present",
               "non_zero_periods", "zero_periods", "volume_total", "xyz_meaningful"]

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))


def dig(doc, *names):
    """Find the first of `names` anywhere in the top two levels of doc."""
    for n in names:
        if isinstance(doc, dict) and n in doc:
            return doc[n]
    for v in (doc.get("results", {}) if isinstance(doc, dict) else {}).values():
        pass
    r = doc.get("results") if isinstance(doc, dict) else None
    if isinstance(r, dict):
        for n in names:
            if n in r:
                return r[n]
    return None


def get(row, key):
    for cand in FIELD.get(key, [key]):
        if cand in row:
            return row[cand]
    return "__MISSING__"


def main(run_path, exp_path):
    run = json.load(open(run_path))
    exp = json.load(open(exp_path))
    E = exp["per_sku"]
    tol = exp["tolerance"]

    cls = dig(run, "classification", "classification_result") or run
    qual = dig(run, "quality", "quality_result")
    rows = cls.get("per_sku") or cls
    if not isinstance(rows, dict):
        print("could not find a per_sku object in the run file")
        return 2

    # --- criterion 1: every per-SKU value inside tolerance -----------------
    bad = []
    for sku, e in E.items():
        r = rows.get(sku)
        if r is None:
            bad.append("%s missing from the run" % sku)
            continue
        for k in ("expected_class", "expected_abc_volume", "expected_xyz"):
            got = get(r, k)
            if got != e[k]:
                bad.append("%s %s: expected %r, got %r" % (sku, k, e[k], got))
        for k in PASSTHROUGH:
            if k not in e or k not in r:
                continue
            a, b = e[k], r[k]
            if a is None or b is None:
                if a is not b:
                    bad.append("%s %s: expected %r, got %r" % (sku, k, a, b))
            elif isinstance(a, bool) or isinstance(b, bool):
                if a != b:
                    bad.append("%s %s: expected %r, got %r" % (sku, k, a, b))
            else:
                t = tol.get(k, 0)
                if abs(a - b) > t:
                    bad.append("%s %s: expected %r, got %r (tol %s)" % (sku, k, a, b, t))
    extra = set(rows) - set(E)
    if extra:
        bad.append("run contains SKUs not in the fixture: %s" % sorted(extra))
    check("1  per-SKU values match expectations", not bad, "; ".join(bad[:8]))

    # --- criterion 2: five demand states with the fixture counts -----------
    counts = collections.Counter(get(r, "expected_class") for r in rows.values())
    want = collections.Counter(exp["portfolio"]["class_counts"])
    check("2  class counts", counts == want, "got %s" % dict(counts))

    # --- criteria 3 to 6: the boundary and refusal cases ------------------
    def cls_of(s):
        return get(rows.get(s, {}), "expected_class")

    def cv_of(s):
        return rows.get(s, {}).get("cv_squared_nonzero", "__MISSING__")

    check("3  PKG-50401 smooth and PKG-50402 lumpy",
          cls_of("PKG-50401") == "smooth" and cls_of("PKG-50402") == "lumpy",
          "%s / %s" % (cls_of("PKG-50401"), cls_of("PKG-50402")))
    check("4  PKG-50501 intermittent with a numeric CV squared",
          cls_of("PKG-50501") == "intermittent" and isinstance(cv_of("PKG-50501"), (int, float)),
          "%s / %r" % (cls_of("PKG-50501"), cv_of("PKG-50501")))
    ok56 = True
    for s in ("PKG-50502", "PKG-50602"):
        r = rows.get(s, {})
        if cls_of(s) != "unclassifiable" or cv_of(s) is not None or not r.get("unclassifiable_reason"):
            ok56 = False
    check("5  PKG-50502 and PKG-50602 unclassifiable, CV squared null, reason present", ok56,
          "%s cv=%r / %s cv=%r" % (cls_of("PKG-50502"), cv_of("PKG-50502"),
                                   cls_of("PKG-50602"), cv_of("PKG-50602")))
    check("6  PKG-50601 smooth on 10 periods", cls_of("PKG-50601") == "smooth", cls_of("PKG-50601"))

    # --- criterion 7: ABC bands and cumulative reaching 100 ---------------
    abc = collections.Counter(get(r, "expected_abc_volume") for r in rows.values())
    last = max((r.get("cumulative_volume_share_pct", 0) for r in rows.values()), default=0)
    check("7  ABC counts 4/4/7 and cumulative reaches 100.00",
          abc == collections.Counter(exp["portfolio"]["abc_counts"]) and abs(last - 100.0) <= 0.01,
          "abc=%s last_cumulative=%s" % (dict(abc), last))

    # --- criterion 8: xyz_meaningful and the suppression string -----------
    nm = sum(1 for r in rows.values() if r.get("xyz_meaningful") is True)
    DISPLAY = ("xyz_display", "xyz_label", "xyz_text")
    shown = [k for k in DISPLAY if any(k in r for r in rows.values())]
    blanks = []
    if shown:
        k = shown[0]
        blanks = [s for s, r in rows.items()
                  if r.get("xyz_meaningful") is False
                  and str(r.get(k, "")).strip() in ("", "-", "n/a", "N/A", "None", "null")]
    note = "" if shown else "  (no display field in the payload, so the suppression string must be checked on screen)"
    check("8  exactly 7 meaningful XYZ lines, none of the rest blank",
          nm == exp["portfolio"]["xyz_meaningful_count"] and not blanks,
          "meaningful=%d blank=%s%s" % (nm, blanks[:6], note))

    # --- criterion 9: metrics equal to the quality result -----------------
    if isinstance(qual, dict):
        qrows = qual.get("per_sku", {})
        mism = []
        for sku, r in rows.items():
            q = qrows.get(sku)
            if not q:
                mism.append("%s absent from quality" % sku)
                continue
            for k in ("adi", "cv_squared_nonzero"):
                if k in r and k in q and r[k] != q[k]:
                    mism.append("%s %s: classification %r, quality %r" % (sku, k, r[k], q[k]))
        check("9  exact value equality with quality_result", not mism, "; ".join(mism[:6]))
    else:
        check("9  exact value equality with quality_result", False,
              "quality_result not present in the run file, so this cannot be checked here")

    # --- criterion 10: the quality findings are still raised --------------
    qi = exp["quality_interaction"]["expected_quality"]
    if isinstance(qual, dict):
        band = qual.get("portfolio_band")
        got = {}
        for f in qual.get("findings", []) or []:
            sku = f.get("sku") or f.get("subject") or "PORTFOLIO"
            got.setdefault(sku, set()).add(f.get("code") or f.get("finding"))
        missing = []
        for sku, codes in qi["per_sku_findings"].items():
            for c in codes:
                if c not in got.get(sku, set()):
                    missing.append("%s %s" % (sku, c))
        portfolio_ok = any("LONG_TAIL_CONCENTRATION" in v for v in got.values())
        check("10 quality still caveated with the recorded findings",
              band == "caveated" and not missing and portfolio_ok,
              "band=%r missing=%s" % (band, missing[:6]))
    else:
        check("10 quality still caveated with the recorded findings", False,
              "quality_result not present in the run file")

    # --- criterion 11: no contradiction on PKG-50602 ----------------------
    check("11 PKG-50602 unclassifiable while quality calls it short and discontinued",
          cls_of("PKG-50602") == "unclassifiable")

    # --- criterion 15: no quality band or finding inside classification ---
    leaked = [s for s, r in rows.items()
              if any(k in r for k in ("quality_band", "band", "findings", "quality_findings"))]
    check("15 classification_result carries no quality band or finding", not leaked,
          "leaked on %s" % leaked[:6])

    width = max(len(n) for n, _, _ in results)
    fails = 0
    for name, ok, detail in results:
        fails += 0 if ok else 1
        print("%-*s  %s%s" % (width, name, "PASS" if ok else "FAIL",
                              "" if ok or not detail else "   " + detail))
    print()
    print("%d of %d checks passed" % (len(results) - fails, len(results)))
    return 1 if fails else 0


if __name__ == "__main__":
    import argparse
    from pathlib import Path as _Path

    _TESTS = _Path(__file__).resolve().parents[1] / "tests"
    _ap = argparse.ArgumentParser(description=__doc__)
    _ap.add_argument("run", help="JSON response saved from a real run. This script never calls the application")
    _ap.add_argument("--expected", default=str(_TESTS / "classification_fixtures" / "expected_classification.json"),
                     help="the expectations file to check the run against")
    _a = _ap.parse_args()
    sys.exit(main(_a.run, _a.expected))
