import re
import unittest
from pathlib import Path


HTML = (Path(__file__).parents[1] / "static" / "index.html").read_text(encoding="utf-8")

# CLAUDE.md section 9a. Assay is a documented exception to the site's zero
# radius rule: 4px on cards, buttons and inputs, 3px on badges, and never
# higher than 4px. The bound is the load bearing half, because it is the half
# that stops the exception widening into a generic dashboard one screen at a
# time, so the bound is what this scan holds.
#
# Until 16 September 2026 the rule was zero radius everywhere and the page
# carried `*{border-radius:0!important}`, which this file asserted as a
# literal string. The product owner amended section 9 first; the assertion was
# replaced afterwards, and never the other way round.
RADIUS_BOUND_PX = 4.0
RADIUS_DECLARATION = re.compile(r"border-radius\s*:\s*([^;}\n]+)")


def radius_findings(text: str) -> list[str]:
    """Every border-radius declaration that breaks the 4px bound.

    A declaration can carry up to four lengths, so each is read separately.
    Anything that is not a plain px length under the bound is a finding,
    which catches a percentage, a rem, a calc() and a bare number alike:
    the rule is a px bound and a value the scan cannot measure is not
    evidence that the bound holds.
    """
    findings = []
    for match in RADIUS_DECLARATION.finditer(text):
        raw = match.group(1).replace("!important", "").strip()
        for length in raw.split():
            if length in ("0", "0px"):
                continue
            size = re.fullmatch(r"(\d+(?:\.\d+)?)px", length)
            if size is None or float(size.group(1)) > RADIUS_BOUND_PX:
                findings.append(raw)
                break
    return findings


# CLAUDE.md section 9a. One card elevation step, at the approved changeset's
# values, and no second step.
#
# The sticky run context bar is outside that rule and keeps its own shadow.
# Its job is to mark where a bar scrolling over content ends, which is not the
# job of lifting a card off the page, so it is not the second step. The
# product owner ruled on 16 September 2026, closing Q8, and the alternative
# was removing a shadow that does real work to satisfy a rule written about
# cards.
#
# Both values are permitted by name. That is the honest limit of this scan:
# it reads declarations, not what they are applied to, so it cannot catch the
# card elevation being spent on something that is not a card.
CARD_ELEVATION = "0 1px 2px rgba(26,33,41,0.06), 0 2px 8px rgba(26,33,41,0.04)"
STICKY_BAR = "0 4px 10px rgb(26 25 24 / 10%)"
SHADOW_DECLARATION = re.compile(r"box-shadow\s*:\s*([^;}\n]+)")


def normalise_shadow(value: str) -> str:
    """One spelling for one shadow, so spacing is not a way past the rule."""
    value = value.replace("!important", "")
    value = re.sub(r"\s+", " ", value).strip().lower()
    return re.sub(r",\s*", ",", value)


def shadow_findings(text: str) -> list[str]:
    """Every shadow that is neither of the two permitted values."""
    permitted = {normalise_shadow(CARD_ELEVATION), normalise_shadow(STICKY_BAR)}
    return sorted(
        {
            normalise_shadow(match)
            for match in SHADOW_DECLARATION.findall(text)
            if normalise_shadow(match) not in permitted
        }
    )


# CLAUDE.md section 9a, the third seam category. A border whose colour changes
# with state is a state marker, not a divider. It is outside the seam rule
# entirely, at whatever weight it already carries.
#
# This exists because the seam rule would have thinned all three to 1px, by
# correct application of a rule that had not thought about them. Section 9
# wants state encoded twice, colour and words. A state marker thinned to a
# hairline leaves the words carrying it alone, which is one and a half.
#
# Pinned on both halves the product owner named: the width, and the fact that
# the colour varies by state.
#
# `.bundle-warning` is the honest exception. It is held by name at 5px and its
# colour does not vary: it is always `--warn`, so it is a fixed status marker
# rather than a varying one. Pinning it to a status token rather than to a set
# of states is the difference, and it is stated rather than smoothed over.
STATE_MARKERS = {
    # At rest this one is ink, because before a verdict arrives there is no
    # verdict to paint. The status colour arrives with the verdict class. So a
    # state marker's colour is carried by its variants OR by its own rule, and
    # requiring both would be wrong: the first version of this test did, and
    # it failed on the real page, which is what a probe is for.
    ".validation-panel": {
        "edge": "border-top",
        "width": "5px",
        "rest": "--text",
        "states": {"reject": "--bad", "accept_with_warnings": "--warn", "accept": "--good"},
    },
    ".quality-exception": {
        "edge": "border-left",
        "width": "4px",
        "rest": "--warn",
        "states": {"not_usable": "--bad"},
    },
    ".bundle-warning": {
        "edge": "border-left",
        "width": "5px",
        "rest": "--warn",
        "states": {},
    },
}
STATUS_TOKENS = ("--good", "--warn", "--bad")


