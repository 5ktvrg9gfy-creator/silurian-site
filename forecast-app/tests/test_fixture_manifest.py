"""The fixture manifest's prose must agree with the control it describes.

`MANIFEST.md` describes the sprint 1 validation fixtures in words, including the
verdict each one is expected to produce. `expected_findings.json` records those
verdicts as the control, and `test_every_fixture_pass` holds the engine against
it. Nothing held the prose against it, so the prose drifted: fixture 05 read
"accept with warnings" where the control says reject, and fixture 07 read the
same where the control says accept, the second left behind when story 1.6 moved
those characterisations out of validation and into the quality stage.

Both were corrected and the integrity pin reissued. This module exists so the
next drift fails the build instead of waiting to be noticed by someone reading
two files side by side.

What it does not do. It does not parse prose into behaviour and it is not a
second implementation of any judgement. It reads one claim, the leading verdict
of an `**Expect:**` line, and compares it to the field that owns it. The manifest
remains a description; `expected_findings.json` remains the control, and where
they disagree the control wins and the document moves.
"""

import json
import re
import unittest
from pathlib import Path


FIXTURES = Path(__file__).parent / "fixtures"
MANIFEST = (FIXTURES / "MANIFEST.md").read_text(encoding="utf-8")
EXPECTED = json.loads((FIXTURES / "expected_findings.json").read_text(encoding="utf-8"))

# Longest first, so "accept with warnings" is not read as "accept".
VOCABULARY = (
    ("accept with warnings", "accept_with_warnings"),
    ("reject", "reject"),
    ("accept", "accept"),
)

# Every fixture the manifest describes. Pinned so a parse that silently finds
# nothing fails instead of passing on an empty set.
BLOCKS_EXPECTED = 13

# The fixtures whose prose states a verdict as the first words of its Expect
# line. Pinned rather than discovered, so prose that gains a verdict fails this
# test and has to be checked, rather than being quietly ignored.
STATE_A_VERDICT = frozenset({
    "01_excel_export_furniture.csv",
    "02_date_disorder.csv",
    "03_numeric_disorder.csv",
    "05_duplicates_and_aliases.csv",
    "06_semicolon_latin1.csv",
    "07_zeros_versus_gaps.csv",
    "09_mixed_granularity_subtotals.csv",
    "10_header_variants_order_book.csv",
    "11_actuals_and_forecast_mixed.csv",
    "12_wrong_file_inventory_snapshot.csv",
})

# The three that state no verdict, each for a reason rather than by oversight.
# 00 carries no Expect line at all. 04 and 08 open with the handling they
# require, "detect wide format" and "flag the level break", not with a verdict.
STATE_NO_VERDICT = frozenset({
    "00_clean_control.csv",
    "04_pivoted_wide.csv",
    "08_unit_change_midhistory.csv",
})


def manifest_blocks():
    """Each fixture heading and the Expect line that follows it, if any."""
    blocks = {}
    for chunk in re.split(r"^### ", MANIFEST, flags=re.M)[1:]:
        name = chunk.split("\n", 1)[0].strip()
        match = re.search(r"^\*\*Expect:\*\*\s*(.+)$", chunk, flags=re.M)
        blocks[name] = match.group(1).strip() if match else None
    return blocks


def stated_verdict(expect_line):
    if not expect_line:
        return None
    lowered = expect_line.lower()
    for prefix, verdict in VOCABULARY:
        if lowered.startswith(prefix):
            return verdict
    return None


def control_verdict(name):
    for entry in EXPECTED["files"]:
        if entry["file"] == name:
            return entry["passes"][0]["verdict"]
    return None


class FixtureManifestMatchesTheControlTests(unittest.TestCase):
    def setUp(self):
        self.blocks = manifest_blocks()

    def test_the_manifest_describes_every_fixture_the_control_records(self):
        """A collapsed parse fails here rather than passing on nothing."""
        self.assertEqual(len(self.blocks), BLOCKS_EXPECTED)
        self.assertEqual(
            set(self.blocks), {entry["file"] for entry in EXPECTED["files"]},
            "the manifest and the expectations file describe different fixtures",
        )

    def test_exactly_the_expected_fixtures_state_a_verdict_in_prose(self):
        """Prose that gains or loses a verdict has to be looked at.

        A fixture added to the stated set is a new claim that must be checked.
        One dropped from it is a claim quietly removed. Either way the pinned
        sets move only deliberately.
        """
        stated = {name for name, line in self.blocks.items() if stated_verdict(line)}
        self.assertEqual(stated, set(STATE_A_VERDICT))
        self.assertEqual(set(self.blocks) - stated, set(STATE_NO_VERDICT))
        self.assertEqual(len(stated), 10)

    def test_every_verdict_the_prose_states_matches_the_control(self):
        for name in sorted(STATE_A_VERDICT):
            with self.subTest(fixture=name):
                self.assertEqual(
                    stated_verdict(self.blocks[name]),
                    control_verdict(name),
                    f"{name}: MANIFEST.md and expected_findings.json disagree. "
                    "The expectations file governs; correct the manifest.",
                )

    def test_the_two_corrected_lines_say_what_the_control_says(self):
        """The drift this module was written for, pinned by name."""
        self.assertEqual(control_verdict("05_duplicates_and_aliases.csv"), "reject")
        self.assertEqual(stated_verdict(self.blocks["05_duplicates_and_aliases.csv"]), "reject")
        self.assertEqual(control_verdict("07_zeros_versus_gaps.csv"), "accept")
        self.assertEqual(stated_verdict(self.blocks["07_zeros_versus_gaps.csv"]), "accept")


if __name__ == "__main__":
    unittest.main()
