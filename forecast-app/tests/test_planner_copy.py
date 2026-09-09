"""Band 2.7. The mechanism worked and the words did not.

One test per defect in `docs/planner-test-findings.md`, so a regression names
the planner finding it undoes rather than a line number.

The two rules governing the band are asserted here too: plain rather than
friendly, and explanation on demand rather than in the reading path.
"""

import re
import unittest
from pathlib import Path

from routing_engine import DECISIONS


APP = Path(__file__).parents[1]
HTML = (APP / "static" / "index.html").read_text(encoding="utf-8")
ROUTING = (APP / "routing_engine.py").read_text(encoding="utf-8")
PANELS = ("validation", "quality", "classification", "routing", "openitems", "forecast", "provenance", "glossary")


def panel_heading(name: str) -> str:
    marker = f'data-workspace-panel="{name}"'
    start = HTML.index(marker)
    heading = HTML.index('<div class="panel-heading">', start)
    return HTML[heading:HTML.index("</div>", HTML.index("<h2", heading))]


class ReadinessStatementTests(unittest.TestCase):
    """2.7.1. Accept and not usable appeared together and nothing related them."""

    def test_one_sentence_reconciles_the_stage_verdicts(self):
        self.assertIn('id="runReadiness"', HTML)
        start = HTML.index("function updateRunReadiness(){")
        end = HTML.index("// Story 2.10.1.", start)
        renderer = HTML[start:end]
        self.assertIn("Your file was accepted and processed.", renderer)
        self.assertIn("accepted with warnings", renderer)
        self.assertIn("rejected and nothing was forecast", renderer)
        self.assertIn("can be forecast.", renderer)
        self.assertIn("an answer from you first, covering", renderer)
        self.assertIn("?'needs':'need'}", renderer)
        self.assertIn("percent of volume.", renderer)
        self.assertIn("a commercial decision rather than a forecast.", renderer)

    def test_the_sentence_accounts_for_every_line_in_the_portfolio(self):
        """Eligible plus waiting does not reach the portfolio while policy-only lines exist.

        Fixture 31 routes 7 eligible, 5 open and 2 policy only. A sentence that
        stopped after the first two figures would leave two lines unexplained,
        which is defect 1 in a new form rather than a fix for it.
        """
        start = HTML.index("function updateRunReadiness(){")
        renderer = HTML[start:HTML.index("// Story 2.10.1.", start)]
        self.assertIn("portfolio.ineligible_count-portfolio.open_item_count", renderer)
        self.assertIn("commercial>0?", renderer)

    def test_the_stage_verdicts_stay_available_underneath(self):
        """Nothing is deleted. The readable sentence comes first."""
        self.assertLess(HTML.index('id="runReadiness"'), HTML.index('id="contextVerdict"'))
        self.assertLess(HTML.index('id="runReadiness"'), HTML.index('id="contextBand"'))
        for element_id in ("contextVerdict", "contextBand"):
            self.assertIn(f'id="{element_id}"', HTML)

    def test_routing_refreshes_the_sentence_because_routing_owns_the_counts(self):
        """Quality renders before routing, so the counts are absent until routing lands."""
        renderer = HTML[HTML.index("function renderRouting(data){"):HTML.index("function renderOpenItems(){")]
        self.assertIn("updateRunReadiness();", renderer)

    def test_the_sentence_recomputes_nothing(self):
        """Every figure is read from a stage that owns it."""
        start = HTML.index("function updateRunReadiness(){")
        end = HTML.index("// Story 2.10.1.", start)
        renderer = HTML[start:end]
        for field in ("eligible_count", "sku_count", "open_item_count", "open_volume_share_pct"):
            self.assertIn(f"portfolio.{field}", renderer)
        self.assertNotIn("filter(", renderer)
        self.assertNotIn("reduce(", renderer)


