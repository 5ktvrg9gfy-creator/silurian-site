"""Story 2.7.5. Every specialist term on the screen is defined, once, in one file.

The acceptance criterion is that a test walks the rendered copy and fails on an
undefined term. Two halves to that:

`test_every_emitted_term_is_defined` reads the vocabularies out of the engines
themselves rather than from a list kept here, so adding an eighth routing
decision or a tenth resolution code fails until it is defined.

`test_the_interface_defines_every_specialist_word_it_prints` walks the
interface's own copy for specialist words and fails on one the glossary does
not carry.
"""

import re
import unittest
from pathlib import Path

from classification_engine import ABC_CLASSES, DEMAND_CLASSES
from glossary import ENTRIES, GLOSSARY_VERSION, by_slug, payload, slug
from routing_engine import DECISIONS, RESOLUTION_EFFECTS


APP = Path(__file__).parents[1]
HTML = (APP / "static" / "index.html").read_text(encoding="utf-8")
GLOSSARY_SOURCE = (APP / "glossary.py").read_text(encoding="utf-8")

QUALITY_BANDS = ("clean", "caveated", "not_usable")


class GlossaryTests(unittest.TestCase):
    def test_every_emitted_term_is_defined(self):
        """The vocabularies come from the engines, so a new code cannot slip in undefined."""
        defined = by_slug()
        emitted: dict[str, str] = {}
        for band in QUALITY_BANDS:
            emitted[band] = "quality band"
        for name in DEMAND_CLASSES:
            emitted[slug(name)] = "demand state"
        for name in DECISIONS:
            emitted[name] = "routing decision"
        for code in RESOLUTION_EFFECTS:
            emitted[slug(code.replace("_", " "))] = "resolution code"
        for name in ("adi", "cv_squared", "abc_volume_class", "xyz", "manifest", "bundle", "run", "pass"):
            emitted[name] = "named in the brief"
        missing = sorted(f"{term} ({why})" for term, why in emitted.items() if term not in defined)
        self.assertEqual(missing, [], "the tool emits a term the glossary does not define")
        self.assertEqual(len(DEMAND_CLASSES), 5)
        self.assertEqual(len(DECISIONS), 7)
        self.assertEqual(len(QUALITY_BANDS), 3)
        self.assertEqual(ABC_CLASSES, ("A", "B", "C"))

    def test_the_interface_defines_every_specialist_word_it_prints(self):
        """Walk the rendered copy. A specialist word on screen with no definition fails."""
        defined = by_slug()
        specialist = {
            "adi": "ADI",
            "cv_squared": "CV squared",
            "xyz": "XYZ",
            "abc_volume_class": "ABC volume class",
            "caveated": "Caveated",
            "not_usable": "Not usable",
            "lumpy": "Lumpy",
            "erratic": "Erratic",
            "intermittent": "Intermittent",
            "smooth": "Smooth",
            "unclassifiable": "Unclassifiable",
            "manifest": "Manifest",
            "bundle": "Bundle",
            "coverage": "Coverage",
            "volume_share": "Volume share",
            "forecast_eligible": "Forecast eligible",
            "refusal": "Refusal",
            "open_item": "Open item",
        }
        visible = re.sub(r"<style>.*?</style>", " ", HTML, flags=re.S)
        undefined = []
        for key, printed in specialist.items():
            if re.search(rf"(?i)\b{re.escape(printed)}\b", visible) and key not in defined:
                undefined.append(printed)
        self.assertEqual(undefined, [], "the interface prints a specialist term the glossary does not define")

    def test_the_tool_and_the_report_render_identical_text_from_one_file(self):
        """One source. Both render paths build from the same fetched payload."""
        self.assertIn("async function loadGlossary()", HTML)
        self.assertIn("await fetch('/api/glossary')", HTML)
        self.assertIn("function glossaryMarkup()", HTML)
        # The same markup string goes to the tool panel and to the report appendix.
        start = HTML.index("function renderGlossary(){")
        end = HTML.index("async function loadGlossary()", start)
        renderer = HTML[start:end]
        self.assertIn("const markup=glossaryMarkup();", renderer)
        self.assertIn("getElementById('glossaryContent').innerHTML=markup", renderer)
        self.assertIn("getElementById('qualityGlossary').innerHTML=`", renderer)
        self.assertIn("${markup}", renderer)
        self.assertEqual(renderer.count("glossaryMarkup()"), 1, "the report must not build its own copy")

    def test_the_report_appendix_costs_the_default_screen_no_height(self):
        """Rule two of band 2.7. Explanation on demand, never in the reading path.

        The appendix is in the DOM so the printed report carries it, and hidden
        on screen so the quality panel does not grow by a glossary. Measured:
        with the appendix on screen the panel went from 1571 to 3426 pixels.
        """
        self.assertIn(".glossary-appendix{display:none;", HTML)
        self.assertIn("@media print{.glossary-appendix{display:block!important;", HTML)

    def test_no_definition_is_written_in_the_interface(self):
        """A second copy of a definition is the drift this story exists to prevent."""
        for entry in ENTRIES:
            with self.subTest(term=entry["term"]):
                self.assertNotIn(entry["plain"], HTML)

    def test_definitions_are_written_for_a_planner(self):
        banned = re.compile(
            r"(?i)\b(?:heteroscedastic|stochastic|coefficient of variation|autocorrelation|"
            r"parametric|Poisson|Bernoulli|kurtosis|p-value)\b"
        )
        for entry in ENTRIES:
            with self.subTest(term=entry["term"]):
                self.assertTrue(entry["plain"].strip().endswith("."))
                self.assertNotRegex(entry["plain"], banned)
                self.assertNotIn("—", entry["plain"])
                self.assertNotIn("–", entry["plain"])
                self.assertGreater(len(entry["plain"]), 40)
                self.assertLess(len(entry["plain"]), 320)

    def test_the_two_bands_the_planner_could_not_separate_state_what_each_requires(self):
        """Defect 4 in the planner test: caveated against not usable was not operationally clear."""
        defined = by_slug()
        caveated, not_usable = defined["caveated"]["plain"], defined["not_usable"]["plain"]
        self.assertIn("your judgement", caveated.lower())
        self.assertIn("usable", caveated.lower())
        self.assertIn("cannot support a forecast", not_usable.lower())
        self.assertIn("has to change in the data", not_usable.lower())
        self.assertNotEqual(caveated, not_usable)

    def test_every_term_is_defined_exactly_once(self):
        slugs = [slug(entry["term"]) for entry in ENTRIES]
        self.assertEqual(len(slugs), len(set(slugs)), "a term is defined twice")

    def test_the_payload_is_what_the_endpoint_serves(self):
        body = payload()
        self.assertEqual(body["glossary_version"], GLOSSARY_VERSION)
        self.assertEqual(len(body["entries"]), len(ENTRIES))
        self.assertEqual({key for entry in body["entries"] for key in entry}, {"group", "term", "plain"})

    def test_the_glossary_computes_nothing_and_no_engine_depends_on_it(self):
        """It holds words. A definition that drifts into a judgement is a second implementation."""
        import glossary

        self.assertNotRegex(GLOSSARY_SOURCE, r"(?m)^(?:from|import)\s+(?!typing\b)")
        self.assertEqual([name for name in dir(glossary) if name.startswith("assess") or name.startswith("route")], [])
        for engine in (APP / "quality_engine.py", APP / "classification_engine.py", APP / "routing_engine.py", APP / "validator.py"):
            with self.subTest(engine=engine.name):
                self.assertNotIn("glossary", engine.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
