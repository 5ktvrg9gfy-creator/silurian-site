"""Story 2.7.9. The open items total agrees with the readiness sentence.

The defect: the five open items line figures sum to 25.38 while the headline
says 25.39. Both are correct. Line figures are each rounded to two decimal
places for display; the portfolio share is computed from units and rounded once.
A planner who adds the column gets a different number from the banner, which is
defect 1 in its purest form, two correct numbers side by side with nothing
relating them.

The fix is display only. No judgement, threshold or decision moved, and the
computation rule is untouched: the share is still computed from units and is
never re-derived by summing figures already rounded. That wrong fix would make
the total stop matching the share the routing stage owns, and two stages would
begin disagreeing on one screen.

What this module proves, and what it does not. There is no JavaScript runtime in
this suite, so the identity of the two rendered strings is proved by
construction rather than by comparing two strings once: one function produces
the figure, every site that shows it calls that function, and no site formats
the field itself. That is the stronger claim. Two strings being equal on one
fixture would still permit the two call sites to diverge on other data, whereas
a single source cannot. The rendered strings themselves were then read out of
Chromium at rest and after a resolution, and that evidence is in the pull
request rather than here.
"""

import json
import re
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


APP = Path(__file__).parents[1]
FIXTURES = Path(__file__).parent / "fixtures"
EXPECTED = json.loads((FIXTURES / "expected_routing.json").read_text(encoding="utf-8"))
HTML = (APP / "static" / "index.html").read_text(encoding="utf-8")

# The field the story is about. Anywhere this is turned into text outside the
# one formatter is a second source that can drift.
SHARE_FIELD = "open_volume_share_pct"
FORMATTER = "openVolumeShareFigure"


def routed(resolutions=None):
    raw = (FIXTURES / EXPECTED["fixture"]).read_bytes()
    as_of = date.fromisoformat(EXPECTED["as_of_date"])
    validation = validate_csv(raw, ValidationOptions(as_of_date=as_of))
    quality = assess_quality(
        validation, QualityOptions(as_of_date=as_of, as_of_date_source="fixture", grain=EXPECTED["grain"])
    ).to_dict()
    classification = classify_quality(quality)
    if resolutions is None:
        return route_portfolio(deepcopy(quality), deepcopy(classification))
    return route_portfolio(deepcopy(quality), deepcopy(classification), resolutions)


def rendered(portfolio):
    """The figure the interface shows, from the value the routing stage owns."""
    return f"{portfolio[SHARE_FIELD]:.2f}"


def summed_lines(portfolio):
    """What a planner gets by adding the column, which is the whole problem."""
    return f"{sum(round(item['volume_share_pct'], 2) for item in portfolio['open_items']):.2f}"


class OneFigureOneSourceTests(unittest.TestCase):
    """The foot total and the readiness sentence figure cannot differ, because
    there is one function and every site calls it."""

    def test_exactly_one_place_turns_the_share_into_a_figure(self):
        sites = re.findall(rf"{SHARE_FIELD}\.toFixed\(", HTML)
        self.assertEqual(len(sites), 1, "the share is formatted in more than one place")
        definition = re.search(rf"function {FORMATTER}\(portfolio\)\{{return ([^}}]+)\}}", HTML)
        self.assertIsNotNone(definition, "the formatter is missing or was renamed")
        self.assertEqual(definition.group(1).strip(), f"portfolio.{SHARE_FIELD}.toFixed(2)")

    def test_the_readiness_sentence_and_the_foot_total_both_call_it(self):
        start = HTML.index("function updateRunReadiness(){")
        sentence = HTML[start:HTML.index(f"function {FORMATTER}(", start)]
        self.assertIn(f"{FORMATTER}(portfolio)", sentence)
        foot = re.search(r'<td class="open-items-total">([^<]+)</td>', HTML)
        self.assertIsNotNone(foot, "the open items foot total is missing")
        self.assertIn(f"{FORMATTER}(portfolio)", foot.group(1))
        self.assertNotIn(".toFixed(", foot.group(1), "the foot total formats the share itself")

    def test_every_site_showing_the_share_calls_the_formatter(self):
        """The headline and the routing panel link show the same figure. If one
        of them ever formats it independently, this is where that is caught."""
        self.assertEqual(HTML.count(f"{FORMATTER}(portfolio)"), 5, "one definition and four call sites")

    def test_the_share_is_never_rebuilt_by_summing_rounded_line_figures(self):
        """The wrong fix, named in Q9 and refused here.

        Summing the displayed figures would make the total match the column and
        stop matching the share the routing stage owns.
        """
        start = HTML.index(f"function {FORMATTER}(")
        end = HTML.index("\n", start)
        self.assertNotIn("reduce(", HTML[start:end])
        self.assertNotIn("volume_share_pct", HTML[start:end].replace(SHARE_FIELD, ""))