class ActionTextTests(unittest.TestCase):
    """2.7.2. The two texts the product sells, and both failed on a planner."""

    def test_the_wide_interval_action_names_the_action(self):
        self.assertIn("forecast the range rather than the number", ROUTING)
        self.assertIn("Size the buffer from the spread and the service level you have promised", ROUTING)
        self.assertIn("wrong in both directions", ROUTING)
        self.assertIn("Chasing the average here adds work and no accuracy.", ROUTING)

    def test_the_policy_only_action_offers_choices_and_a_first_step(self):
        self.assertIn("no forecasting method will predict this line", ROUTING)
        self.assertIn("answer is an arrangement rather than a number", ROUTING)
        for option in ("agree committed volumes with the customer", "make to order against an agreed lead time", "hold a buffer you have priced and accepted"):
            self.assertIn(option, ROUTING)
        self.assertIn("Start by asking the customer how they actually order.", ROUTING)

    def test_the_register_is_plain_and_not_friendly(self):
        """Rule one of the band. The enemy is unexplained vocabulary, not directness."""
        start = ROUTING.index("def _action(")
        end = ROUTING.index("\ndef ", start + 10)
        actions = ROUTING[start:end]
        self.assertNotRegex(actions, r"(?i)\b(?:great news|don't worry|unfortunately|simply|just relax|good news)\b")
        self.assertNotRegex(actions, r"(?i)\b(?:might|maybe|perhaps|possibly|could consider)\b")
        self.assertNotIn("—", actions)
        self.assertNotIn("–", actions)


class LineDetailInPlaceTests(unittest.TestCase):
    """2.10.1. The drawer failed two planners, so there is no drawer to find.

    Band 2.10 rules out a third variation of the affordance on the row. The
    shape chosen is the other one it allows: the history comes to the row.
    Every grid that lists a line draws that line's demand history on it, and
    the rest of the detail opens in the table, under the row it describes.
    """

    def test_the_failed_affordance_is_gone_rather_than_varied(self):
        for artefact in (
            "drawer-scrim",
            "quality-drawer",
            "qualityDrawer",
            "openQualityDrawer",
            "drawerHintMarkup",
            "silurian.drawerHintSeen",
            "data-dismiss-hint",
            'class="row-open"',
            '<span class="sr-only">Detail</span>',
        ):
            with self.subTest(artefact=artefact):
                self.assertNotIn(artefact, HTML)

    def test_the_history_is_drawn_on_the_row_with_nothing_to_open(self):
        """What the second planner asked for, visible before any interaction."""
        self.assertEqual(HTML.count("<th>Demand history</th>"), 4)
        self.assertEqual(HTML.count("${sparkline(item.sku)}"), 4)
        renderer = HTML[HTML.index("function sparkline(sku){"):HTML.index("function historyReading(sku){")]
        self.assertIn("latestHistory?.[sku]", renderer)
        self.assertIn('class="spark"', renderer)
        # The picture is never the only reading of the history.
        self.assertIn('aria-label="${esc(historyReading(sku))}"', renderer)

    def test_the_history_reads_as_a_sentence_as_well_as_a_picture(self):
        renderer = HTML[HTML.index("function historyReading(sku){"):HTML.index("function historyBlock(sku){")]
        self.assertIn("periods from", renderer)
        self.assertIn("Highest", renderer)
        self.assertIn("lowest", renderer)

    def test_the_detail_opens_in_the_table_under_its_own_row(self):
        renderer = HTML[HTML.index("function detailRow(sku,columns,grid){"):HTML.index("function redrawLineGrids(){")]
        self.assertIn('<tr class="line-detail" data-detail-for="${esc(sku)}">', renderer)
        self.assertIn('<td colspan="${columns}">', renderer)
        self.assertIn("workspaceState.selectedGrid===grid", renderer)
        self.assertIn(".line-detail>td{", HTML)

    def test_the_detail_carries_the_history_it_was_opened_for(self):
        detail = HTML[HTML.index("function lineDetailMarkup(sku){"):HTML.index("function detailRow(sku,columns,grid){")]
        self.assertIn("${historyBlock(sku)}", detail)
        block = HTML[HTML.index("function historyBlock(sku){"):HTML.index("function initWorkspace(){")]
        self.assertIn("Demand history", block)
        # Never zero filled, and the rule is said where the picture is drawn.
        self.assertIn("Missing periods are not filled with zero.", block)

    def test_one_line_is_open_at_a_time_in_one_grid(self):
        """Four copies of the detail would be four copies of the resolution form."""
        renderer = HTML[HTML.index("function toggleLineDetail(sku,grid){"):HTML.index("function redrawLineGrids(){")]
        self.assertIn("workspaceState.selectedGrid=open?null:grid", renderer)
        for grid, columns in (("qualityRows", 10), ("classificationRows", 9), ("routingRows", 9), ("openItemRows", 8)):
            with self.subTest(grid=grid):
                self.assertIn(f"${{detailRow(item.sku,{columns},'{grid}')}}", HTML)

    def test_every_grid_that_lists_a_line_opens_it_the_same_way(self):
        for grid in ("qualityRows", "classificationRows", "routingRows", "openItemRows"):
            with self.subTest(grid=grid):
                self.assertIn(f"wireLineRows('{grid}')", HTML)
        self.assertIn("event.key==='Enter'||event.key===' '", HTML)
        self.assertIn("event.key==='Escape')closeLineDetail()", HTML)

    def test_the_history_never_reaches_the_manifest(self):
        """It is client data. The bundle holds client data and the manifest does not."""
        manifest = (APP / "run_manifest.py").read_text(encoding="utf-8")
        bundle = (APP / "run_bundle.py").read_text(encoding="utf-8")
        for source in (manifest, bundle):
            self.assertNotIn("_demand_history", source)
            self.assertNotIn('"history"', source)


