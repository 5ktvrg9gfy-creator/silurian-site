#!/usr/bin/env python3
"""Golden run manifests v1.1: one quality-routed forecast, one rejected validation."""

import json, hashlib, os, copy


# Paths. Reads default to the repository copy, resolved from this file's own
# location. Writes have no default and must be named, so a stray run of this
# script cannot overwrite a committed fixture. The committed files are
# authoritative and these scripts are not; see README.md.
import argparse
from pathlib import Path as _Path

_TESTS = _Path(__file__).resolve().parents[1] / "tests"

_ap = argparse.ArgumentParser(description=__doc__)
_ap.add_argument("--source-dir", default=str(_TESTS / "run_manifest_fixtures"),
                 help="directory holding the source CSVs the golden manifests are built from")
_ap.add_argument("--out", required=True, help="directory to write the goldens into. The committed copies live in forecast-app/tests/run_manifest_fixtures")
_args = _ap.parse_args()
OUT, SRC = _args.out, _args.source_dir


def sha_bytes(b):
    return hashlib.sha256(b).hexdigest()


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def sha_obj(obj):
    return sha_bytes(canonical(obj))


FINGERPRINT_STRIP = ["run_id", "created_at"]
STAGE_STRIP = ["started_at", "completed_at", "duration_ms"]


def integrity_hashes(manifest):
    exact = copy.deepcopy(manifest)
    exact["integrity"]["manifest_sha256"] = ""
    exact["integrity"]["content_fingerprint_sha256"] = ""
    manifest_sha = sha_obj(exact)

    fp = copy.deepcopy(exact)
    for k in FINGERPRINT_STRIP:
        fp.pop(k, None)
    fp["source"].pop("received_at", None)
    for st in fp["stages"]:
        for k in STAGE_STRIP:
            st.pop(k, None)
    return manifest_sha, sha_obj(fp)


def verify_graph(manifest):
    known = {manifest["source"]["sha256"]}
    for st in manifest["stages"]:
        if st["input_ref"]["sha256"] not in known:
            return False
        known.add(st["output_ref"]["sha256"])
    return True


THRESHOLDS = {
    "history_short_periods": 18, "history_not_usable_periods": 6, "coverage_not_usable_pct": 50,
    "series_stale_trailing_periods": 3, "series_discontinued_trailing_periods": 6,
    "extract_stale_trailing_periods": 2, "gap_block_min_run": 3, "gap_block_concentration_ratio": 0.8,
    "sparse_coverage_pct": 70, "volume_immaterial_share_pct": 0.1, "long_tail_cumulative_pct": 99,
    "suspect_zero_max_zero_share_pct": 10, "suspect_zero_max_adi": 1.25, "outlier_modified_z": 3.5,
    "outlier_deseasonalise_min_periods": 24, "level_shift_min_run": 3,
    "level_shift_pack_factor_tolerance_pct": 12, "portfolio_not_usable_volume_pct": 20,
    "portfolio_caveated_volume_pct": 5
}

ENVIRONMENT = {
    "app_version": "SUPPLIED_BY_DEPLOYMENT",
    "git_commit": "0000000",
    "runtime": "SUPPLIED_BY_DEPLOYMENT",
    "key_libraries": {"SUPPLIED_BY_DEPLOYMENT": "only libraries whose version can change numerical output"},
    "container_image_digest": "SUPPLIED_BY_DEPLOYMENT",
    "region": "SUPPLIED_BY_DEPLOYMENT"
}

# ------------------------------------------------------------------ golden A
src_a = open(os.path.join(SRC, "20_portfolio_mixed.csv"), "rb").read()
sha_a = sha_bytes(src_a)
norm_a = sha_obj({"source_sha256": sha_a, "rows": 324, "series": 12, "grain": "month", "transformations": []})
qual_a = sha_obj({"input_sha256": norm_a, "portfolio_band": "caveated", "as_of_date": "2026-08-01", "weighting": "volume"})
fcst_a = sha_obj({"input_sha256": norm_a, "horizon": 12, "series_included": 9, "provider": "bigquery_ai_forecast"})
ref_series = sha_obj({"reference": "silurian_canary_v1", "points": 48})
ref_output = sha_obj({"canary_output": "baseline_recorded_at_first_run"})

