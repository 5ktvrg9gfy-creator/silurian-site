"""Band 2.7. The mechanism worked and the words did not.

One test per defect in `docs/planner-test-findings.md`, so a regression names
the planner finding it undoes rather than a line number.

The two rules governing the band are asserted here too: plain rather than
friendly, and explanation on demand rather than in the reading path.
"""

import re
import unittest
from pathlib import Path

from glossary import ENTRIES, by_slug
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
        self.assertEqual(HTML.count("<th>Demand history</th>"), 5)
        self.assertEqual(HTML.count("${sparkline(item.sku)}"), 5)
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
        for grid, columns in (("qualityRows", 10), ("classificationRows", 9), ("routingRows", 9), ("openItemRows", 8), ("commercialRows", 6)):
            with self.subTest(grid=grid):
                self.assertIn(f"${{detailRow(item.sku,{columns},'{grid}')}}", HTML)

    def test_every_grid_that_lists_a_line_opens_it_the_same_way(self):
        for grid in ("qualityRows", "classificationRows", "routingRows", "openItemRows", "commercialRows"):
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
        """2.7.4 stated the rule by saying what was absent. 2.10.4 put the
        absent lines on the same screen, so the rule is now stated by the two
        headings and by what each section says an answer can and cannot do."""
        renderer = HTML[HTML.index("function renderOpenItems(){"):HTML.index("function renderForecastEmpty(){")]
        self.assertIn("Waiting on an answer from you", renderer)
        self.assertIn("Need a commercial decision rather than a forecast", renderer)
        self.assertIn("An answer from you can move one of these to forecastable.", renderer)
        self.assertIn("No answer moves one of these to forecastable.", renderer)
        self.assertNotIn("are not listed here", renderer)

    def test_a_policy_only_line_is_ineligible_and_carries_no_refusal(self):
        """Which is why it is absent from the list, and why the sentence is needed."""
        self.assertFalse(DECISIONS["policy_only"])
        self.assertIn('"policy_only": False', ROUTING)


