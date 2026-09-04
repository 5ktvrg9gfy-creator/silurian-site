#!/usr/bin/env python3
"""Golden run bundle: validation plus quality over 20_portfolio_mixed.csv.

Every value comes from expected_quality.json or the golden manifest. Nothing is
invented. The forecast stage is deliberately absent, because fabricating forecast
numbers in a golden fixture would invite tests to assert against made-up values.
"""
import json, hashlib, copy, os


# Paths. Reads default to the repository copy, resolved from this file's own
# location. Writes have no default and must be named, so a stray run of this
# script cannot overwrite a committed fixture. The committed files are
# authoritative and these scripts are not; see README.md.
import argparse
from pathlib import Path as _Path

_TESTS = _Path(__file__).resolve().parents[1] / "tests"

_ap = argparse.ArgumentParser(description=__doc__)
_ap.add_argument("--manifest", default=str(_TESTS / "run_bundle_fixtures" / "run_manifest.golden.json"),
                 help="the golden run manifest this bundle embeds")
_ap.add_argument("--expected-quality", default=str(_TESTS / "quality_fixtures" / "expected_quality.json"),
                 help="the quality expectations the bundle result is built from")
_ap.add_argument("--out", required=True, help="directory to write the golden bundle into. The committed copy lives in forecast-app/tests/run_bundle_fixtures")
_args = _ap.parse_args()
OUT = _args.out

