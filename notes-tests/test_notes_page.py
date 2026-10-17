"""The private notes page at the repository root.

The notes page is the first server-side code the marketing site has had. Its
own tests are Node tests in `notes-tests/`, because the code under test is Node.
This file lives here, not in `forecast-app/tests/`, because the brief for the
notes page said nothing under `forecast-app/` changes. Run it from the repository
root with `python -m unittest discover -s notes-tests`. It is not part of the
`forecast-app` suite until the product owner agrees to move it (open question
Q9 in docs/notes-page-open-questions.md). It does two jobs:

1. It runs the Node suite and fails, rather than skips, when it cannot. A control
   that did not run has not passed (CLAUDE.md section 13).
2. It holds the notes page to the marketing site's own scans. The page sits in
   `notes/index.html`, deliberately not at the root, so the root page scans in
   `test_marketing_site_tokens.py` and `test_marketing_site_analytics.py` do not
   pick it up. This is the place its tokens, type sizes and radius are read.
"""

import re
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

REPOSITORY = Path(__file__).parents[1]

# The site's own scans are reused, not copied: a second copy of a rule is how
# the two drift apart.
sys.path.insert(0, str(REPOSITORY / "forecast-app" / "tests"))

from test_marketing_site_tokens import (  # noqa: E402
    EXPECTED_PAGES,
    declared_custom_properties,
    marketing_pages,
    non_zero_radius_selectors,
    raw_colours,
    raw_type_sizes,
    used_custom_properties,
    without_comments,
)


NOTES_PAGE = REPOSITORY / "notes" / "index.html"
DASHES = re.compile("[–—]|&mdash;|&ndash;|&#8212;|&#8211;|\\\\u201[34]", re.IGNORECASE)


class NotesNodeSuite(unittest.TestCase):
    def test_the_node_suite_passes(self) -> None:
        npm = shutil.which("npm")
        self.assertIsNotNone(
            npm, "npm is not installed, so the notes tests did not run. Install Node 22."
        )
        self.assertTrue(
            (REPOSITORY / "node_modules" / "@vercel" / "blob").is_dir(),
            "Run `npm ci` at the repository root first. Without it the notes tests did not run.",
        )
        result = subprocess.run(
            [npm, "test", "--silent"],
            cwd=REPOSITORY,
            capture_output=True,
            text=True,
            timeout=300,
        )
        passed = re.search(r"^# pass (\d+)$", result.stdout, re.MULTILINE)
        failed = re.search(r"^# fail (\d+)$", result.stdout, re.MULTILINE)
        self.assertIsNotNone(passed, "The Node run reported no totals, so it did not run.\n" + result.stdout[-2000:])
        self.assertGreaterEqual(int(passed.group(1)), 30, "Far fewer notes tests ran than were written.")
        self.assertEqual(int(failed.group(1)), 0, result.stdout[-4000:])
        self.assertEqual(result.returncode, 0, result.stdout[-4000:] + result.stderr[-2000:])


class NotesPageKeepsToTheSiteRules(unittest.TestCase):
    def setUp(self) -> None:
        self.text = NOTES_PAGE.read_text(encoding="utf-8")

    def test_the_page_is_not_a_root_marketing_page(self) -> None:
        self.assertNotIn(NOTES_PAGE, marketing_pages())
        self.assertEqual(
            tuple(page.name for page in marketing_pages()),
            EXPECTED_PAGES,
            "A root page was added. The notes page lives in notes/ so the pinned page list stays at five.",
        )

    def test_no_raw_colour_and_no_hand_written_size(self) -> None:
        self.assertEqual(raw_colours(self.text), [])
        self.assertEqual(raw_type_sizes(self.text), [])

    def test_every_variable_it_reads_is_declared(self) -> None:
        declared, chain = declared_custom_properties(NOTES_PAGE)
        self.assertIn("/tokens.css", chain, "The page does not load the site tokens.")
        missing = sorted(used_custom_properties(without_comments(self.text)) - declared)
        self.assertEqual(missing, [], "var() names nothing declares: " + ", ".join(missing))

    def test_zero_radius(self) -> None:
        self.assertEqual(non_zero_radius_selectors(NOTES_PAGE), set())

    def test_archivo_everywhere_but_the_note_box(self) -> None:
        families = re.findall(r"font-family:\s*([^;]+);", self.text)
        monospace = [family for family in families if "monospace" in family]
        self.assertEqual(len(monospace), 1, "Only the note box may leave Archivo.")
        self.assertIn(".editor", self.text.split(monospace[0])[0].rsplit("{", 1)[0])

    def test_no_dash_in_anything_a_user_reads(self) -> None:
        self.assertEqual(DASHES.findall(self.text), [])
        api = REPOSITORY / "api" / "_lib" / "notes-api.js"
        self.assertEqual(DASHES.findall(api.read_text(encoding="utf-8")), [])


if __name__ == "__main__":
    unittest.main()