class TermsExplainThemselvesTests(unittest.TestCase):
    """2.10.2. Seven terms were still unread after the glossary shipped.

    The 2.7.5 test proved coverage, not comprehension. A reference a planner
    does not open is not an explanation, so each of the seven now says what it
    means where it appears, drawn from the one file that already holds the
    words. Nothing here is a link and nothing sends the reader to another page.
    """

    def test_the_gloss_is_a_placeholder_and_never_a_second_copy(self):
        """One source. The interface carries slugs, the glossary carries words."""
        renderer = HTML[HTML.index("function gloss(lookup){"):HTML.index("function glossaryMarkup()")]
        self.assertIn('<span class="gloss" data-gloss="${esc(termSlug(lookup))}"></span>', renderer)
        self.assertIn("glossary.bySlug[node.dataset.gloss]", renderer)
        self.assertIn("node.textContent=entry?entry.plain:''", renderer)
        for entry in ENTRIES:
            with self.subTest(term=entry["term"]):
                self.assertNotIn(entry["plain"], HTML)

    def test_the_gloss_is_read_in_place_and_is_not_a_link(self):
        style = HTML[HTML.index(".gloss{"):HTML.index("}", HTML.index(".gloss{"))]
        self.assertIn("display:block", style)
        self.assertIn("text-transform:none", style)
        renderer = HTML[HTML.index("function gloss(lookup){"):HTML.index("function glossaryMarkup()")]
        self.assertNotIn("<a ", renderer)
        self.assertNotIn("showWorkspacePanel", renderer)
        self.assertNotIn("href", renderer)

    def test_accept_explains_itself_beside_the_band_it_sits_next_to(self):
        """Term one. The planner read ACCEPT beside NOT USABLE DATA."""
        self.assertIn('<span id="verdictGloss" class="gloss" data-gloss=""></span>', HTML)
        self.assertIn("document.getElementById('verdictGloss').dataset.gloss=verdict?termSlug(verdict):''", HTML)
        defined = by_slug()
        for verdict in ("accept", "accept_with_warnings", "reject"):
            with self.subTest(verdict=verdict):
                self.assertIn(verdict, defined)
        # A file verdict is defined as one, so it cannot be read as a line verdict.
        self.assertIn("file could be read", defined["accept"]["plain"])

    def test_the_band_pill_never_carries_the_line_definition(self):
        """2.10.2 deferred this pill to 2.10.3 rather than say something false.

        2.10.3 gave it a definition of its own. What must never come back is the
        line definition on the portfolio label.
        """
        self.assertIn("This line's history", by_slug()["not_usable"]["plain"])
        self.assertIn("document.getElementById('bandGloss').dataset.gloss=band?portfolioBandSlug(band):''", HTML)
        self.assertNotIn("dataset.gloss=band?termSlug(band)", HTML)

    def test_the_two_decisions_that_failed_explain_themselves_where_they_are(self):
        """Terms two and six, the two the product sells."""
        split = HTML[HTML.index("const split=decisions.filter("):HTML.index("const chips=[")]
        self.assertIn("${gloss(name)}", split)
        detail = HTML[HTML.index("function lineDetailMarkup(sku){"):HTML.index("function detailRow(")]
        self.assertIn("${gloss(routing.decision)}", detail)
        defined = by_slug()
        self.assertIn("range rather than the single number", defined["model_eligible_wide_interval"]["plain"])
        self.assertIn("commercial arrangement rather than a number", defined["policy_only"]["plain"])

    def test_adi_and_cv_squared_explain_themselves_beside_their_own_figures(self):
        """Terms three and four, read next to the number rather than in a list."""
        detail = HTML[HTML.index("function lineDetailMarkup(sku){"):HTML.index("function detailRow(")]
        self.assertIn("${gloss('ADI')}", detail)
        self.assertIn("${gloss('CV squared')}", detail)

    def test_croston_family_is_explained_under_the_reason_that_names_it(self):
        """Term five. The reason is engine copy pinned by expected_routing.json."""
        renderer = HTML[HTML.index("function methodGloss(reason){"):HTML.index("function gloss(lookup){")]
        self.assertIn("/Croston family/.test", renderer)
        self.assertIn("gloss('Croston family')", renderer)
        detail = HTML[HTML.index("function lineDetailMarkup(sku){"):HTML.index("function detailRow(")]
        self.assertIn("${methodGloss(routing.reason)}", detail)
        self.assertIn("croston_family", by_slug())
        self.assertIn("Croston family", ROUTING)

    def test_volume_share_explains_itself_on_every_grid_that_ranks_by_it(self):
        """Term seven, under the column heading that carries the figure."""
        self.assertEqual(HTML.count('<span class="gloss" data-gloss="volume_share"></span>'), 1)
        self.assertEqual(HTML.count("${gloss('volume share')}"), 4)

    def test_every_gloss_is_filled_after_every_render(self):
        """An empty placeholder is worse than none, so nothing renders without it."""
        for site in ("function renderGlossary(){", "function wireLineRows(id){"):
            with self.subTest(site=site):
                block = HTML[HTML.index(site):HTML.index("\n}", HTML.index(site))]
                self.assertIn("renderGlosses()", block)
        self.assertIn("renderForecastEmpty();updateRunReadiness();renderGlosses();", HTML)
        self.assertIn(".gloss:empty{display:none}", HTML)