class OpenItemsMembershipTests(unittest.TestCase):
    """2.7.4. Five lines were open and the reason those five was invisible."""

    def test_the_rule_is_stated_where_the_list_is(self):
        renderer = HTML[HTML.index("function renderOpenItems(){"):HTML.index("function renderForecastEmpty(){")]
        self.assertIn("These lines are waiting on an answer from you.", renderer)
        self.assertIn("Lines that need a commercial decision rather than a data answer are not listed here.", renderer)

    def test_a_policy_only_line_is_ineligible_and_carries_no_refusal(self):
        """Which is why it is absent from the list, and why the sentence is needed."""
        self.assertFalse(DECISIONS["policy_only"])
        self.assertIn('"policy_only": False', ROUTING)


class PanelPurposeTests(unittest.TestCase):
    """2.7.6. Every panel opens with one sentence saying what it is for."""

    def test_every_panel_opens_with_exactly_one_purpose_sentence(self):
        for name in PANELS:
            with self.subTest(panel=name):
                heading = panel_heading(name)
                match = re.search(r"<p>(.*?)</p>", heading, flags=re.S)
                self.assertIsNotNone(match, f"{name} has no purpose line")
                sentence = re.sub(r"<[^>]+>", "", match.group(1)).strip()
                self.assertTrue(sentence.endswith("."))
                self.assertEqual(sentence.count("."), 1, f"{name} says more than one sentence")
                self.assertLess(len(sentence), 120, f"{name} is a paragraph, not a sentence")

    def test_no_purpose_line_hedges_or_uses_a_banned_dash(self):
        for name in PANELS:
            with self.subTest(panel=name):
                heading = panel_heading(name)
                self.assertNotRegex(heading, r"(?i)\b(?:might|maybe|perhaps|possibly)\b")
                self.assertNotIn("—", heading)
                self.assertNotIn("–", heading)


