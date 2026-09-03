import ast
import hashlib
import json
import re
import unittest
from copy import deepcopy
from datetime import date
from pathlib import Path
from unittest.mock import patch

from classification_engine import classify_quality
from quality_engine import QualityOptions, assess_quality
from routing_engine import (
    CLASS_TABLE,
    DECISIONS,
    PRECEDENCE,
    REFUSAL_CODES,
    RESOLUTION_EFFECTS,
    RESOLUTION_VOCABULARY,
    RoutingError,
    route_portfolio,
    sentence_overlap,
    sku_reference,
)
from run_bundle import (
    BundleError,
    build_bundle,
    classification_bundle_result,
    quality_bundle_result,
    reopen_bundle,
    routing_bundle_result,
    validation_bundle_result,
)
from run_manifest import build_manifest, classification_stage, quality_stage, routing_stage, source_record, validation_stage
from validator import ValidationOptions, validate_csv


APP = Path(__file__).parents[1]
FIXTURES = Path(__file__).parent / "fixtures"
EXPECTED = json.loads((FIXTURES / "expected_routing.json").read_text(encoding="utf-8"))
ENVIRONMENT = {
    "app_version": "1.5.0",
    "git_commit": "abcdef1",
    "runtime": "python 3.12.4",
    "key_libraries": {"google-cloud-bigquery": "3.38.0"},
    "region": "europe-west2",
}
PRODUCTION_FILES = (
    APP / "app.py",
    APP / "routing_engine.py",
    APP / "classification_engine.py",
    APP / "quality_engine.py",
    APP / "run_manifest.py",
    APP / "run_bundle.py",
    APP / "run_manifest.schema.json",
    APP / "run_bundle.schema.json",
    APP / "static" / "index.html",
)


def run_fixture():
    raw = (FIXTURES / EXPECTED["fixture"]).read_bytes()
    as_of = date.fromisoformat(EXPECTED["as_of_date"])
    validation = validate_csv(raw, ValidationOptions(as_of_date=as_of))
    quality = assess_quality(
        validation, QualityOptions(as_of_date=as_of, as_of_date_source="fixture", grain=EXPECTED["grain"])
    ).to_dict()
    classification = classify_quality(quality)
    return raw, validation, quality, classification


def synthetic_inputs(band, codes, demand_class, resolvable=None):
    findings = [{"code": code, "scope": "sku", "detail": "", "implication": "", "action": "", "sku": "SKU-1", "periods": [], "metric": {"trailing_periods": 9, "span_periods": 5}} for code in codes]
    quality = {"skus": [{"sku": "SKU-1", "band": band, "resolvable": resolvable, "findings": findings, "volume_total": 10.0}]}
    classification = {"per_sku": {"SKU-1": {
        "demand_class": demand_class, "abc_volume_class": "A", "volume_share_pct": 100.0, "rank_by_volume": 1,
        "adi": 1.5, "cv_squared_nonzero": 0.1 if demand_class != "unclassifiable" else None, "non_zero_periods": 2, "periods_present": 3,
    }}}
    return quality, classification


class RoutingEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw, cls.validation, cls.quality, cls.classification = run_fixture()
        cls.quality_before = deepcopy(cls.quality)
        cls.classification_before = deepcopy(cls.classification)
        cls.result = route_portfolio(cls.quality, cls.classification)

    def test_authoritative_fixture_and_validation(self):
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(), EXPECTED["fixture_sha256"])
        self.assertEqual(EXPECTED["version"], "1.1")
        self.assertEqual(self.validation.verdict, EXPECTED["quality_inputs_observed"]["validation"]["verdict"])
        self.assertEqual(self.validation.findings, ())
        self.assertEqual(self.result["routing_table_version"], EXPECTED["routing_table_version"])

    def test_observed_quality_inputs_still_hold(self):
        observed = EXPECTED["quality_inputs_observed"]
        self.assertEqual(self.quality["portfolio"]["band"], observed["portfolio_band"])
        self.assertEqual([item["code"] for item in self.quality["portfolio"]["findings"]], observed["portfolio_findings"])
        self.assertAlmostEqual(self.quality["portfolio"]["flagged_volume_share_pct"], observed["portfolio_flagged_volume_share_pct"], places=4)
        actual = {row["sku"]: row for row in self.quality["skus"]}
        self.assertEqual(set(actual), set(observed["per_sku"]))
        for sku, expected in observed["per_sku"].items():
            self.assertEqual(actual[sku]["band"], expected["band"], sku)
            self.assertEqual([item["code"] for item in actual[sku]["findings"]], expected["finding_codes"], sku)
            self.assertEqual(actual[sku]["resolvable"], expected["engine_resolvable_flag"], sku)

    def test_every_sku_matches_expected_routing(self):
        self.assertEqual(set(self.result["per_sku"]), set(EXPECTED["per_sku"]))
        for sku, expected in EXPECTED["per_sku"].items():
            actual = self.result["per_sku"][sku]
            with self.subTest(sku=sku):
                self.assertEqual(actual["decision"], expected["decision"])
                self.assertEqual(actual["forecast_eligible"], expected["forecast_eligible"])
                self.assertEqual(actual["quality_band_at_decision"], expected["quality_band_at_decision"])
                self.assertEqual(actual["refusal"] is None, expected["refusal"] is None)
                self.assertEqual(actual["refusal"], expected["refusal"])
                self.assertEqual(actual["decided_by"], expected["decided_by"])
                self.assertEqual(actual["demand_class"], expected["demand_class"])
                self.assertEqual(actual["abc_volume_class"], expected["abc_volume_class"])
                self.assertEqual(actual["quality_finding_codes_referenced"], expected["quality_finding_codes_referenced"])
                self.assertEqual(actual["caveat_codes_shown"], expected.get("caveat_codes_shown", []))
                self.assertAlmostEqual(actual["volume_share_pct"], expected["volume_share_pct"], delta=0.05)
                self.assertTrue(actual["reason"].strip().endswith("."))
                self.assertLessEqual(actual["reason"].count(". "), 0, "The reason is one sentence")

    def test_boundary_cases(self):
        for case in EXPECTED["boundary_cases"]:
            with self.subTest(sku=case["sku"], tests=case["tests"]):
                self.assertEqual(self.result["per_sku"][case["sku"]]["decision"], case["expected_decision"], case["assertion"])

    def test_precedence_rule_one_beats_rule_two_and_rule_two_beats_rule_three(self):
        line = self.result["per_sku"]["RTG-60403"]
        self.assertEqual(line["quality_band_at_decision"], "not_usable")
        self.assertEqual(line["decision"], "discontinued_confirm_status")
        line = self.result["per_sku"]["RTG-60502"]
        self.assertEqual(line["demand_class"], "unclassifiable")
        self.assertEqual(line["decision"], "refused_data_quality")
        quality, classification = synthetic_inputs("not_usable", ["HISTORY_TOO_SHORT", "SERIES_DISCONTINUED"], "unclassifiable", False)
        self.assertEqual(route_portfolio(quality, classification)["per_sku"]["SKU-1"]["decision"], "discontinued_confirm_status")
        quality, classification = synthetic_inputs("not_usable", ["HISTORY_TOO_SHORT"], "smooth", False)
        self.assertEqual(route_portfolio(quality, classification)["per_sku"]["SKU-1"]["decision"], "refused_data_quality")
        quality, classification = synthetic_inputs("clean", ["SERIES_DISCONTINUED"], "smooth")
        self.assertEqual(route_portfolio(quality, classification)["per_sku"]["SKU-1"]["decision"], "discontinued_confirm_status")

    def test_clean_line_can_still_be_refused_and_caveat_never_reroutes(self):
        line = self.result["per_sku"]["RTG-60501"]
        self.assertEqual((line["quality_band_at_decision"], line["decision"]), ("clean", "insufficient_evidence"))
        self.assertEqual(line["refusal"]["code"], "INSUFFICIENT_EVIDENCE")
        self.assertEqual(line["refusal"]["driven_by_finding_codes"], [])
        line = self.result["per_sku"]["RTG-60601"]
        self.assertEqual((line["quality_band_at_decision"], line["decision"]), ("caveated", "model_eligible"))
        self.assertEqual(line["caveat_codes_shown"], ["OUTLIER_CANDIDATE"])
        for demand_class, decision in CLASS_TABLE.items():
            quality, classification = synthetic_inputs("caveated", ["OUTLIER_CANDIDATE"], demand_class)
            self.assertEqual(route_portfolio(quality, classification)["per_sku"]["SKU-1"]["decision"], decision)

    def test_policy_only_is_a_route_not_a_refusal(self):
        line = self.result["per_sku"]["RTG-60301"]
        self.assertEqual(line["decision"], "policy_only")
        self.assertFalse(line["forecast_eligible"])
        self.assertIsNone(line["refusal"])
        self.assertEqual(line["caveat_codes_shown"], ["OUTLIER_CANDIDATE"])

    def test_material_refusal_offers_treat_as_new_line(self):
        line = self.result["per_sku"]["RTG-60401"]
        self.assertEqual(line["decision"], "refused_data_quality")
        self.assertIn("TREAT_AS_NEW_LINE", line["refusal"]["resolution_options"])
        self.assertEqual(line["engine_resolvable_flag"], False)

    def test_portfolio_counts_and_shares(self):
        portfolio, expected = self.result["portfolio"], EXPECTED["portfolio"]
        self.assertEqual(portfolio["sku_count"], expected["sku_count"])
        self.assertEqual(portfolio["decision_counts"], expected["decision_counts"])
        for name, share in expected["volume_share_by_decision_pct"].items():
            self.assertAlmostEqual(portfolio["volume_share_by_decision_pct"][name], share, delta=0.05, msg=name)
        self.assertAlmostEqual(sum(portfolio["volume_share_by_decision_pct"].values()), 100, delta=0.05)
        self.assertEqual(round(portfolio["forecast_eligible_volume_share_pct"], 2), expected["forecast_eligible_volume_share_pct"])
        self.assertEqual(round(portfolio["not_eligible_volume_share_pct"], 2), expected["not_eligible_volume_share_pct"])
        exact = expected["exact_before_rounding"]
        self.assertAlmostEqual(portfolio["forecast_eligible_volume_share_pct"], exact["forecast_eligible_pct"], places=4)
        self.assertAlmostEqual(portfolio["not_eligible_volume_share_pct"], exact["not_eligible_pct"], places=4)
        for name, share in expected["volume_share_by_decision_pct"].items():
            self.assertEqual(round(portfolio["volume_share_by_decision_pct"][name], 2), share, name)
        self.assertAlmostEqual(portfolio["forecast_eligible_volume_share_pct"] + portfolio["not_eligible_volume_share_pct"], 100, delta=0.05)
        eligible_from_lines = sum(item["volume_share_pct"] for item in self.result["per_sku"].values() if item["forecast_eligible"])
        self.assertAlmostEqual(portfolio["forecast_eligible_volume_share_pct"], eligible_from_lines, places=5)
        self.assertEqual(portfolio["eligible_count"], sum(1 for item in self.result["per_sku"].values() if item["forecast_eligible"]))
        self.assertEqual(portfolio["refusal_code_counts"], {"DISCONTINUED": 1, "REFUSED_DATA_QUALITY": 3, "INSUFFICIENT_EVIDENCE": 1})
        self.assertEqual(portfolio["open_item_count"], 5)

    def test_closed_decision_set_and_eligibility(self):
        self.assertEqual(set(DECISIONS), {
            "model_eligible", "model_eligible_wide_interval", "intermittent_methods", "policy_only",
            "insufficient_evidence", "refused_data_quality", "discontinued_confirm_status",
        })
        self.assertEqual(list(self.result["precedence"]), list(PRECEDENCE))
        self.assertEqual(self.result["precedence"], EXPECTED["rules"]["precedence"])
        self.assertEqual(self.result["resolution_vocabulary"], EXPECTED["resolution_vocabulary"])
        for item in self.result["per_sku"].values():
            self.assertIn(item["decision"], DECISIONS)
            self.assertEqual(item["forecast_eligible"], item["decision"] in {"model_eligible", "model_eligible_wide_interval", "intermittent_methods"})
            self.assertEqual(item["refusal"] is not None, item["decision"] in REFUSAL_CODES)
            if item["refusal"]:
                options = item["refusal"]["resolution_options"]
                self.assertEqual(options, list(RESOLUTION_VOCABULARY[item["refusal"]["code"]]))
                self.assertEqual(options[-1], "DEFER")
                self.assertTrue(set(item["refusal"]["driven_by_finding_codes"]).issubset(item["quality_finding_codes_referenced"]))

    def test_routing_recomputes_no_metric(self):
        quality_by_sku = {row["sku"]: row for row in self.quality["skus"]}
        allowed_numeric = {"adi", "cv_squared_nonzero", "non_zero_periods", "periods_present", "trailing_periods", "span_periods", "coverage_pct"}
        for sku, item in self.result["per_sku"].items():
            source = self.classification["per_sku"][sku]
            self.assertEqual(item["volume_share_pct"], source["volume_share_pct"])
            self.assertEqual(item["rank_by_volume"], source["rank_by_volume"])
            self.assertEqual(item["quality_band_at_decision"], quality_by_sku[sku]["band"])
            self.assertEqual(set(item["evidence"]).issubset(allowed_numeric), True)
            for key in ("adi", "cv_squared_nonzero", "non_zero_periods", "periods_present"):
                self.assertEqual(item["evidence"][key], source[key])
            metrics = {finding["code"]: finding["metric"] for finding in quality_by_sku[sku]["findings"]}
            if "trailing_periods" in item["evidence"]:
                self.assertEqual(item["evidence"]["trailing_periods"], metrics["SERIES_DISCONTINUED"]["trailing_periods"])
            if "span_periods" in item["evidence"]:
                self.assertEqual(item["evidence"]["span_periods"], metrics["HISTORY_TOO_SHORT"]["span_periods"])
            if "coverage_pct" in item["evidence"]:
                self.assertEqual(item["evidence"]["coverage_pct"], metrics["ZERO_VS_MISSING_AMBIGUOUS"]["coverage_pct"])
            for number in re.findall(r"\d+(?:\.\d+)?", item["reason"]):
                value = float(number)
                traced = {float(value_) for value_ in item["evidence"].values() if isinstance(value_, (int, float))}
                traced |= {round(float(value_), 2) for value_ in traced} | {round(float(value_), 3) for value_ in traced} | {round(float(value_), 1) for value_ in traced}
                self.assertIn(value, traced, f"{sku} reason names {number}, which no owning stage supplied")
        with patch("quality_engine.assess_quality", side_effect=AssertionError("quality engine called")), patch(
            "classification_engine.classify_quality", side_effect=AssertionError("classification engine called")
        ):
            route_portfolio(self.quality, self.classification)
        source = (APP / "routing_engine.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        imports = {node.module for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)} | {alias.name for node in ast.walk(tree) if isinstance(node, ast.Import) for alias in node.names}
        self.assertFalse({"quality_engine", "classification_engine", "validator", "statistics", "math"} & imports)

    def test_inputs_are_read_only_and_no_resolution_changes_a_band(self):
        self.assertEqual(self.quality, self.quality_before)
        self.assertEqual(self.classification, self.classification_before)
        quality, classification = deepcopy(self.quality), deepcopy(self.classification)
        resolved = route_portfolio(quality, classification, {
            "RTG-60401": {"code": "TREAT_AS_NEW_LINE", "note": "Launch line, forecast by analogue.", "applied_at": "2026-09-02T12:00:00Z"},
            "RTG-60403": {"code": "SUPERSEDED_BY_SKU", "successor_sku": "RTG-60401", "applied_at": "2026-09-02T12:01:00Z"},
            "RTG-60501": {"code": "DEFER", "applied_at": "2026-09-02T12:02:00Z"},
        })
        self.assertEqual(quality, self.quality_before)
        for sku, line in resolved["per_sku"].items():
            self.assertEqual(line["decision"], self.result["per_sku"][sku]["decision"])
            self.assertEqual(line["quality_band_at_decision"], self.result["per_sku"][sku]["quality_band_at_decision"])
            self.assertEqual(line["refusal"], self.result["per_sku"][sku]["refusal"])
        recorded = resolved["per_sku"]["RTG-60401"]["resolution"]
        self.assertEqual((recorded["code"], recorded["successor_sku"], recorded["note"], recorded["applied_at"]), ("TREAT_AS_NEW_LINE", None, "Launch line, forecast by analogue.", "2026-09-02T12:00:00Z"))
        self.assertEqual(resolved["per_sku"]["RTG-60403"]["resolution"]["successor_sku"], "RTG-60401")
        self.assertEqual([item["sku"] for item in resolved["portfolio"]["open_items"]], ["RTG-60402", "RTG-60502", "RTG-60501"])
        self.assertEqual(resolved["portfolio"]["resolution_code_counts"], {"DEFER": 1, "SUPERSEDED_BY_SKU": 1, "TREAT_AS_NEW_LINE": 1})
        source = (APP / "routing_engine.py").read_text(encoding="utf-8")
        self.assertNotRegex(source, r'\["band"\]\s*=')
        self.assertNotRegex(source, r'\["resolvable"\]\s*=')

    def test_invalid_resolutions_are_refused(self):
        at = "2026-09-02T12:00:00Z"
        cases = [
            {"RTG-60001": {"code": "DEFER", "applied_at": at}},
            {"RTG-60401": {"code": "DISCONTINUED_CONFIRMED", "applied_at": at}},
            {"RTG-60401": {"code": "NOT_A_CODE", "applied_at": at}},
            {"RTG-60401": {}},
            {"RTG-60403": {"code": "SUPERSEDED_BY_SKU", "applied_at": at}},
            {"RTG-60403": {"code": "SUPERSEDED_BY_SKU", "successor_sku": "TYPED-IN", "applied_at": at}},
            {"RTG-60403": {"code": "SUPERSEDED_BY_SKU", "successor_sku": "RTG-60403", "applied_at": at}},
            {"RTG-60401": {"code": "DEFER", "successor_sku": "RTG-60001", "applied_at": at}},
            {"RTG-99999": {"code": "DEFER", "applied_at": at}},
            {"RTG-60401": {"code": "DEFER"}},
            {"RTG-60401": {"code": "DEFER", "applied_at": "yesterday"}},
            {"RTG-60401": {"code": "DEFER", "applied_at": "2026-09-02T12:00:00"}},
        ]
        for resolutions in cases:
            with self.subTest(resolutions=resolutions), self.assertRaises(RoutingError):
                route_portfolio(self.quality, self.classification, resolutions)

    def test_manifest_stage_uses_classification_reference_and_counts_only(self):
        input_ref = {"type": "classification_result", "sha256": "a" * 64, "series": 14}
        stage = routing_stage(self.result, input_ref, "2026-09-02T09:00:00Z", "2026-09-02T09:00:01Z")
        self.assertEqual(stage["stage"], "routing")
        self.assertEqual(stage["input_ref"], input_ref)
        self.assertEqual(stage["output_ref"]["type"], "routing_result")
        self.assertEqual(stage["outcome"], {
            "decision_counts": EXPECTED["portfolio"]["decision_counts"],
            "eligible_count": 7,
            "ineligible_count": 7,
            "refusal_code_counts": {"DISCONTINUED": 1, "REFUSED_DATA_QUALITY": 3, "INSUFFICIENT_EVIDENCE": 1},
            "open_item_count": 5,
            "resolved_count": 0,
            "data_requested_count": 0,
            "deferred_count": 0,
            "out_of_scope_count": 0,
        })
        self.assertEqual(stage["options"]["passes"], [{"pass": 1, "resolutions_applied": 0}])
        self.assertEqual(stage["options"]["routing_table_version"], EXPECTED["routing_table_version"])
        self.assertEqual(stage["options"]["precedence"], EXPECTED["rules"]["precedence"])
        self.assertEqual(stage["options"]["resolution_vocabulary"], EXPECTED["resolution_vocabulary"])
        serialised = json.dumps(stage)
        for sku in EXPECTED["per_sku"]:
            self.assertNotIn(sku, serialised)
        for banned in ("volume_share", "volume_total", "reason", "note", "open_items"):
            self.assertNotIn(banned, serialised)
        resolved = route_portfolio(self.quality, self.classification, {
            "RTG-60401": {"code": "TREAT_AS_NEW_LINE", "note": "Client note", "applied_at": "2026-09-02T12:00:00Z"},
            "RTG-60403": {"code": "SUPERSEDED_BY_SKU", "successor_sku": "RTG-60402", "applied_at": "2026-09-02T12:05:00Z"},
        })
        stage = routing_stage(resolved, input_ref, "2026-09-02T09:00:00Z", "2026-09-02T09:00:01Z")
        self.assertEqual(stage["options"]["resolutions_supplied"], {"count": 2, "by_code": {"SUPERSEDED_BY_SKU": 1, "TREAT_AS_NEW_LINE": 1}})
        self.assertEqual(stage["options"]["passes"], [
            {"pass": 1, "resolutions_applied": 0},
            {"pass": 2, "code": "TREAT_AS_NEW_LINE", "sku_sha256": sku_reference("RTG-60401"), "applied_at": "2026-09-02T12:00:00Z", "status": "resolved"},
            {"pass": 3, "code": "SUPERSEDED_BY_SKU", "sku_sha256": sku_reference("RTG-60403"), "applied_at": "2026-09-02T12:05:00Z", "status": "resolved", "successor_sku_sha256": sku_reference("RTG-60402")},
        ])
        self.assertEqual(stage["outcome"]["resolved_count"], 2)
        self.assertEqual(stage["outcome"]["out_of_scope_count"], 2)
        self.assertEqual(stage["outcome"]["open_item_count"], 3)
        serialised = json.dumps(stage)
        self.assertNotIn("Client note", serialised)
        for sku in EXPECTED["per_sku"]:
            self.assertNotIn(sku, serialised)

    def test_full_manifest_and_bundle_round_trip(self):
        source = source_record(self.raw, EXPECTED["fixture"], "2026-09-02T09:00:00Z", self.validation.metadata)
        validation_record = validation_stage(self.validation, source, "2026-09-02T09:00:00Z", "2026-09-02T09:00:01Z")
        quality_record = quality_stage(self.quality, validation_record["output_ref"], "2026-09-02T09:00:01Z", "2026-09-02T09:00:02Z")
        classification_record = classification_stage(self.classification, quality_record["output_ref"], "2026-09-02T09:00:02Z", "2026-09-02T09:00:03Z")
        routing_record = routing_stage(self.result, classification_record["output_ref"], "2026-09-02T09:00:03Z", "2026-09-02T09:00:04Z")
        manifest = build_manifest(
            source, [validation_record, quality_record, classification_record, routing_record], date(2026, 8, 1), "user",
            [row["sku"] for row in self.validation.normalised_rows], created_at="2026-09-02T09:00:04Z", environment=deepcopy(ENVIRONMENT),
        )
        self.assertEqual(manifest["schema_version"], "1.6")
        self.assertEqual(manifest["stages"][3]["input_ref"], manifest["stages"][2]["output_ref"])
        self.assertEqual(manifest["reproducibility"]["deterministic_stages"], ["validation", "quality", "classification", "routing"])
        serialised = json.dumps(manifest)
        for sku in EXPECTED["per_sku"]:
            self.assertNotIn(sku, serialised)
        results = {
            "validation": validation_bundle_result(self.validation, validation_record),
            "quality": quality_bundle_result(self.quality),
            "classification": classification_bundle_result(self.classification),
            "routing": routing_bundle_result(self.result),
        }
        bundle = build_bundle(manifest, results, EXPECTED["fixture"])
        self.assertEqual(bundle["bundle_schema_version"], "1.3")
        self.assertEqual(reopen_bundle(json.dumps(bundle).encode()), bundle)
        without_result = deepcopy(bundle)
        without_result["results"].pop("routing")
        with self.assertRaises(BundleError):
            reopen_bundle(json.dumps(without_result).encode())
        without_stage = build_manifest(
            source, [validation_record, quality_record, classification_record], date(2026, 8, 1), "user",
            [row["sku"] for row in self.validation.normalised_rows], created_at="2026-09-02T09:00:04Z", environment=deepcopy(ENVIRONMENT),
        )
        with self.assertRaises(BundleError):
            build_bundle(without_stage, results, EXPECTED["fixture"])
        with self.assertRaises(BundleError):
            routing_bundle_result({**self.result, "per_sku": {"X": {**next(iter(self.result["per_sku"].values())), "band": "clean"}}})

    def test_every_decision_carries_a_planner_action_in_the_house_register(self):
        substance = {
            "model_eligible": ("Nothing to decide", "forecast comparison", "sprint 3"),
            "model_eligible_wide_interval": ("forecast the range rather than the number", "size the buffer from the spread", "service level you have promised", "wrong in both directions", "chasing the average"),
            "intermittent_methods": ("order-cycle conversation", "how they actually order", "min-max", "call-off", "consignment"),
            "policy_only": ("no forecasting method will predict this line", "an arrangement rather than a number", "agree committed volumes", "make to order against an agreed lead time", "hold a buffer you have priced and accepted", "how they actually order"),
            "insufficient_evidence": ("scoping decision", "supply more history", "analogue", "out of scope"),
            "refused_data_quality": ("data request",),
            "discontinued_confirm_status": ("status question for the business", "master data", "stock holding", "where the money is"),
        }
        seen = set()
        for sku, line in self.result["per_sku"].items():
            action = line["action"]
            seen.add(line["decision"])
            with self.subTest(sku=sku, decision=line["decision"]):
                for phrase in substance[line["decision"]]:
                    self.assertIn(phrase.lower(), action.lower())
                self.assertNotRegex(action, r"(?i)croston|\bsba\b|arima|holt|winters|exponential smoothing|timesfm|prophet|theta|ets\b")
                self.assertNotRegex(action, r"(?i)\b(might|maybe|perhaps|possibly|could consider)\b")
                self.assertRegex(action, r"^\d|^Nothing to decide|^Make a data request")
                self.assertTrue(action.strip().endswith("."))
                self.assertEqual(sentence_overlap(action, line["reason"], self.classification["per_sku"][sku]["implication"]), set())
        self.assertEqual(seen, set(DECISIONS))
        refused = self.result["per_sku"]
        self.assertIn("genuinely new", refused["RTG-60401"]["action"])
        self.assertIn("5 periods of history", refused["RTG-60401"]["action"])
        self.assertIn("corrected extract", refused["RTG-60402"]["action"])
        self.assertIn("zero demand or missing rows", refused["RTG-60402"]["action"])
        self.assertIn("14 periods without demand", refused["RTG-60403"]["action"])
        self.assertEqual(self.result["statement_sources"]["action"], "routing")
        self.assertEqual(self.result["statement_sources"]["quality_band_at_decision"], "quality")
        self.assertEqual(self.result["statement_sources"]["demand_class"], "classification")

    def test_open_items_list_is_ranked_by_volume_and_names_its_total(self):
        portfolio = self.result["portfolio"]
        items = portfolio["open_items"]
        self.assertEqual([item["sku"] for item in items], ["RTG-60403", "RTG-60401", "RTG-60402", "RTG-60502", "RTG-60501"])
        shares = [item["volume_share_pct"] for item in items]
        self.assertEqual(shares, sorted(shares, reverse=True))
        self.assertEqual(portfolio["open_item_count"], 5)
        self.assertAlmostEqual(portfolio["open_volume_share_pct"], sum(shares), places=6)
        self.assertEqual(round(portfolio["open_volume_share_pct"], 2), 25.39)
        refused_share = sum(line["volume_share_pct"] for line in self.result["per_sku"].values() if line["refusal"])
        self.assertAlmostEqual(portfolio["open_volume_share_pct"], refused_share, places=6)
        self.assertLess(portfolio["open_volume_share_pct"], portfolio["not_eligible_volume_share_pct"])
        for item in items:
            self.assertEqual(item["status"], "unresolved")
            self.assertIn("reason", item)
            self.assertEqual(item["resolution_options"][-1], "DEFER")
            self.assertFalse(self.result["per_sku"][item["sku"]]["forecast_eligible"])
        self.assertIsNone(portfolio["last_resolved_at"])
        self.assertEqual(self.result["passes"], [{"pass": 1, "resolutions_applied": 0}])

    def test_resolution_effects_match_the_table_and_never_move_a_decision(self):
        expected_status = {
            "DISCONTINUED_CONFIRMED": ("resolved", False, ["obsolescence_review", "master_data_review"]),
            "SUPERSEDED_BY_SKU": ("resolved", False, ["successor_recorded"]),
            "STILL_ACTIVE_DEMAND_GAP": ("resolved", True, []),
            "STILL_ACTIVE_DATA_MISSING": ("resolved", True, ["new_extract_required"]),
            "SUPPLY_LONGER_HISTORY": ("data_requested", True, ["data_request"]),
            "SUPPLY_CORRECTED_EXTRACT": ("data_requested", True, ["data_request"]),
            "TREAT_AS_NEW_LINE": ("resolved", False, ["launch_line"]),
            "EXCLUDE_FROM_SCOPE": ("resolved", False, []),
            "DEFER": ("deferred", True, []),
        }
        self.assertEqual(set(RESOLUTION_EFFECTS), set(expected_status))
        self.assertEqual(set(self.result["resolution_effects"]), set(expected_status))
        all_codes = {code for options in RESOLUTION_VOCABULARY.values() for code in options}
        self.assertEqual(all_codes, set(expected_status))
        for code, (status, in_scope, flags) in expected_status.items():
            effect = self.result["resolution_effects"][code]
            self.assertEqual((effect["status"], effect["in_forecast_scope"], effect["flags"]), (status, in_scope, flags), code)
            self.assertTrue(effect["consequence"].endswith("."))
        line_for_code = {"DISCONTINUED": "RTG-60403", "REFUSED_DATA_QUALITY": "RTG-60401", "INSUFFICIENT_EVIDENCE": "RTG-60501"}
        for refusal_code, options in RESOLUTION_VOCABULARY.items():
            sku = line_for_code[refusal_code]
            for code in options:
                supplied = {"code": code, "applied_at": "2026-09-02T12:00:00Z"}
                if code == "SUPERSEDED_BY_SKU":
                    supplied["successor_sku"] = "RTG-60001"
                with self.subTest(sku=sku, code=code):
                    resolved = route_portfolio(self.quality, self.classification, {sku: supplied})
                    line, before = resolved["per_sku"][sku], self.result["per_sku"][sku]
                    self.assertEqual(line["decision"], before["decision"])
                    self.assertEqual(line["forecast_eligible"], before["forecast_eligible"])
                    self.assertEqual(line["quality_band_at_decision"], before["quality_band_at_decision"])
                    self.assertEqual(line["refusal"], before["refusal"])
                    self.assertEqual(line["reason"], before["reason"])
                    self.assertEqual(line["action"], before["action"])
                    status, in_scope, flags = expected_status[code]
                    self.assertEqual(line["resolution_status"], status)
                    self.assertEqual(line["in_forecast_scope"], in_scope)
                    self.assertEqual(line["resolution"]["flags"], flags)
                    self.assertTrue(line["resolution"]["decision_unchanged"])
                    on_list = sku in {item["sku"] for item in resolved["portfolio"]["open_items"]}
                    self.assertEqual(on_list, status != "resolved")
                    self.assertEqual(resolved["portfolio"]["open_item_count"], 5 if on_list else 4)
                    self.assertEqual(resolved["portfolio"]["last_resolved_at"], "2026-09-02T12:00:00Z" if status == "resolved" else None)
                    self.assertEqual(resolved["passes"][-1]["status"], status)
                    for other in self.result["per_sku"]:
                        if other != sku:
                            self.assertEqual(resolved["per_sku"][other], self.result["per_sku"][other])
        deferred = route_portfolio(self.quality, self.classification, {"RTG-60403": {"code": "DEFER", "applied_at": "2026-09-02T12:00:00Z"}})
        self.assertEqual([item["sku"] for item in deferred["portfolio"]["open_items"]], [item["sku"] for item in self.result["portfolio"]["open_items"]])
        self.assertEqual(deferred["portfolio"]["open_volume_share_pct"], self.result["portfolio"]["open_volume_share_pct"])
        self.assertEqual(deferred["portfolio"]["out_of_scope_count"], 0)

    def test_empty_open_items_names_the_last_resolution_time(self):
        resolutions = {
            "RTG-60403": {"code": "DISCONTINUED_CONFIRMED", "applied_at": "2026-09-02T12:00:00Z"},
            "RTG-60401": {"code": "TREAT_AS_NEW_LINE", "applied_at": "2026-09-02T12:04:00Z"},
            "RTG-60402": {"code": "EXCLUDE_FROM_SCOPE", "applied_at": "2026-09-02T12:02:00Z"},
            "RTG-60502": {"code": "TREAT_AS_NEW_LINE", "applied_at": "2026-09-02T12:03:00Z"},
            "RTG-60501": {"code": "STILL_ACTIVE_DEMAND_GAP", "applied_at": "2026-09-02T12:01:00Z"} if False else {"code": "EXCLUDE_FROM_SCOPE", "applied_at": "2026-09-02T12:01:00Z"},
        }
        resolved = route_portfolio(self.quality, self.classification, resolutions)
        self.assertEqual(resolved["portfolio"]["open_items"], [])
        self.assertEqual(resolved["portfolio"]["open_item_count"], 0)
        self.assertEqual(resolved["portfolio"]["open_volume_share_pct"], 0)
        self.assertEqual(resolved["portfolio"]["last_resolved_at"], "2026-09-02T12:04:00Z")
        self.assertEqual(resolved["portfolio"]["resolution_status_counts"]["resolved"], 5)
        self.assertEqual(len(resolved["passes"]), 6)
        self.assertEqual(resolved["portfolio"]["forecast_eligible_volume_share_pct"], self.result["portfolio"]["forecast_eligible_volume_share_pct"])

    def test_production_copy_scope_check(self):
        """Banned strings and banned dashes, production only.

        The dash rule is the owner's house rule and applies to the product,
        not only to documents, so it is scoped the same way the nine box and
        ABC value bans are: the shipped code, the schemas and the interface.
        Both the characters and their HTML and unicode escapes are refused,
        because an escape renders as the character the rule forbids.
        """
        for path in PRODUCTION_FILES:
            text = path.read_text(encoding="utf-8")
            with self.subTest(file=path.name):
                self.assertNotRegex(text, r"(?i)nine[ -]box")
                self.assertNotRegex(text, r"(?i)abc.{0,24}\bvalue\b|\bvalue\b.{0,24}abc")
                self.assertNotIn("\u2014", text, "em dash in production copy")
                self.assertNotIn("\u2013", text, "en dash in production copy")
                self.assertNotRegex(text, r"(?i)&(?:mdash|ndash|#8212|#8211|#x201[34]);")
                self.assertNotRegex(text, r"\\u201[34]")

    def test_interface_never_uses_resolve_for_the_engine_flag(self):
        html = (APP / "static" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("can be resolved", html)
        self.assertIn("can be lifted within this run", html)
        self.assertIn("it never changes the decision or the quality band", html)
        self.assertIn('aria-label="Resolution for ${esc(sku)}"', html)


if __name__ == "__main__":
    unittest.main()