class BandScopeTests(unittest.TestCase):
    """2.10.3. The planner could not tell whether not usable was about the file.

    Story 2.7.1 was accepted on the count and failed on scope. The readiness
    sentence answers how much is ready. It does not say what the band label is
    about, and the same three words band one line and the whole portfolio.

    Two things are required and both are tested here: the label says what it
    applies to, and the label explains itself.
    """

    def test_a_portfolio_band_says_so_in_the_label(self):
        renderer = HTML[HTML.index("function portfolioBandLabel(band){"):HTML.index("function updateRunReadiness(){")]
        self.assertIn("`Portfolio: ${String(band).replaceAll('_',' ')}`", renderer)
        # The bare label the planner read is gone from every render path.
        self.assertNotIn("`${band.replaceAll('_',' ')} data`", HTML)
        self.assertNotIn("${portfolio.band.replace('_',' ')} data quality", HTML)

    def test_one_function_labels_every_portfolio_band_on_every_screen(self):
        """The pill, the printed report and a reopened bundle cannot disagree."""
        for site in (
            "document.getElementById('contextBand').textContent=band?portfolioBandLabel(band):'Not assessed'",
            "document.getElementById('qualityBand').textContent=portfolioBandLabel(portfolio.band)",
            "${esc(portfolioBandLabel(quality.portfolio_band))}",
        ):
            with self.subTest(site=site):
                self.assertIn(site, HTML)

    def test_the_pill_explains_itself_and_not_only_its_scope(self):
        """Both halves. A scoped label a reader still cannot read is half a fix."""
        self.assertIn('<span id="bandGloss" class="gloss" data-gloss=""></span>', HTML)
        self.assertIn("document.getElementById('bandGloss').dataset.gloss=band?portfolioBandSlug(band):''", HTML)
        defined = by_slug()
        for band in ("portfolio_clean", "portfolio_caveated", "portfolio_not_usable"):
            with self.subTest(band=band):
                self.assertIn(band, defined)

    def test_every_portfolio_definition_names_its_scope_before_anything_else(self):
        """The scope is the sentence the reader needs before the rest means anything."""
        defined = by_slug()
        for band in ("portfolio_clean", "portfolio_caveated", "portfolio_not_usable"):
            with self.subTest(band=band):
                plain = defined[band]["plain"]
                self.assertTrue(
                    plain.startswith("A verdict on the lines taken together, not on the file."),
                    f"{band} does not open by saying what it applies to",
                )

    def test_the_printed_report_carries_the_scope_because_paper_cannot_hover(self):
        self.assertIn('<p id="qualityBandScope" class="gloss" data-gloss=""></p>', HTML)
        self.assertIn("document.getElementById('qualityBandScope').dataset.gloss=portfolioBandSlug(portfolio.band)", HTML)
        self.assertLess(HTML.index('id="qualityBandScope"'), HTML.index('id="qualityScope"'))

    def test_a_line_band_says_it_is_about_that_line(self):
        """The contrast is what makes either label readable, so both are marked."""
        self.assertIn('data-quality-sort="band">Band, this line</button>', HTML)
        self.assertEqual(HTML.count("Quality band, this line</button>"), 2)
        detail = HTML[HTML.index("function lineDetailMarkup(sku){"):HTML.index("function detailRow(")]
        self.assertIn("""<p class="detail-sub">This line: ${term(item.band.replaceAll('_',' '))}""", detail)

    def test_no_band_label_anywhere_is_left_without_a_scope(self):
        """A bare band word on a label is the defect. Neither scope may reappear."""
        for bare in (
            ">Band</button>",
            ">Quality band</button>",
            "data quality`;",
        ):
            with self.subTest(label=bare):
                self.assertNotIn(bare, HTML)


