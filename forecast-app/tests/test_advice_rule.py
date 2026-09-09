"""Story 2.10.5. Advice Assay can stand behind.

The product owner's rule, set on 9 September 2026 reviewing the 2.10.2
preview:

    Assay reports what the data shows. Where it tells a planner to act, it may
    only tell them to look at something or ask someone. It may never tell them
    to change a number, because it does not know their lead time, service
    target or costs.

The rule is structural rather than a matter of four bad sentences, so it gets a
control rather than a proofread. Two things are refused here.

**A sizing or setting imperative**, which is Assay telling a planner what to do
to one of their own figures. Sizing a buffer needs a lead time and a service
target, and Assay holds neither.

**A claim about forecast accuracy**, which Assay cannot support because at the
point these strings are written no forecast has been run.

This is deliberately narrow. CLAUDE.md section 8 warns that a banned phrase
list which fires on legitimate copy gets ignored, which is worse than none, so
this scans the imperative forms only. "Check the six flagged months with the
account owner before changing the forecast" is the product owner's own
replacement text and must keep passing: it defers the change to the reader
rather than making it.

The strings are read from real engine output rather than from source, so a
string assembled at runtime cannot slip past.
"""

import json
import sys
import unittest
from copy import deepcopy
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from classification_engine import classify_quality
from quality_engine import QualityOptions, assess_quality
from routing_engine import route_portfolio
from validator import ValidationOptions, validate_csv


FIXTURES = Path(__file__).parent / "fixtures"
QUALITY_FIXTURES = Path(__file__).parent / "quality_fixtures"
EXPECTED_ROUTING = json.loads((FIXTURES / "expected_routing.json").read_text(encoding="utf-8"))

# Telling a planner what to do to one of their own numbers.
SETS_A_NUMBER = (
    r"(?i)(?:^|(?<=[.:;] )|(?<=, )|(?<=and )|(?<=then )|(?<=so ))"
    r"(?:size|set|adjust|increase|reduce|raise|lower|inflate|uplift|scale|trim)\s+(?:the|your|it)\b"
)
# A claim about the accuracy of a forecast that has not been run.
CLAIMS_ACCURACY = r"(?i)\b(?:no accuracy|more accurate|less accurate|improves? (?:the )?accuracy|will be accurate|accuracy work)\b"

# Named in the brief as withdrawn. None of them may come back anywhere.
WITHDRAWN = (
    "robust outlier candidate",
    "forecast the range rather than the number",
    "Size the buffer from the spread",
    "Chasing the average here adds work and no accuracy",
    "range rather than the single number",
)


def engine_output():
    raw = (FIXTURES / EXPECTED_ROUTING["fixture"]).read_bytes()
    as_of = date.fromisoformat(EXPECTED_ROUTING["as_of_date"])
    validation = validate_csv(raw, ValidationOptions(as_of_date=as_of))
    quality = assess_quality(
        validation,
        QualityOptions(as_of_date=as_of, as_of_date_source="fixture", grain=EXPECTED_ROUTING["grain"]),
    ).to_dict()
    classification = classify_quality(quality)
    routing = route_portfolio(deepcopy(quality), deepcopy(classification))
    return validation, quality, routing


def advice_strings():
    """Every string that tells a planner to do something, from real output."""
    validation, quality, routing = engine_output()
    strings: list[tuple[str, str]] = []
    for finding in validation.findings:
        strings.append((f"validation {finding.code}", finding.action))
    for finding in quality["portfolio"]["findings"]:
        strings.append((f"quality portfolio {finding['code']}", finding["action"]))
    for row in quality["skus"]:
        for finding in row["findings"]:
            strings.append((f"quality {row['sku']} {finding['code']}", finding["action"]))
    for sku, line in routing["per_sku"].items():
        strings.append((f"routing {sku} {line['decision']}", line["action"]))
    return strings


class AdviceRuleTests(unittest.TestCase):
    def setUp(self):
        self.strings = advice_strings()

    def test_the_sweep_actually_reads_something(self):
        """A control that scans nothing passes on nothing."""
        self.assertGreater(len(self.strings), 15)
        self.assertTrue(all(text.strip() for _, text in self.strings))

    def test_no_advice_tells_a_planner_to_change_one_of_their_own_numbers(self):
        for label, text in self.strings:
            with self.subTest(source=label):
                self.assertNotRegex(text, SETS_A_NUMBER, f"{label} sets a number Assay cannot size")

    def test_no_advice_claims_the_accuracy_of_a_forecast_that_has_not_run(self):
        for label, text in self.strings:
            with self.subTest(source=label):
                self.assertNotRegex(text, CLAIMS_ACCURACY, f"{label} claims an accuracy Assay has not measured")

    def test_the_withdrawn_phrases_never_come_back(self):
        sources = [
            (path.name, path.read_text(encoding="utf-8"))
            for path in (
                Path(__file__).parents[1] / "routing_engine.py",
                Path(__file__).parents[1] / "quality_engine.py",
                Path(__file__).parents[1] / "glossary.py",
                Path(__file__).parents[1] / "validator.py",
                Path(__file__).parents[1] / "static" / "index.html",
            )
        ]
        for name, text in sources:
            for phrase in WITHDRAWN:
                with self.subTest(file=name, phrase=phrase):
                    self.assertNotIn(phrase, text)

    def test_the_product_owners_own_replacement_text_passes_the_rule(self):
        """It defers the change to the reader rather than making it, so a
        control that refused it would be refusing the thing it exists to keep."""
        replacement = (
            "Check the six flagged months with the account owner before changing the forecast. "
            "Use the forecast range to review whether your stock buffer is adequate for your "
            "lead time and service target."
        )
        self.assertNotRegex(replacement, SETS_A_NUMBER)
        self.assertNotRegex(replacement, CLAIMS_ACCURACY)

    def test_the_outlier_finding_speaks_to_a_planner(self):
        _, quality, _ = engine_output()
        outliers = [
            finding
            for row in quality["skus"]
            for finding in row["findings"]
            if finding["code"] == "OUTLIER_CANDIDATE"
        ]
        self.assertTrue(outliers, "fixture 31 must still provoke an outlier finding")
        for finding in outliers:
            with self.subTest(detail=finding["detail"]):
                self.assertIn("unusual demand", finding["detail"])
                self.assertNotIn("candidate", finding["detail"])
                self.assertIn("No values have been removed or corrected.", finding["detail"])
                self.assertIn("with the account owner", finding["action"])
                # The word a planner uses, taken from the grain already inferred.
                self.assertRegex(finding["detail"], r"\b(month|months|week|weeks|day|days)\b")

    def test_the_praised_sentences_are_untouched(self):
        """Named in the brief as working. A sweep that loses them has overshot."""
        _, quality, _ = engine_output()
        classification = classify_quality(quality)
        implications = {line["implication"] for line in classification["per_sku"].values()}
        self.assertTrue(any("Demand is frequent but order size varies materially." in text for text in implications))
        outlier_implications = {
            finding["implication"]
            for row in quality["skus"]
            for finding in row["findings"]
            if finding["code"] == "OUTLIER_CANDIDATE"
        }
        self.assertEqual(
            outlier_implications,
            {"A promotion, tender, stock build or data error may have changed the observed demand."},
        )


if __name__ == "__main__":
    unittest.main()