golden = {
  "schema_version": "1.1",
  "run_id": "run_" + hashlib.sha256((sha_a + "2026-08-28T17:12:04Z").encode()).hexdigest()[:32],
  "created_at": "2026-08-28T17:12:04Z",
  "as_of_date": "2026-08-01",
  "as_of_source": "user",
  "source": {
    "filename": "20_portfolio_mixed.csv", "bytes": len(src_a), "sha256": sha_a, "rows_raw": 324,
    "encoding_detected": "utf-8", "delimiter_detected": ",", "received_at": "2026-08-28T17:12:01Z"
  },
  "stages": [
    {
      "stage": "validation", "story": "1.1", "engine_version": "1.0.0",
      "started_at": "2026-08-28T17:12:01Z", "completed_at": "2026-08-28T17:12:02Z", "duration_ms": 840,
      "input_ref": {"type": "source_file", "sha256": sha_a, "rows": 324},
      "output_ref": {"type": "normalised_dataset", "sha256": norm_a, "rows": 324, "series": 12},
      "options": {"as_of_date": "2026-08-01", "as_of_source": "user", "encoding": "utf-8",
                  "encoding_source": "detected", "delimiter": ",", "delimiter_source": "detected",
                  "header_row": 1, "column_map": {"sku": "sku", "date": "date", "demand": "demand"},
                  "column_map_source": "canonical", "date_order": "iso", "decimal_convention": "point",
                  "grain_hint": None},
      "passes": [{"pass": 1, "verdict": "accept", "options_supplied": {}, "finding_codes": []}],
      "transformations": [],
      "outcome": {"verdict": "accept", "findings": 0, "rows_in": 324, "rows_out": 324, "series": 12}
    },
    {
      "stage": "quality", "story": "1.2", "engine_version": "1.0.0",
      "started_at": "2026-08-28T17:12:02Z", "completed_at": "2026-08-28T17:12:03Z", "duration_ms": 610,
      "input_ref": {"type": "normalised_dataset", "sha256": norm_a, "rows": 324, "series": 12},
      "output_ref": {"type": "quality_result", "sha256": qual_a, "series": 12},
      "options": {"as_of_date": "2026-08-01", "grain": "month", "grain_source": "inferred",
                  "grain_evidence": "modal spacing, 12 of 12 series agree",
                  "weighting": "volume", "thresholds": THRESHOLDS},
      "outcome": {"portfolio_band": "caveated", "series": 12,
                  "bands": {"clean": 5, "caveated": 5, "not_usable": 2},
                  "flagged_sku_share_pct": 66.7, "flagged_volume_share_pct": 16.43,
                  "clean_volume_share_pct": 83.58,
                  "finding_codes": ["ZERO_VS_MISSING_AMBIGUOUS", "HISTORY_TOO_SHORT", "SERIES_DISCONTINUED",
                                    "GAP_BLOCK", "OUTLIER_CANDIDATE", "SERIES_STALE", "VOLUME_IMMATERIAL",
                                    "LONG_TAIL"]}
    },
    {
      "stage": "forecast", "story": "MVP forecast path, routed by 1.2 bands",
      "engine_version": "0.9.0",
      "started_at": "2026-08-28T17:12:03Z", "completed_at": "2026-08-28T17:12:06Z", "duration_ms": 3120,
      "input_ref": {"type": "normalised_dataset", "sha256": norm_a, "rows": 324, "series": 12},
      "output_ref": {"type": "forecast_result", "sha256": fcst_a, "series": 9},
      "options": {"horizon": 12, "exclude_bands": ["not_usable"], "confidence_level": 0.9,
                  "context_window": 512, "context_window_source": "pinned_by_silurian",
                  "provider": "bigquery_timesfm", "bigquery_use_query_cache": False},
      "model": {
        "family": "TimesFM", "version": "2.5", "provider": "BigQuery AI.FORECAST",
        "checkpoint": "provider_managed_not_exposed",
        "context_window_requested": 512,
        "context_points_supplied": {"min": 8, "median": 35, "max": 35},
        "horizon": 12,
        "confidence_level": 0.9,
        "interval_bounds": [0.05, 0.95],
        "backend": "provider_managed_not_exposed",
        "precision": "provider_managed_not_exposed",
        "preprocessing": {"applied_by_silurian": "none", "note": "Provider internals are not inferred"},
        "provider_limitations": [
          "Google manages the underlying weights and does not expose a revision hash through AI.FORECAST",
          "Backend and numerical precision are not exposed by the service",
          "The friendly version string can remain unchanged while the managed model is updated, so drift is detected by reference_check rather than by version"
        ],
        "reference_check": {
          "reference_series_sha256": ref_series,
          "reference_output_sha256": ref_output,
          "baseline_output_sha256": ref_output,
          "status": "match",
          "checked_at": "2026-08-28T17:12:06Z"
        },
        "series_included": 9, "series_excluded": 3,
        "exclusion_reasons": {"not_usable_band": 2, "insufficient_context": 1}
      },
      "determinism": {
        "class": "unknown",
        "tolerance_pct": None,
        "seed": None,
        "statement": "Not yet measured. Ten repeats on the deployed path with the BigQuery query cache disabled, then set bitwise or tolerant with the measured figure."
      },
      "outcome": {"series_forecast": 9, "horizon": 12, "points_produced": 108}
    }
  ],
  "environment": ENVIRONMENT,
  "reproducibility": {
    "deterministic_stages": ["validation", "quality"],
    "non_deterministic_stages": ["forecast"],
    "statement": "Validation and quality are bitwise reproducible: the same file with the same options produces byte-identical output. The forecast stage runs on a managed BigQuery model whose reproducibility has not yet been measured, so it is reported as unknown rather than assumed stable."
  },
  "integrity": {"manifest_sha256": "", "content_fingerprint_sha256": "", "chain_verified": True}
}