class OneListTwoSectionsTests(unittest.TestCase):
    """2.10.4. A product owner decision, not a defect. Two planners reached it.

    All seven lines that are not forecast eligible appear on one screen under
    two headings. The distinction stays because it is real: an answer from you
    can move a refused line to forecastable, and nothing moves a policy only
    line, because no method will predict it.
    """

    def setUp(self):
        self.renderer = HTML[HTML.index("function renderOpenItems(){"):HTML.index("function renderForecastEmpty(){")]

    def test_the_panel_itself_stops_describing_only_half_of_what_it_holds(self):
        """A panel headed "what is waiting on you" would be wrong about the
        second section, whose lines are waiting on nothing."""
        heading = panel_heading("openitems")
        self.assertIn("What needs a decision from you?", heading)
        self.assertNotIn("What is waiting on you?", HTML)
        self.assertNotIn("cannot move until you answer something", HTML)

    def test_both_headings_are_present_and_in_the_brief_s_words(self):
        self.assertIn(">Waiting on an answer from you</h3>", self.renderer)
        self.assertIn(">Need a commercial decision rather than a forecast</h3>", self.renderer)

    def test_the_second_section_holds_the_lines_that_used_to_be_absent(self):
        """Policy only lines were ineligible, carried no refusal and were listed nowhere."""
        selector = HTML[HTML.index("function commercialItems(){"):HTML.index("function commercialVolumeShareFigure(")]
        self.assertIn("line.decision==='policy_only'", selector)
        self.assertFalse(DECISIONS["policy_only"])
        self.assertIn('<tbody id="commercialRows">', self.renderer)

    def test_neither_section_invents_an_order(self):
        """The routing stage ranked these lines. The panel places them, it does
        not rank them, which is why there is no comparator anywhere here."""
        selector = HTML[HTML.index("function commercialItems(){"):HTML.index("function commercialVolumeShareFigure(")]
        self.assertIn("ranked[line.rank_by_volume]", selector)
        self.assertNotIn("sort(", selector)
        self.assertNotIn("volume_share_pct", selector)
        self.assertIn("portfolio.open_items", self.renderer)

    def test_every_total_belongs_to_a_heading_and_none_is_combined(self):
        self.assertEqual(self.renderer.count('<td class="open-items-total">'), 2)
        self.assertIn("${openVolumeShareFigure(portfolio)} percent", self.renderer)
        self.assertIn("${commercialVolumeShareFigure(portfolio)} percent", self.renderer)
        self.assertIn("There is no combined figure", self.renderer)

    def test_each_total_is_the_engine_s_own_figure_for_that_section(self):
        """Neither is re-derived by summing line figures already rounded, which
        is story 2.7.9 and still holds for both sections."""
        formatter = HTML[HTML.index("function commercialVolumeShareFigure(portfolio){"):]
        formatter = formatter[:formatter.index("\n")]
        self.assertIn("portfolio.volume_share_by_decision_pct.policy_only.toFixed(2)", formatter)
        self.assertNotIn("reduce(", formatter)
        self.assertNotIn("open_items", formatter)

    def test_the_distinction_says_what_an_answer_can_and_cannot_do(self):
        """The reason the two sections are not merged, stated where they are."""
        self.assertIn("An answer from you can move one of these to forecastable.", self.renderer)
        self.assertIn("No answer moves one of these to forecastable.", self.renderer)
        self.assertIn("No method will predict them", self.renderer)

    def test_absence_is_a_result_in_both_sections(self):
        """CLAUDE.md section 8. An empty section names what was eligible and why."""
        self.assertIn("Nothing is waiting on you.", self.renderer)
        self.assertIn("No line here needs a commercial decision.", self.renderer)
        self.assertIn("No line in this run was refused.", self.renderer)

    def test_a_term_inside_a_row_opens_the_line_rather_than_the_glossary(self):
        """Found by browser testing on this section, and true of every grid.

        A term inside a line row sent the reader to the glossary panel instead
        of opening the line, which undoes story 2.10.1 on any cell carrying
        one. Since 2.10.2 that term already explains itself in place, so the
        jump costs the reader their place and buys nothing. Outside a row a
        term still opens the glossary.
        """
        self.assertIn("if(!button||button.closest('tr[data-sku]'))return;showWorkspacePanel('glossary')", HTML)
        wiring = HTML[HTML.index("function wireLineRows(id){"):HTML.index("function wireLineDetail(id){")]
        self.assertIn("if(event.target!==row)return;", wiring)

    def test_a_term_on_an_orange_field_never_turns_orange(self):
        """Found by browser testing on this panel.

        A term paints itself accent on hover and focus, and the two labels that
        use accent as a field then printed accent on accent, so the decision
        disappeared exactly when the reader pointed at it. Section 9: orange is
        a mark or a field, never both at once.
        """
        self.assertIn(
            ".decision-label.ineligible .term:hover,.decision-label.ineligible .term:focus,"
            ".band-label.not_usable .term:hover,.band-label.not_usable .term:focus"
            "{color:var(--ink-deep);border-bottom-color:var(--ink-deep)}",
            HTML,
        )

    def test_a_commercial_line_opens_its_detail_like_any_other(self):
        """Story 2.10.1 holds on the new section rather than stopping at it."""
        self.assertIn("${sparkline(item.sku)}", self.renderer)
        self.assertIn("${detailRow(item.sku,6,'commercialRows')}", self.renderer)
        self.assertIn("wireLineRows('commercialRows')", self.renderer)


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