class TheTotalAndTheSentenceAgreeTests(unittest.TestCase):
    """At rest and after a resolution, in one test, because the second state is
    the same defect at different numbers and deserves no second control."""

    def test_the_figure_is_one_string_in_both_states_and_the_column_does_not_match_it(self):
        states = (
            ("at rest", None, "25.39", "25.38", 5),
            (
                "after a resolution",
                {"RTG-60401": {"code": "EXCLUDE_FROM_SCOPE", "applied_at": "2026-09-03T12:00:00Z"}},
                "18.80",
                "18.79",
                4,
            ),
        )
        for label, resolutions, expected_total, expected_column, open_count in states:
            with self.subTest(state=label):
                portfolio = routed(resolutions)["portfolio"]
                self.assertEqual(portfolio["open_item_count"], open_count)
                # One value, so the sentence and the foot total render one string.
                self.assertEqual(rendered(portfolio), expected_total)
                # The column still does not add up to it, which is why the panel
                # now says so in words rather than being quietly corrected.
                self.assertEqual(summed_lines(portfolio), expected_column)
                self.assertNotEqual(rendered(portfolio), summed_lines(portfolio))

    def test_the_computation_rule_did_not_move(self):
        """The share is still the unrounded sum of the open lines, from units."""
        portfolio = routed()["portfolio"]
        exact = sum(item["volume_share_pct"] for item in portfolio["open_items"])
        self.assertAlmostEqual(portfolio[SHARE_FIELD], exact, places=6)
        self.assertNotEqual(round(portfolio[SHARE_FIELD], 2), float(summed_lines(portfolio)))


class TheRoundingSentenceTests(unittest.TestCase):
    def setUp(self):
        start = HTML.index("function renderOpenItems(){")
        self.renderer = HTML[start:HTML.index("function renderForecastEmpty()", start)]

    def test_the_panel_says_the_line_figures_may_not_sum_to_the_total(self):
        self.assertIn(
            "Line figures are rounded to two decimal places and may not sum exactly to the total.",
            self.renderer,
        )

    def test_it_is_one_sentence_and_not_an_apology(self):
        sentence = "Line figures are rounded to two decimal places and may not sum exactly to the total."
        self.assertEqual(sentence.count("."), 1)
        for word in ("sorry", "unfortunately", "please note", "apolog", "*", "†"):
            with self.subTest(word=word):
                self.assertNotIn(word, sentence.lower())

    def test_the_foot_total_is_a_table_foot_and_is_labelled(self):
        self.assertIn("<tfoot>", self.renderer)
        self.assertIn('scope="row">Total</th>', self.renderer)
        self.assertIn('scope="row"', self.renderer)
        self.assertLess(self.renderer.index("</tbody>"), self.renderer.index("<tfoot>"))

    def test_the_foot_row_carries_the_two_pixel_seam(self):
        self.assertIn(".open-items-grid tfoot th,.open-items-grid tfoot td{border-top:2px solid var(--text)", HTML)


if __name__ == "__main__":
    unittest.main()
