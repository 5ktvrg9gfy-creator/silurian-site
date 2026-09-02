import unittest
from pathlib import Path


HTML = (Path(__file__).parents[1] / "static" / "index.html").read_text(encoding="utf-8")


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
        self.assertIn("*{border-radius:0!important}", HTML)
        self.assertNotIn("Arial", HTML)
        self.assertNotIn("Consolas,monospace", HTML)

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
        self.assertIn("percent</strong> of volume is forecast eligible", renderer)
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

    def test_drawer_carries_decision_reason_and_refusal_but_no_action(self):
        start = HTML.index("function openQualityDrawer(sku,opener){")
        end = HTML.index("function closeQualityDrawer(){", start)
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
        start = HTML.index("function openQualityDrawer(sku,opener){")
        end = HTML.index("function closeQualityDrawer(){", start)
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
        start = HTML.index("function openQualityDrawer(sku,opener){")
        end = HTML.index("function closeQualityDrawer(){", start)
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
        self.assertIn("waiting on you", renderer)
        self.assertIn("Every refusal is resolved.", renderer)
        self.assertIn("The last was resolved at ${esc(timeCopy(portfolio.last_resolved_at))}", renderer)
        self.assertIn("<th>Rank</th>", renderer)
        self.assertIn("<th>Resolution options</th>", renderer)
        self.assertNotIn("sort(", renderer)
        self.assertNotIn("qualityRows", renderer)
        self.assertNotIn("routingRows", renderer)

    def test_every_drawer_statement_names_its_stage(self):
        start = HTML.index("function openQualityDrawer(sku,opener){")
        end = HTML.index("function closeQualityDrawer(){", start)
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