class ExplanationOnDemandTests(unittest.TestCase):
    """Rule two of the band. Available when reached for, invisible when not."""

    def test_a_term_explains_itself_without_adding_height(self):
        """The definition rides on the title attribute, so the default view does not grow."""
        renderer = HTML[HTML.index("function term(text,lookup){"):HTML.index("function glossaryMarkup()")]
        self.assertIn('title="${esc(entry.plain)}"', renderer)
        self.assertIn('class="term"', renderer)
        # An undefined term degrades to plain text rather than an empty tooltip.
        self.assertIn("if(!entry)return esc(text);", renderer)

    def test_the_term_control_is_inline_and_carries_no_block_layout(self):
        style = HTML[HTML.index(".term{"):HTML.index("}", HTML.index(".term{"))]
        self.assertIn("padding:0", style)
        self.assertIn("border:0", style)
        self.assertIn("min-height:0", style)
        self.assertIn("font:inherit", style)

    def test_the_glossary_is_one_click_away_and_not_in_the_reading_path(self):
        self.assertIn('data-workspace-tab="glossary"', HTML)
        self.assertIn('data-workspace-panel="glossary"', HTML)
        # It sits after provenance, so no existing panel order moved.
        self.assertLess(HTML.index('data-workspace-tab="provenance"'), HTML.index('data-workspace-tab="glossary"'))

    def test_the_glossary_never_gates_a_run(self):
        loader = HTML[HTML.index("async function loadGlossary()"):HTML.index("document.addEventListener('click',event=>{const button=event.target.closest('.term')")]
        self.assertIn("if(!response.ok)return;", loader)
        self.assertIn("}catch{", loader)


class ProvenanceDemotionTests(unittest.TestCase):
    """2.7.8. Nothing is deleted, only relocated."""

    def test_the_identifiers_sit_behind_a_control(self):
        self.assertIn('<details class="run-identifiers">', HTML)
        details = HTML[HTML.index('<details class="run-identifiers">'):HTML.index("</details>")]
        self.assertIn('id="contextSource"', details)
        self.assertIn('id="contextRun"', details)
        self.assertIn("<summary>Run identifiers</summary>", details)

    def test_what_a_planner_needs_stays_in_the_open(self):
        context = HTML[HTML.index('<div class="run-context"'):HTML.index('<details class="run-identifiers">')]
        self.assertIn('id="contextDate"', context)
        self.assertIn('id="contextFrequency"', context)

    def test_the_run_is_still_fully_reproducible_from_what_remains_reachable(self):
        self.assertIn("Download run manifest", HTML)
        self.assertIn('id="downloadBundle"', HTML)
        self.assertIn('id="reproduceBundleForm"', HTML)
        self.assertIn("Kept so a run can be reproduced and defended.", HTML)

    def test_the_routing_summary_is_the_readiness_sentence_plus_the_split(self):
        renderer = HTML[HTML.index("function renderRouting(data){"):HTML.index("function renderOpenItems(){")]
        self.assertIn("Split by reason", renderer)
        headline = renderer[renderer.index('<p class="routing-headline">'):renderer.index("</p>")]
        self.assertEqual(headline.count("<strong>"), 2, "the headline is two figures, not a paragraph")


class LandingStateTests(unittest.TestCase):
    """2.7.7. A stranger should know what they are handing data to."""

    def test_the_landing_state_says_what_the_tool_does(self):
        block = HTML[HTML.index('<div class="what-it-does">'):HTML.index("</div>", HTML.index('<div class="what-it-does">'))]
        for promise in ("What it checks.", "What it tells you.", "What it refuses to do.", "What happens to your file."):
            with self.subTest(promise=promise):
                self.assertIn(promise, block)

    def test_it_answers_where_the_data_goes(self):
        block = HTML[HTML.index('<div class="what-it-does">'):HTML.index("</div>", HTML.index('<div class="what-it-does">'))]
        self.assertIn("Only forecasting is sent onward: dates and quantities, never SKU names, go to Google BigQuery in London.", block)
        self.assertIn("stays in your browser", block)

    def test_it_is_plain_and_carries_no_marketing(self):
        block = HTML[HTML.index('<div class="what-it-does">'):HTML.index("</div>", HTML.index('<div class="what-it-does">'))]
        self.assertNotRegex(block, r"(?i)\b(?:powerful|seamless|cutting.edge|revolutionary|world.class|best.in.class|effortless)\b")
        self.assertNotIn("—", block)
        self.assertNotIn("–", block)
        self.assertLessEqual(block.count("<li>"), 4, "three or four lines, not a brochure")


if __name__ == "__main__":
    unittest.main()
