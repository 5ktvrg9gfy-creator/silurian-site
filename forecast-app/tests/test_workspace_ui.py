import unittest
from pathlib import Path


HTML = (Path(__file__).parents[1] / "static" / "index.html").read_text(encoding="utf-8")


class WorkspaceUiTests(unittest.TestCase):
    def test_each_output_is_an_independent_panel(self):
        for name in ("validation", "quality", "classification", "routing", "forecast", "provenance"):
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
        self.assertIn("No option changes the quality band", drawer)
        self.assertEqual(drawer.count('class="action-slot" aria-hidden="true"'), 1)
        self.assertNotIn("Do this</strong><span>${esc(routing", drawer)

    def test_recorded_bundle_view_and_version_gates_accept_routing(self):
        self.assertIn("['1.0','1.1','1.2'].includes(bundle.bundle_schema_version)", HTML)
        self.assertIn("['1.2','1.3','1.4','1.5'].includes(bundle.manifest.schema_version)", HTML)
        self.assertIn("routing:'1.0.0'", HTML)
        self.assertIn("Recorded routing result", HTML)

    def test_classification_panel_owns_matrix_grid_and_drawer_block(self):
        self.assertLess(HTML.index('data-workspace-tab="quality"'), HTML.index('data-workspace-tab="classification"'))
        self.assertLess(HTML.index('data-workspace-tab="classification"'), HTML.index('data-workspace-tab="forecast"'))
        self.assertIn("Portfolio classification matrix", HTML)
        self.assertIn("data-classification-cell", HTML)
        self.assertIn("ABC volume class", HTML)
        self.assertIn("Not meaningful for this demand class", HTML)
        self.assertIn("classification-block", HTML)
        self.assertIn('class="action-slot" aria-hidden="true"', HTML)

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
