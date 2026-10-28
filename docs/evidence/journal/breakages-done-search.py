"""Deliberate breakage proofs for the new rules of the Done list, the calendar search and
the Quick notes bullets (28 October 2026). Each one breaks a rule in the real file, runs
the control that is meant to catch it, expects it to fail, and puts the file back.
Run from the repository root:  python3 docs/evidence/journal/breakages-done-search.py
Output is kept in breakages-done-search-run.txt."""
import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
NODE = ["node", "--test", "notes-tests/journal-done-search.test.js"]
PY = ["python3", "-m", "unittest", "discover", "-s", "forecast-app/tests", "-p", "test_journal_page.py", "-k"]
BROWSER = ["node", "docs/evidence/journal/browser-check-journal-done-search.mjs"]

# (name, file, old, new, command, what must fail)
BREAKS = [
    ("the tick time is the newest revision's, not the tick's", "api/_lib/journal-api.js",
     "for (let looked = 0; rev > 1 && looked < MAX_PROBE; looked += 1) {", "for (let looked = 0; false && rev > 1 && looked < MAX_PROBE; looked += 1) {", NODE, "text edits after it do not move it"),
    ("open tasks are listed as done", "api/_lib/journal-api.js",
     'newest.entry.type !== "task" || newest.entry.state !== "done") return null;', 'newest.entry.type !== "task") return null;', NODE, "only tasks that are done"),
    ("a file written before the month is read", "api/_lib/journal-api.js",
     "e.times[e.rev] === null || e.times[e.rev] === undefined || e.times[e.rev] >= since", "true", NODE, "are not read"),
    ("the day is the UTC date, not London's", "journal/core.js",
     'timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });\nexport function londonDateOf', 'timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });\nexport function londonDateOf', NODE, "London date decides"),
    ("a task with no known time is dropped", "journal/core.js",
     "const inMonth = date === null ? parseList(item.list).month === month : monthOf(date) === month;", "const inMonth = date === null ? false : monthOf(date) === month;", NODE, "no time last"),
    ("search is case sensitive", "journal/core.js",
     "const has = (value) => plainText(value).toLowerCase().includes(needle);", "const has = (value) => plainText(value).includes(needle);", NODE, "ignoring case"),
    ("search finds moved entries", "journal/core.js",
     'if (["removed", "migrated", "scheduled"].includes(e.state) || !has(e.text)) continue;\n        found.push({ kind: "entry", date,', 'if (["removed"].includes(e.state) || !has(e.text)) continue;\n        found.push({ kind: "entry", date,', NODE, "leaves out removed and moved"),
    ("search reads the months the page holds", "api/_lib/journal-store.js",
     "if (!match || skip.includes(match[1])) continue;\n        const key", "if (!match) continue;\n        const key", NODE, "skips the months the page holds"),
    ("Enter on an empty bullet carries on the list", "journal/core.js",
     'return bulletBody(line).trim() === "" ? "end" : "continue";', 'return "continue";', NODE, "an empty one ends it"),
    ("the Done list does not wait for saves", "journal/index.html",
     'drained().then(function () {\n      return request("/api/journal?view=done&month=" + month);', 'Promise.resolve().then(function () {\n      return request("/api/journal?view=done&month=" + month);', PY + ["done_asks_for_one_month"], "after saves"),
    ("every search asks the server again", "journal/index.html",
     "if (search.loaded && Date.now() - search.at < REFRESH_MIN_MS) { renderAll(); return; }", "", PY + ["first_search_reads"], "first search"),
    ("the search text is sent to the server", "journal/index.html",
     'var skip = held.length <= 36 ? "&skip=" + held.join(",") : "";', 'var skip = (held.length <= 36 ? "&skip=" + held.join(",") : "") + "&q=" + search.q;', PY + ["first_search_reads"], "first search"),
    ("a month step adds to the history", "journal/index.html",
     'history.replaceState({ done: target }, "", "#done/" + target);', 'history.pushState({ done: target }, "", "#done/" + target);', PY + ["own_address"], "address"),
    ("the bullet button is not wired", "journal/index.html",
     "if (b.classList.contains(\"fmt-bullet\")) { toggleBulletLine(quickEditor); }", "if (false) { toggleBulletLine(quickEditor); }", PY + ["bullet_button"], "bullet"),
    ("the Done list gets an edit control", "journal/index.html",
     "        li.appendChild(make(\"span\", \"done-log\", logLabel(item.list)));", "        li.appendChild(make(\"span\", \"done-log\", logLabel(item.list)));\n        li.appendChild(make(\"button\", \"quiet\", \"Edit\"));", PY + ["read_only"], "only shows"),
    ("Back does not return from the Done view", "journal/index.html",
     'if (done.pushed) { history.back(); } else if (/^#done/.test(location.hash)) { history.replaceState(null, "", location.pathname); }', "", BROWSER, "Back puts the panels back"),
    ("a bullet is made by a paste too", "journal/index.html",
     'if (event.inputType !== "insertText" || (event.data', 'if ((event.data', PY + ["bullet_rules"], "typed space"),
]

def run(cmd):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=600)

caught = 0
lines = []
for name, path, old, new, cmd, what in BREAKS:
    file = ROOT / path
    original = file.read_text()
    if original.count(old) != 1:
        lines.append(f"SKIPPED  {name}: the text to break was found {original.count(old)} times")
        continue
    try:
        file.write_text(original.replace(old, new))
        result = run(cmd)
        failed = result.returncode != 0
    finally:
        file.write_text(original)
    lines.append(("CAUGHT   " if failed else "MISSED   ") + name + f"   ({' '.join(cmd[-1:])}; wanted: {what})")
    caught += failed
clean = run(NODE).returncode == 0 and run(PY + ["JournalDoneListSearchAndBullets"]).returncode == 0
lines.append(f"\n{caught} of {len(BREAKS)} caught; the controls pass again with every file restored: {clean}")
print("\n".join(lines))
sys.exit(0 if caught == len(BREAKS) and clean else 1)
