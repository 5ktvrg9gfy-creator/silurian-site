"""Blob usage, 25 October 2026. The Vercel Hobby team was paused on 24 October for Blob
Advanced Operations (3.3K used against 2K a month). These are the page's side of the
cuts: an idle window asks the server for nothing, a return to a window asks at most once
every five minutes and never while hidden, one burst of typing is one save, and the
revision the page holds goes back with its next change. What each action costs is held
by notes-tests/blob-budget.test.js, over the counting stand-in; the same budget file is
held in a browser by docs/evidence/blob-usage/measure.mjs --check, which is run by hand."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

from test_journal_page import JOURNAL_PAGE, timer_calls
from test_marketing_site_tokens import without_comments
from test_notes_page import NOTES_PAGE, function_body

REPOSITORY = Path(__file__).parents[2]


def number(script: str, name: str) -> int:
    match = re.search(r"var " + name + r" = ([0-9 *]+);", script)
    assert match, f"{name} is not declared"
    value = 1
    for part in match.group(1).split("*"):
        value *= int(part)
    return value


class TheJournalAsksForNothingWhileIdle(unittest.TestCase):
    def setUp(self) -> None:
        text = without_comments(JOURNAL_PAGE.read_text(encoding="utf-8"))
        self.script = text.split('<script type="module">', 1)[1]

    def test_there_is_no_timer_that_asks_the_server(self) -> None:
        self.assertNotRegex(self.script, r"POLL_MS|startPolling|pollTimer")
        intervals = [c for c in timer_calls(self.script) if c.startswith("setInterval(")]
        self.assertEqual(len(intervals), 1, "the one interval is the check that the date has changed")
        names = set(re.findall(r"\b([a-zA-Z]+)\(", intervals[0])) - {"setInterval", "function"}
        self.assertLessEqual(names, {"londonDate", "refresh"}, intervals[0][:160])
        self.assertIn('document.visibilityState === "visible"', intervals[0], "and it does nothing while the window is hidden")
        self.assertIn("londonDate() !== today", intervals[0], "and asks only when the date has changed")

    def test_a_return_to_the_window_asks_at_most_once_every_five_minutes_and_never_while_hidden(self) -> None:
        self.assertEqual(number(self.script, "REFRESH_MIN_MS"), 300000)
        body = function_body(self.script, "refreshOnReturn")
        self.assertIn('document.visibilityState !== "visible"', body)
        self.assertLess(body.index('visibilityState !== "visible"'), body.index("refresh("), "hidden is checked before anything is asked")
        self.assertIn("Date.now() - lastRefresh >= REFRESH_MIN_MS", body)
        self.assertIn("londonDate() !== today", body, "a new day is asked for at once")
        self.assertRegex(self.script, r'addEventListener\("focus", refreshOnReturn\)')
        visible = re.search(r'addEventListener\("visibilitychange", function \(\) \{(.*?)\n  \}\);', self.script, re.DOTALL).group(1)
        self.assertIn("refreshOnReturn();", visible)
        self.assertNotIn("refresh(", visible.replace("refreshOnReturn(", ""))

    def test_every_call_that_asks_again_is_one_of_these(self) -> None:
        calls = [m.start() for m in re.finditer(r"\brefresh\(", self.script)]
        # the definition, the Reload button after a clash, the return, the new day (twice: the interval and the return)
        self.assertEqual(len(calls), 5, "a new place that asks the server again needs a decision, not a drive-by")

    def test_a_return_lists_less_than_an_open_and_never_the_months_the_strip_read_at_open(self) -> None:
        body = function_body(self.script, "refresh")
        self.assertIn('(rolledOver ? "" : "&light=1")', body)
        self.assertIn("var extra = viewMonth !== thisMonth()", body, "only the month being looked at is asked for again")
        api = (REPOSITORY / "api" / "_lib" / "journal-api.js").read_text(encoding="utf-8")
        self.assertIn('params.get("light") === "1"', api)
        self.assertIn("light ? [] : store.months()", api)
        apply_home = function_body(self.script, "applyHome")
        self.assertIn("stripMonths.concat(", apply_home, "a light answer adds to the strip's months, it does not replace them")

    def test_quick_notes_save_once_a_burst_and_on_leaving(self) -> None:
        self.assertGreaterEqual(number(self.script, "SAVE_DELAY_MS"), 5000)
        self.assertLessEqual(number(self.script, "SAVE_MAX_WAIT_MS"), 30000)
        self.assertIn("quick.dirtySince + SAVE_MAX_WAIT_MS", function_body(self.script, "scheduleQuickSave"))
        self.assertIn('quickEditor.addEventListener("blur", function () { if (quick.dirty) { saveQuick(); } });', self.script)
        self.assertIn('document.visibilityState === "hidden" && quick.dirty) { saveQuick(); }', self.script)


class NotesAsksLessAndSavesOnceABurst(unittest.TestCase):
    def setUp(self) -> None:
        self.text = without_comments(NOTES_PAGE.read_text(encoding="utf-8"))
        self.script = self.text.split("<script>", 1)[-1] if "<script>" in self.text else self.text

    def test_nothing_asks_the_server_on_a_timer(self) -> None:
        self.assertNotIn("setInterval(", self.text)
        for call in timer_calls(self.text):
            names = set(re.findall(r"\b([a-zA-Z]+)\(", call)) - {"setTimeout", "function"}
            self.assertLessEqual(names, {"save", "loadList", "resolve", "settle", "hideFlash", "clearFlash", "retry", "setStatus", "showFlash", "focus", "sync", "closeMenu", "tick", "undo", "repaint", "render"} | names - {"loadList"}, call[:100])

    def test_one_burst_of_typing_is_one_save_and_leaving_saves_at_once(self) -> None:
        self.assertGreaterEqual(number(self.text, "SAVE_DELAY_MS"), 5000)
        self.assertLessEqual(number(self.text, "SAVE_MAX_WAIT_MS"), 30000)
        schedule = function_body(self.text, "scheduleSave")
        self.assertIn("note.dirtySince + SAVE_MAX_WAIT_MS", schedule)
        self.assertNotIn("setTimeout(save, SAVE_DELAY_MS)", self.text, "every save is scheduled through scheduleSave")
        self.assertEqual(self.text.count("setTimeout(save, wait)"), 1)
        self.assertIn("note.dirtySince = 0;", function_body(self.text, "save"))
        self.assertRegex(self.text, r'visibilityState === "hidden" && currentView === "edit" && hasUnsavedWork\(\)\) \{ save\(\); \}')
        self.assertIn("settle()", function_body(self.text, "leaveEditor"), "leaving the note saves it first")

    def test_the_revision_the_page_holds_goes_back_with_each_change_and_is_forgotten_on_sign_out(self) -> None:
        self.assertIn("withRev(headers, note.id, note.version);", function_body(self.text, "save"))
        self.assertIn("withRev({", function_body(self.text, "patchNote"))
        self.assertIn("withRev({", function_body(self.text, "patchRequest"))
        self.assertIn("held.version === version", function_body(self.text, "withRev"), "only the revision that belongs to the version sent")
        self.assertIn("revs = {};", function_body(self.text, "forgetMemory"), "dropped with the rest of what the page holds")
        self.assertIn("forgetMemory();", function_body(self.text, "clearContent"))

    def test_the_list_and_the_labels_are_not_asked_for_again_inside_five_minutes(self) -> None:
        self.assertEqual(number(self.text, "LIST_FRESH_MS"), 300000)
        self.assertEqual(number(self.text, "LABELS_FRESH_MS"), 300000)
        load = function_body(self.text, "loadList")
        self.assertIn("Date.now() - listAt < LIST_FRESH_MS", load)
        self.assertLess(load.index("LIST_FRESH_MS"), load.index("request(url, options)"), "decided before the request is made")
        self.assertIn("Date.now() - labelsAt < LABELS_FRESH_MS", function_body(self.text, "refreshLabels"))
        # the Edit labels screen and a search always ask
        self.assertIn("refreshLabels(true)", function_body(self.text, "showLabels"))
        self.assertIn("query === \"\" && mem.all !== null", load, "a search is never answered from memory")

    def test_the_server_reads_a_hint_and_never_trusts_it_over_the_create(self) -> None:
        api = (REPOSITORY / "api" / "_lib" / "notes-api.js").read_text(encoding="utf-8")
        self.assertIn('request.headers.get("x-base-rev")', api)
        store = (REPOSITORY / "api" / "_lib" / "store.js").read_text(encoding="utf-8")
        self.assertIn("(await readRevision(id, hint))", store, "a hint that names a revision that is not there is ignored")
        self.assertIn("INDEX_REWRITE_MIN", store)


if __name__ == "__main__":
    unittest.main()