golden["integrity"]["chain_verified"] = verify_graph(golden)
m_sha, fp_sha = integrity_hashes(golden)
golden["integrity"]["manifest_sha256"] = m_sha
golden["integrity"]["content_fingerprint_sha256"] = fp_sha

with open(os.path.join(OUT, "run_manifest.golden.json"), "w") as f:
    json.dump(golden, f, indent=2); f.write("\n")

# ------------------------------------------------------------------ golden B
src_b = open(os.path.join(SRC, "02_date_disorder.csv"), "rb").read()
sha_b = sha_bytes(src_b)
rejected_out = sha_obj({"source_sha256": sha_b, "verdict": "reject", "rows": 18})

rejected = {
  "schema_version": "1.1",
  "run_id": "run_" + hashlib.sha256((sha_b + "2026-08-28T17:20:11Z").encode()).hexdigest()[:32],
  "created_at": "2026-08-28T17:20:11Z",
  "as_of_date": "2026-08-01",
  "as_of_source": "server_default",
  "source": {"filename": "02_date_disorder.csv", "bytes": len(src_b), "sha256": sha_b, "rows_raw": 18,
             "encoding_detected": "utf-8", "delimiter_detected": ",", "received_at": "2026-08-28T17:20:10Z"},
  "stages": [
    {
      "stage": "validation", "story": "1.1", "engine_version": "1.0.0",
      "started_at": "2026-08-28T17:20:10Z", "completed_at": "2026-08-28T17:20:11Z", "duration_ms": 210,
      "input_ref": {"type": "source_file", "sha256": sha_b, "rows": 18},
      "output_ref": {"type": "normalised_dataset", "sha256": rejected_out, "rows": 0, "series": 0},
      "options": {"as_of_date": "2026-08-01", "as_of_source": "server_default", "encoding": "utf-8",
                  "encoding_source": "detected", "delimiter": ",", "delimiter_source": "detected",
                  "header_row": 1, "column_map": {"sku": "sku", "date": "date", "demand": "demand"},
                  "column_map_source": "canonical"},
      "passes": [{"pass": 1, "verdict": "reject", "options_supplied": {},
                  "finding_codes": ["DATE_FORMAT_MIXED", "DATE_FORMAT_AMBIGUOUS", "DATE_INVALID",
                                    "DATE_MISSING", "EXCEL_SERIAL_DATE", "DATE_FUTURE",
                                    "DUPLICATE_ROW_EXACT"]}],
      "transformations": [{"code": "DUPLICATE_ROW_EXACT", "count": 1, "reversible": True}],
      "outcome": {"verdict": "reject", "findings": 7, "blocking": 4, "rows_in": 18, "rows_out": 0}
    }
  ],
  "environment": ENVIRONMENT,
  "reproducibility": {
    "deterministic_stages": ["validation"],
    "non_deterministic_stages": [],
    "statement": "Validation is bitwise reproducible. No quality or forecast stage ran, because the file was rejected."
  },
  "integrity": {"manifest_sha256": "", "content_fingerprint_sha256": "", "chain_verified": True}
}

rejected["integrity"]["chain_verified"] = verify_graph(rejected)
m_sha_b, fp_sha_b = integrity_hashes(rejected)
rejected["integrity"]["manifest_sha256"] = m_sha_b
rejected["integrity"]["content_fingerprint_sha256"] = fp_sha_b

with open(os.path.join(OUT, "run_manifest.golden.rejected.json"), "w") as f:
    json.dump(rejected, f, indent=2); f.write("\n")

# ------------------------------------------------------------------ checks
print("golden A run_id      :", golden["run_id"])
print("golden A manifest    :", m_sha)
print("golden A fingerprint :", fp_sha)
print("golden A graph ok    :", golden["integrity"]["chain_verified"])
print("golden B manifest    :", m_sha_b)
print("golden B fingerprint :", fp_sha_b)

# fingerprint stability: move every timestamp, fingerprint must hold, manifest hash must move
shifted = copy.deepcopy(golden)
shifted["run_id"] = "run_" + "f" * 32
shifted["created_at"] = "2027-01-01T00:00:00Z"
shifted["source"]["received_at"] = "2027-01-01T00:00:00Z"
for st in shifted["stages"]:
    st["started_at"] = "2027-01-01T00:00:00Z"
    st["completed_at"] = "2027-01-01T00:00:01Z"
    st["duration_ms"] = 1
m2, f2 = integrity_hashes(shifted)
print("timestamps shifted -> fingerprint stable:", f2 == fp_sha, "| manifest hash moved:", m2 != m_sha)

# a corrupted reference must fail the graph
broken = copy.deepcopy(golden)
broken["stages"][1]["input_ref"]["sha256"] = "0" * 64
print("corrupted input_ref  -> graph verified:", verify_graph(broken))