def marker_edge(text: str, selector: str) -> str | None:
    """The width and colour the marker declares on its own rule."""
    match = re.search(
        re.escape(selector) + r"\{([^{}]*)\}", text
    )
    if match is None:
        return None
    edge = re.search(
        r"border-(?:top|left)\s*:\s*(\d+px)\s+solid\s+var\((--[a-z-]+)\)",
        match.group(1),
    )
    return None if edge is None else f"{edge.group(1)}|{edge.group(2)}"


def marker_state_colours(text: str, selector: str) -> dict[str, str]:
    """Every state variant of a marker, and the token each one paints with."""
    found = {}
    for state, token in re.findall(
        re.escape(selector) + r"\.([a-z_]+)\{border-color\s*:\s*var\((--[a-z-]+)\)\}", text
    ):
        found[state] = token
    return found


def card_elevation_steps(text: str) -> list[str]:
    """Distinct shadows that are not the sticky bar's, which is the count the
    "no second step" half of the rule is about. Two selectors sharing one value
    are still one step; two different values are two steps, and the second is a
    new decision."""
    return sorted(
        {normalise_shadow(match) for match in SHADOW_DECLARATION.findall(text)}
        - {normalise_shadow(STICKY_BAR)}
    )


class WorkspaceUiTests(unittest.TestCase):
    def test_each_output_is_an_independent_panel(self):
        for name in ("validation", "quality", "classification", "routing", "openitems", "forecast", "provenance"):
            self.assertIn(f'data-workspace-panel="{name}"', HTML)
            self.assertIn(f'data-workspace-tab="{name}"', HTML)
        self.assertIn("renderPanel:name=>", HTML)

    def test_run_context_is_sticky_and_complete(self):
        self.assertIn(".workspace-sticky{position:sticky", HTML)
        for element_id in (
            "contextSource",
            "contextDate",
            "contextFrequency",
            "contextRun",
            "contextVerdict",
            "contextBand",
        ):
            self.assertIn(f'id="{element_id}"', HTML)

    def test_quality_grid_controls_and_keyboard_contract(self):
        for key in (
            "sku",
            "volume_share_pct",
            "coverage_pct",
            "periods_present",
            "zero_share_pct",
            "last_period",
            "band",
            "findings",
        ):
            self.assertIn(f'data-quality-sort="{key}"', HTML)
        self.assertIn('id="qualitySearch"', HTML)
        self.assertIn("event.key==='Enter'||event.key===' '", HTML)
        self.assertIn("event.key==='Escape'", HTML)
        self.assertIn("workspaceState.band", HTML)

    def test_workspace_uses_approved_visual_tokens(self):
        self.assertIn("--surface:#eae9e9", HTML)
        self.assertIn("--ink-deep:#1a1918", HTML)
        self.assertIn("--accent:#ec6917", HTML)
        self.assertIn("font-family:Archivo", HTML)
        self.assertNotIn("Arial", HTML)
        self.assertNotIn("Consolas,monospace", HTML)

    def test_no_radius_exceeds_the_assay_bound(self):
        """Section 9a. 4px is the ceiling, not a suggestion."""
        self.assertEqual(
            radius_findings(HTML),
            [],
            "A border-radius above the 4px bound is in the Assay page. "
            "Section 9a of CLAUDE.md allows 4px on cards, buttons and inputs "
            "and 3px on badges, and nothing higher. A larger radius is a new "
            "decision and belongs in a new changeset, not in this diff.",
        )

    def test_the_radius_scan_reads_the_page_and_not_nothing(self):
        """A scan that finds nothing because it read nothing is not a pass."""
        self.assertGreater(
            len(RADIUS_DECLARATION.findall(HTML)),
            0,
            "The radius scan found no declaration at all to read. Every "
            "control declares its own radius, so zero declarations means the "
            "scan is looking at the wrong thing.",
        )

    def test_a_radius_above_the_bound_is_caught(self):
        """Probe it in every form a radius can take. A control that cannot
        fail is decoration, and the forms below are the ones a restyle
        actually reaches for."""
        for planted in ("8px", "50%", "0.5rem", "6px 6px 0 0", "4.5px"):
            with self.subTest(radius=planted):
                self.assertNotEqual(
                    radius_findings(f"button{{border-radius:{planted}}}"),
                    [],
                    f"{planted} broke the bound and the scan did not say so.",
                )

    def test_the_permitted_radii_are_not_findings(self):
        """The bound must not fire on what section 9a actually allows."""
        for allowed in ("0", "0px", "3px", "4px", "4px 4px 0 0", "0!important"):
            with self.subTest(radius=allowed):
                self.assertEqual(
                    radius_findings(f".card{{border-radius:{allowed}}}"),
                    [],
                    f"{allowed} is permitted by section 9a and was reported.",
                )

    def test_no_shadow_beyond_one_card_step_and_the_sticky_bar(self):
        """Section 9a. Two values are permitted and nothing else is."""
        self.assertEqual(
            shadow_findings(HTML),
            [],
            "A box-shadow that is neither the approved card elevation nor the "
            "sticky run context bar's is in the Assay page. Section 9a allows "
            "one card elevation step at the changeset's values, plus the "
            "sticky bar's own shadow. A different shadow is a new decision "
            "and belongs in a new changeset.",
        )

    def test_there_is_no_second_card_elevation_step(self):
        """Section 9a. One step, and the second is a new decision."""
        steps = card_elevation_steps(HTML)
        self.assertLessEqual(
            len(steps),
            1,
            f"Assay declares {len(steps)} card elevations and section 9a "
            f"allows one: {steps}. Two selectors sharing one value are one "
            "step. Two different values are two, and the second one needs "
            "approving before it ships.",
        )

    def test_the_shadow_scan_reads_the_page_and_not_nothing(self):
        """A scan that finds nothing because it read nothing is not a pass."""
        self.assertGreater(
            len(SHADOW_DECLARATION.findall(HTML)),
            0,
            "The shadow scan found no declaration at all. The sticky run "
            "context bar carries one, so zero means the scan is looking at "
            "the wrong thing.",
        )

    def test_a_second_or_wrong_shadow_is_caught(self):
        """Probe it. A control that cannot fail is decoration."""
        planted = {
            "a second elevation": "0 8px 24px rgba(0,0,0,.2)",
            "a near miss on the approved value": "0 1px 2px rgba(26,33,41,0.08)",
            "an inset": "inset 0 1px 2px rgba(26,33,41,0.06)",
            "a bare drop shadow": "0 2px 4px #000",
        }
        for name, value in planted.items():
            with self.subTest(shadow=name):
                self.assertNotEqual(
                    shadow_findings(f".card{{box-shadow:{value}}}"),
                    [],
                    f"{name} broke the rule and the scan did not say so.",
                )
        self.assertEqual(
            len(card_elevation_steps(
                f".a{{box-shadow:{CARD_ELEVATION}}}"
                f".b{{box-shadow:0 8px 24px rgba(0,0,0,.2)}}"
            )),
            2,
            "Two different elevations must count as two steps.",
        )

    def test_the_permitted_shadows_are_not_findings(self):
        """The rule must not fire on what section 9a actually allows, and
        spacing must not be a way past it."""
        for allowed in (
            CARD_ELEVATION,
            STICKY_BAR,
            "0 1px 2px rgba(26, 33, 41, 0.06), 0 2px 8px rgba(26, 33, 41, 0.04)",
            f"{STICKY_BAR}!important",
        ):
            with self.subTest(shadow=allowed):
                self.assertEqual(
                    shadow_findings(f".card{{box-shadow:{allowed}}}"),
                    [],
                    f"{allowed} is permitted by section 9a and was reported.",
                )
        self.assertEqual(
            len(card_elevation_steps(
                f".a{{box-shadow:{CARD_ELEVATION}}}.b{{box-shadow:{CARD_ELEVATION}}}"
            )),
            1,
            "Two selectors sharing one elevation are one step, not two.",
        )

    def test_state_markers_keep_their_width(self):
        """Section 9a. The seam rule does not reach a state marker."""
        for selector, spec in STATE_MARKERS.items():
            with self.subTest(marker=selector):
                edge = marker_edge(HTML, selector)
                self.assertIsNotNone(
                    edge, f"{selector} declares no marker edge at all."
                )
                width, token = edge.split("|")
                self.assertEqual(
                    width,
                    spec["width"],
                    f"{selector} is a state marker and its border is now "
                    f"{width}, not {spec['width']}. Section 9a puts it outside "
                    "the seam rule at whatever weight it already carries. A "
                    "hairline that changes colour is a rule with a tint, not a "
                    "verdict. If the weight should change, change section 9a "
                    "first.",
                )
                self.assertEqual(
                    token,
                    spec["rest"],
                    f"{selector}'s resting colour moved from {spec['rest']} to "
                    f"{token}.",
                )
                carries_status = token in STATUS_TOKENS or any(
                    value in STATUS_TOKENS
                    for value in marker_state_colours(HTML, selector).values()
                )
                self.assertTrue(
                    carries_status,
                    f"{selector} paints no status colour, at rest or in any "
                    "state variant. A marker that never carries a status "
                    "colour is a divider, and the seam rule reaches a divider.",
                )

    def test_the_varying_state_markers_still_vary(self):
        """The other half of the rule: the colour changes with the state."""
        for selector, spec in STATE_MARKERS.items():
            if not spec["states"]:
                continue
            with self.subTest(marker=selector):
                self.assertEqual(
                    marker_state_colours(HTML, selector),
                    spec["states"],
                    f"{selector}'s state colours have moved. The border is "
                    "what says which verdict this is, so losing a variant "
                    "leaves the words carrying the state alone.",
                )

    def test_the_fixed_status_marker_is_recorded_as_fixed(self):
        """`.bundle-warning` is held by name and does not vary. Recorded so
        nobody 'fixes' it by adding variants nobody asked for, and so the
        difference between the three is not smoothed over."""
        self.assertEqual(marker_state_colours(HTML, ".bundle-warning"), {})
        self.assertEqual(marker_edge(HTML, ".bundle-warning"), "5px|--warn")

    def test_a_thinned_state_marker_is_caught(self):
        """Probe it as the next theme band would break it: by applying the
        seam rule correctly to something the seam rule does not cover."""
        for selector, spec in STATE_MARKERS.items():
            with self.subTest(marker=selector):
                thinned = HTML.replace(
                    f"{spec['edge']}:{spec['width']} solid var(",
                    f"{spec['edge']}:1px solid var(",
                )
                self.assertNotEqual(thinned, HTML, "probe planted nothing")
                self.assertNotEqual(
                    marker_edge(thinned, selector),
                    marker_edge(HTML, selector),
                    f"{selector} was thinned to 1px and the scan did not see it.",
                )

    def test_a_dropped_state_variant_is_caught(self):
        """Losing a verdict colour must fail, not pass quietly."""
        dropped = HTML.replace(".validation-panel.reject{border-color:var(--bad)}", "")
        self.assertNotEqual(dropped, HTML, "probe planted nothing")
        self.assertNotEqual(
            marker_state_colours(dropped, ".validation-panel"),
            STATE_MARKERS[".validation-panel"]["states"],
        )

    def test_forecast_empty_state_is_derived_from_routing_then_quality_result(self):
        self.assertIn("routed?routed.filter(item=>!item.forecast_eligible):all.filter(item=>item.band==='not_usable')", HTML)
        self.assertIn("reasons.join", HTML)
        self.assertNotIn("Nine of twelve lines are eligible", HTML)
        self.assertNotIn("65.58", HTML)
        self.assertNotIn("34.42", HTML)

    def test_routing_panel_sits_between_classification_and_forecast_and_renders_alone(self):
        self.assertLess(HTML.index('data-workspace-tab="classification"'), HTML.index('data-workspace-tab="routing"'))
        self.assertLess(HTML.index('data-workspace-tab="routing"'), HTML.index('data-workspace-tab="forecast"'))
        self.assertIn('id="routingContent"', HTML)
        start = HTML.index("function renderRouting(data){")
        end = HTML.index("function renderForecastEmpty(){", start)
        renderer = HTML[start:end]
        self.assertIn("eligibleShare.toFixed(2)", renderer)
        self.assertIn("ineligibleShare.toFixed(2)", renderer)
        self.assertIn("percent</strong> of volume is ${term('forecast eligible')}", renderer)
        self.assertIn("Split by reason", renderer)
        self.assertIn("data-routing-decision=", renderer)
        self.assertIn('id="routingSearch"', renderer)
        for key in ("sku", "decision", "forecast_eligible", "volume_share_pct", "demand_class", "band", "refusal_code", "reason"):
            self.assertIn(f'data-routing-sort="{key}"', renderer)
        self.assertNotIn("qualityRows", renderer)
        self.assertNotIn("classificationRows", renderer)
        self.assertNotIn("forecastEmpty", renderer)

    def test_decision_is_written_on_every_row_and_joined_into_other_grids(self):
        self.assertIn('data-quality-sort="decision"', HTML)
        self.assertIn('data-classification-sort="decision"', HTML)
        self.assertIn("decision:routingFor(item.sku)?.decision||''", HTML)
        self.assertIn("decision:routingFor(sku)?.decision||''", HTML)
        self.assertIn("workspaceState.routeDecision", HTML)
        self.assertIn("workspaceState.routeSearch", HTML)
        self.assertIn("esc(decisionCopy(item.decision))", HTML)
        self.assertIn('data-eligible="${item.forecast_eligible}"', HTML)

    def test_line_detail_carries_decision_reason_and_refusal_but_no_action(self):
        start = HTML.index("function lineDetailMarkup(sku){")
        end = HTML.index("function classificationRows(){", start)
        drawer = HTML[start:end]
        self.assertIn("Routing decision", drawer)
        self.assertIn("esc(routing.reason)", drawer)
        self.assertIn("Quality band at decision", drawer)
        self.assertIn("routing.refusal.resolution_options.map", drawer)
        self.assertIn("never changes the decision or the quality band", drawer)
        self.assertEqual(drawer.count('class="action-slot"'), 1)
        self.assertIn('<strong>Do this</strong><span class="reason">${esc(routing.action)}</span>', drawer)
        self.assertNotIn('aria-hidden="true"></div>', drawer)

    def test_recorded_bundle_view_and_version_gates_accept_routing(self):
        self.assertIn("['1.0','1.1','1.2','1.3'].includes(bundle.bundle_schema_version)", HTML)
        self.assertIn("['1.2','1.3','1.4','1.5','1.6'].includes(bundle.manifest.schema_version)", HTML)
        self.assertIn("routing:'1.1.0'", HTML)
        self.assertIn("Recorded routing result", HTML)
        self.assertIn("<th>Resolution</th>", HTML)
        self.assertIn("<th>Do this</th>", HTML)

    def test_resolution_picker_is_a_closed_list_that_shows_its_consequence_first(self):
        start = HTML.index("function lineDetailMarkup(sku){")
        end = HTML.index("function classificationRows(){", start)
        drawer = HTML[start:end]
        self.assertIn('<select id="resolutionCode" name="code" required>', drawer)
        self.assertIn("routing.refusal.resolution_options.map(option=>`<option value=", drawer)
        self.assertIn('<select id="successorSku" name="successor_sku">', drawer)
        self.assertIn("others.map(name=>`<option value=", drawer)
        self.assertNotIn('type="text"', drawer)
        self.assertNotIn("<input", drawer)
        self.assertIn("latestRouting.resolution_effects[code.value]", drawer)
        self.assertIn("consequence.textContent=effect?effect.consequence:''", drawer)
        self.assertIn("workspaceState.resolutions[sku]=record", drawer)
        self.assertIn("runQualityAssessment({reopen:sku})", drawer)
        self.assertIn('<label for="resolutionNote">Note, optional</label>', drawer)
        self.assertIn('<p class="resolution-help">Stored with your data in the run bundle. It is never written to the run manifest.</p>', drawer)
        self.assertNotIn("It stays in the confidential bundle and never reaches the manifest", drawer)
        self.assertIn(".resolution-form .resolution-help{", HTML)
        self.assertIn("text-transform:none", HTML)
        self.assertIn("data-clear-resolution", drawer)

    def test_an_unanswered_line_is_never_pre_answered(self):
        start = HTML.index("function lineDetailMarkup(sku){")
        end = HTML.index("function classificationRows(){", start)
        drawer = HTML[start:end]
        picker = drawer[drawer.index('<select id="resolutionCode"'):]
        self.assertTrue(picker.startswith('<select id="resolutionCode" name="code" required><option value="">Choose from the list</option>'))
        self.assertLess(picker.index('<option value="">Choose from the list</option>'), picker.index("resolution_options.map"))
        self.assertNotIn("selected", picker[:picker.index("</select>")])

    def test_open_items_panel_renders_alone_and_is_reachable_twice(self):
        self.assertLess(HTML.index('data-workspace-tab="routing"'), HTML.index('data-workspace-tab="openitems"'))
        self.assertLess(HTML.index('data-workspace-tab="openitems"'), HTML.index('data-workspace-tab="forecast"'))
        self.assertIn('id="openItemsContent"', HTML)
        self.assertIn('id="contextOpenItems"', HTML)
        self.assertIn("document.getElementById('contextOpenItems').addEventListener('click',()=>showWorkspacePanel('openitems'))", HTML)
        self.assertIn("openButton.addEventListener('click',()=>showWorkspacePanel('openitems'))", HTML)
        start = HTML.index("function renderOpenItems(){")
        end = HTML.index("function renderForecastEmpty(){", start)
        renderer = HTML[start:end]
        self.assertIn("portfolio.open_items", renderer)
        self.assertIn("of your volume", renderer)
        self.assertIn("Nothing is waiting on you.", renderer)
        self.assertIn("The last refusal was resolved at ${esc(timeCopy(portfolio.last_resolved_at))}", renderer)
        self.assertEqual(renderer.count("<th>Rank</th>"), 2)
        self.assertIn("<th>Resolution options</th>", renderer)
        # Neither section orders or totals anything the routing stage owns.
        self.assertNotIn("sort(", renderer)
        self.assertNotIn("qualityRows", renderer)
        self.assertNotIn("routingRows", renderer)

    def test_every_line_detail_statement_names_its_stage(self):
        start = HTML.index("function lineDetailMarkup(sku){")
        end = HTML.index("function classificationRows(){", start)
        drawer = HTML[start:end]
        self.assertIn("stageTag('quality')", drawer)
        self.assertIn("stageTag('classification')", drawer)
        self.assertIn("stageTag('routing')", drawer)
        self.assertIn('title="Computed by the quality stage, reused unchanged"', drawer)
        self.assertIn('title="Produced by the ${esc(stage)} stage"', HTML)

    def test_resolutions_travel_with_the_quality_request_and_reset_on_a_new_run(self):
        self.assertIn("payload.append('routing_resolutions',JSON.stringify(workspaceState.resolutions))", HTML)
        self.assertIn("document.getElementById('runQuality').addEventListener('click',()=>{workspaceState.resolutions={};runQualityAssessment()})", HTML)

    def test_classification_panel_owns_matrix_grid_and_drawer_block(self):
        self.assertLess(HTML.index('data-workspace-tab="quality"'), HTML.index('data-workspace-tab="classification"'))
        self.assertLess(HTML.index('data-workspace-tab="classification"'), HTML.index('data-workspace-tab="forecast"'))
        self.assertIn("Portfolio classification matrix", HTML)
        self.assertIn("data-classification-cell", HTML)
        self.assertIn("ABC volume class", HTML)
        self.assertIn("Not meaningful for this demand class", HTML)
        self.assertIn("classification-block", HTML)
        self.assertIn('class="action-slot"', HTML)

    def test_classification_grid_keeps_state_and_joins_quality_for_display(self):
        self.assertIn("workspaceState.classCell", HTML)
        self.assertIn("workspaceState.classSearch", HTML)
        self.assertIn("qualityBySku", HTML)
        self.assertIn("item.band", HTML)
        self.assertIn("item.findings", HTML)

    def test_quality_non_json_response_has_a_controlled_error(self):
        start = HTML.index("document.getElementById('runQuality')")
        end = HTML.index("document.getElementById('portfolioForm')", start)
        handler = HTML[start:end]
        self.assertIn("raw=await response.text()", handler)
        self.assertIn("try{data=JSON.parse(raw)}catch", handler)
        self.assertIn("Quality assessment could not be completed", handler)
        self.assertNotIn("await response.json()", handler)

    def test_failed_reproduction_clears_stale_bundle_result(self):
        start = HTML.index("document.getElementById('reproduceBundleForm')")
        end = HTML.index("initWorkspace()", start)
        handler = HTML[start:end]
        self.assertIn(
            "catch(err){error.textContent=err.message;"
            "document.getElementById('bundleView').innerHTML='';"
            "document.getElementById('bundleView').style.display='none'}",
            handler,
        )


if __name__ == "__main__":
    unittest.main()
