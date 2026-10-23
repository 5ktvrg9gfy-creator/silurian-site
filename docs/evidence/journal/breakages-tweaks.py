"""Proves the controls on the journal tweaks of 23 October 2026 can fail: the bin,
spell check, and dragging with a mouse. Only these rules are broken, as asked; the
rest of the journal is held by the suites it already had.

Each case makes one deliberate break, runs the suite that should notice it (the
journal page tests, and for what only a browser can see the whole browser check),
records what went red, and puts the file back. Run from the repository root:

    python docs/evidence/journal/breakages-tweaks.py [words to pick cases]
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PAGE = [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_journal_page.py"]
BROWSER = ["node", "docs/evidence/journal/browser-check-journal.mjs"]


def run(name: str) -> list[str]:
    command, cwd = (PAGE, ROOT / "forecast-app") if name == "page" else (BROWSER, ROOT)
    try:
        result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=900)
    except subprocess.TimeoutExpired:
        return ["the run did not finish"]
    out = result.stdout + result.stderr
    if name == "page":
        return re.findall(r"^(?:FAIL|ERROR): (\w+)", out, re.MULTILINE)
    red = re.findall(r"^FAIL (.+)$", out, re.MULTILINE)
    return red or (["the run stopped early"] if result.returncode != 0 else [])


J = "journal/index.html"
CASES = [
    ("bin: a click asks first", J, "if (current) { deleteEntry(listKey, current, {}); }", 'if (current && window.confirm("Delete?")) { deleteEntry(listKey, current, {}); }', ["page"]),
    ("bin: the message no longer says Entry deleted", J, 'offerUndo("Entry deleted."', 'offerUndo("Entry removed."', ["page"]),
    ("bin: the bin has no name", J, 'bin.setAttribute("aria-label", "Delete entry: " + rowText(entry));', "", ["page"]),
    ("bin: no Undo after a delete", J, '      if (ok) { offerUndo("Entry deleted.", [{ op: "add", list: listKey, entry: { id: newId(), type: kept.type, text: kept.text, state: kept.state } }]); }', "", ["page"]),
    ("spell check: off for entries", J, 'text.setAttribute("spellcheck", "true");', 'text.setAttribute("spellcheck", "false");', ["page"]),
    ("spell check: a calendar line is not in UK English", J, '    line.setAttribute("lang", "en-GB");\n', "", ["page"]),
    ("spell check: off for Quick notes", J, 'spellcheck="true" lang="en-GB"></div>', 'spellcheck="false" lang="en-GB"></div>', ["page"]),
    ("spell check: turned on in notes", "notes/index.html", 'aria-label="Note text" spellcheck="false"', 'aria-label="Note text" spellcheck="true"', ["page"]),
    ("drag: a drop on the list the entry is in is a move", J, "return found && found.list !== dragging.list ? found : null;", "return found;", ["page", "browser"]),
    ("drag: a drop does not use the move the buttons use", J, "moveEntry(item.list, item.id, target.list, target.how);", 'submit({ op: "move", from: item.list, to: target.list, how: target.how, items: [{ id: item.id, rev: 1 }] }, {});', ["page"]),
    ("drag: a date line makes the move Migrate, not the Date picker's", J, 'found = { el: row, list: core.dayList(date), how: "scheduled" };', 'found = { el: row, list: core.dayList(date), how: "migrated" };', ["page"]),
    ("drag: a date before today is a target", J, 'if (date && date >= today) {', "if (date) {", ["page", "browser"]),
    ("drag: a finger can drag too", J, "    if (!mouse.matches) { return; }\n    li.setAttribute", "    li.setAttribute", ["page"]),
    ("drag: a drag in the text being edited picks the row up", J, 'li.setAttribute("draggable", editing ? "false" : "true");', 'li.setAttribute("draggable", "true");', ["page", "browser"]),
    ("drag: the target takes another fill", J, '.panel[data-drop="true"], .date-row[data-drop="true"] { background: var(--notes-selected); }', '.panel[data-drop="true"], .date-row[data-drop="true"] { background: var(--notes-hover); }', ["page", "browser"]),
    ("drag: the entry's text goes with the drag", J, 'event.dataTransfer.setData("application/x-journal-entry", entry.id);', 'event.dataTransfer.setData("text/plain", entry.text);', ["page"]),
    ("buttons: they show on hover again", J, '    html[data-input="keyboard"] .entry:focus-within .entry-actions { display: flex; }\n    .entry[data-open="true"] .entry-actions { display: flex; }\n  }', '    .entry:hover .entry-actions { display: flex; }\n    .entry[data-open="true"] .entry-actions { display: flex; }\n  }', ["page", "browser"]),
    ("buttons: keyboard focus never shows them", J, 'if (event.key === "Tab") {', 'if (event.key === "Never") {', ["page", "browser"]),
    ("buttons: a mouse gets the More button", J, "    .entry .more { display: none; }", "    .entry .more { display: inline-flex; }", ["page", "browser"]),
]


def main() -> int:
    only = sys.argv[1:]
    for name in ("page",):
        failing = run(name)
        if failing:
            print(f"BASE {name} is not green: {failing}")
            return 2
    print("base: the page tests are green before any break\n")
    missed = 0
    ran = 0
    for what, file, find, replace, suites in CASES:
        if only and not any(word in what for word in only):
            continue
        ran += 1
        path = ROOT / file
        original = path.read_bytes()
        text = original.decode("utf-8")
        if text.count(find) != 1:
            print(f"SKIP  {what}: the text to break was found {text.count(find)} times")
            missed += 1
            continue
        try:
            path.write_text(text.replace(find, replace), encoding="utf-8")
            failing = []
            for name in suites:
                failing += run(name)
        finally:
            path.write_bytes(original)
        status = "CAUGHT" if failing else "MISSED"
        if not failing:
            missed += 1
        print(f"{status} {what}  [{', '.join(suites)}]\n         {len(failing)} failed: {'; '.join(failing[:3])}{' ...' if len(failing) > 3 else ''}")
    print(f"\n{ran - missed} of {ran} deliberate breaks were caught")
    return 1 if missed else 0


if __name__ == "__main__":
    sys.exit(main())
