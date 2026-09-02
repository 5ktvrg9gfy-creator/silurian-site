import unittest
from pathlib import Path


HTML = (Path(__file__).parents[1] / "static" / "index.html").read_text(encoding="utf-8")


class WorkspaceUiTests(unittest.TestCase):
    def test_each_output_is_an_independent_panel(self):
        for name in ("validation", "quality", "classification", "forecast", "provenance"):
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

    def test_forecast_empty_state_is_derived_from_quality_result(self):
        self.assertIn("excluded=all.filter(item=>item.band==='not_usable')", HTML)
        self.assertIn("reasons.map", HTML)
        self.assertNotIn("Nine of twelve lines are eligible", HTML)

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