def canonical(o): return json.dumps(o, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
def sha(o): return hashlib.sha256(canonical(o)).hexdigest()

manifest = json.load(open(_args.manifest))
qual = json.load(open(_args.expected_quality))
f20 = qual["files"]["20_portfolio_mixed.csv"]
bands = f20["assertions"]["expected_bands"]
resolvable = f20["assertions"]["resolvable"]
headline = f20["assertions"]["headline_expectations"]

# strip the forecast stage: this bundle is a quality run
m = copy.deepcopy(manifest)
m["stages"] = [s for s in m["stages"] if s["stage"] != "forecast"]
m["reproducibility"] = {
    "deterministic_stages": ["validation", "quality"],
    "non_deterministic_stages": [],
    "statement": "Validation and quality are bitwise reproducible: the same file with the same options produces byte-identical output."
}
m["integrity"]["manifest_sha256"] = ""
m["integrity"]["content_fingerprint_sha256"] = ""
exact = copy.deepcopy(m)
m_sha = sha(exact)
fp = copy.deepcopy(exact)
for k in ["run_id", "created_at"]: fp.pop(k, None)
fp["source"].pop("received_at", None)
for st in fp["stages"]:
    for k in ["started_at", "completed_at", "duration_ms"]: st.pop(k, None)
fp_sha = sha(fp)
m["integrity"]["manifest_sha256"] = m_sha
m["integrity"]["content_fingerprint_sha256"] = fp_sha

FINDING = {
 "PKG-30220": ("ZERO_VS_MISSING_AMBIGUOUS", "8 periods recorded across a 33 period span, missing periods scattered rather than in one block",
   "Coverage cannot be interpreted until missing is distinguished from zero", "Confirm with the client whether omitted months mean zero demand"),
 "PKG-40001": ("HISTORY_TOO_SHORT", "5 periods of history",
   "Too new to assess. No conclusion can be drawn about this line", "None. This resolves with time, not with better data"),
 "PKG-40002": ("SERIES_DISCONTINUED", "Last period 2025-10-01, 9 periods behind the portfolio cut-off",
   "History is complete and sound, but the line appears discontinued", "Exclude from forward-looking claims unless the client confirms it is active"),
 "PKG-40003": ("GAP_BLOCK", "4 consecutive periods missing from 2024-06 to 2024-09, all gaps in one run",
   "A contiguous block of this shape is usually a system migration rather than zero demand", "Ask what happened in that window and whether the data can be recovered"),
 "PKG-40004": ("OUTLIER_CANDIDATE", "2 periods far above the deseasonalised median",
   "Candidates only. Nothing has been removed or altered", "A planner should check for a promotion, a stock build or a one-off tender"),
 "PKG-40005": ("SERIES_STALE", "Last period 2026-02-01, 5 periods behind the portfolio cut-off",
   "This line stops materially earlier than the rest of the portfolio", "Confirm whether the line is dormant or the extract is incomplete"),
 "PKG-40006": ("VOLUME_IMMATERIAL", "0.01 percent of portfolio volume",
   "Complete and clean data, but too small to warrant management attention", "No action. Reported so attention is not spent here"),
 "PKG-40007": ("HISTORY_TOO_SHORT", "14 periods of history",
   "Usable, but a shorter base than the rest of the portfolio", "Treat conclusions on this line as provisional"),
}

per_sku = {}
for sku, mtr in f20["per_sku"].items():
    rec = dict(mtr)
    rec["band"] = bands[sku]
    if sku in resolvable: rec["resolvable"] = resolvable[sku]
    rec["findings"] = [FINDING[sku][0]] if sku in FINDING else []
    per_sku[sku] = rec

findings = []
for sku, (code, detail, implication, action) in FINDING.items():
    findings.append({"code": code, "scope": "sku", "sku": sku,
                     "metric": {"volume_share_pct": f20["per_sku"][sku]["volume_share_pct"]},
                     "detail": detail, "implication": implication, "action": action})
findings.append({"code": "LONG_TAIL", "scope": "portfolio", "sku": None,
   "metric": {"skus": headline["long_tail_skus_beyond_99pct"], "combined_volume_share_pct": headline["long_tail_volume_share_pct"]},
   "detail": "4 of 12 lines sit beyond the 99 percent cumulative volume line, carrying 0.73 percent between them",
   "implication": "Most quality problems in this portfolio are concentrated in lines that carry almost no volume",
   "action": "Spend attention on the 3 lines carrying 83 percent of volume, all of which are clean"})

exceptions = sorted(
    [{"sku": s, "band": per_sku[s]["band"], "finding": FINDING[s][0],
      "volume_share_pct": f20["per_sku"][s]["volume_share_pct"], "action": FINDING[s][3]}
     for s in FINDING],
    key=lambda e: -e["volume_share_pct"])

bundle = {
  "bundle_schema_version": "1.0",
  "confidentiality": {
    "contains_client_data": True,
    "source_filename": "20_portfolio_mixed.csv",
    "statement": "This bundle contains client data: SKU identifiers, demand metrics and derived findings. It is not the run manifest. The manifest holds no client data and may be archived or shared freely. This file may not."
  },
  "manifest": m,
  "results": {
    "validation": {
      "verdict": "accept",
      "passes": [{"pass": 1, "verdict": "accept", "options_supplied": {}, "findings": []}],
      "findings": [],
      "transformations": [],
      "row_counts": {"rows_in": 324, "rows_out": 324, "series": 12}
    },
    "quality": {
      "portfolio_band": "caveated",
      "headline": {
        "skus_analysed": 12,
        "period_range": {"first": "2023-09-01", "last": "2026-07-01"},
        "grain": "month",
        "clean_volume_share_pct": headline["clean_volume_share_pct"],
        "flagged_sku_share_pct": headline["flagged_sku_share_pct"],
        "flagged_volume_share_pct": headline["flagged_volume_share_pct"],
        "bands": {"clean": 5, "caveated": 5, "not_usable": 2}
      },
      "per_sku": per_sku,
      "findings": findings,
      "exceptions": exceptions,
      "method_note": "Metrics are descriptive. ADI and CV squared are reported as facts and are not classifications, which belong to story 2.1. Outliers are candidates, never corrections. Nothing in the supplied data has been altered."
    }
  },
  "integrity": {
    "bundle_sha256": "",
    "manifest_sha256": m_sha,
    "content_fingerprint_sha256": fp_sha
  }
}

tmp = copy.deepcopy(bundle); tmp["integrity"]["bundle_sha256"] = ""
bundle["integrity"]["bundle_sha256"] = sha(tmp)

with open(os.path.join(OUT, "run_bundle.golden.json"), "w") as f:
    json.dump(bundle, f, indent=2); f.write("\n")

print("bundle sha256   :", bundle["integrity"]["bundle_sha256"])
print("manifest sha256 :", m_sha)
print("fingerprint     :", fp_sha)
print("stages in bundle:", [s["stage"] for s in m["stages"]])
print("skus            :", len(per_sku), "| findings:", len(findings), "| exceptions:", len(exceptions))
print("bytes           :", os.path.getsize(os.path.join(OUT, "run_bundle.golden.json")))
