"""Proves the controls on past days and multi-day spans (23 October 2026) can fail.
Only these rules are broken, as asked; the rest of the journal is held by the suites
it already had.

Each case makes one deliberate break, runs the suites that should notice it (the Node
tests, the journal page tests, and for what only a browser can see the whole browser
check), records what went red, and puts the file back. Run from the repository root:

    python docs/evidence/journal/breakages-spans.py [words to pick cases]
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SUITES = {
    "node": (["npm", "test"], ROOT),
    "page": ([sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_journal_page.py"], ROOT / "forecast-app"),
    "browser": (["node", "docs/evidence/journal/browser-check-journal.mjs"], ROOT),
}


def run(name: str) -> list[str]:
    command, cwd = SUITES[name]
    try:
        result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=1500)
    except subprocess.TimeoutExpired:
        return ["the run did not finish"]
    out = result.stdout + result.stderr
    if name == "page":
        return re.findall(r"^(?:FAIL|ERROR): (\w+)", out, re.MULTILINE)
    if name == "node":
        return re.findall(r"^not ok \d+ - (.+)$", out, re.MULTILINE) or (["the run stopped early"] if result.returncode != 0 else [])
    red = re.findall(r"^FAIL (.+)$", out, re.MULTILINE)
    return red or (["the run stopped early"] if result.returncode != 0 else [])


J = "journal/index.html"
C = "journal/core.js"
S = "api/_lib/journal-store.js"
A = "api/_lib/journal-api.js"
CASES = [
    ("rules: a span may end the day it starts", C, "return isDate(start) && isDate(end) && end > start &&", "return isDate(start) && isDate(end) && end >= start &&", ["node"]),
    ("rules: a span may be 400 days", C, "export const MAX_SPAN_DAYS = 366;", "export const MAX_SPAN_DAYS = 400;", ["node", "page"]),
    ("rules: the id ignores the line's revision", C, 'export const spanIdFor = (start, lineRev) => copyIdFor("span", lineRev, start);', 'export const spanIdFor = (start, lineRev) => copyIdFor("span", 0, start);', ["node"]),
    ("rules: an edit does not check the revision it started from", C, 'if (!span || span.state !== "open" || span.rev !== op.rev) return spanStale();\n  if (op.end', 'if (!span || span.state !== "open") return spanStale();\n  if (op.end', ["node"]),
    ("rules: a repeated edit is a clash, not done", C, "if (span && span.state === \"open\" && span.rev === op.rev + 1 && same(span)) return done;\n", "", ["node"]),
    ("rules: a repeated add is a second span", C, "if (existing) return existing.start === given.start ? { changed: [], created: [existing.id] } : { error: { code: \"invalid\", message: MESSAGES.invalid } };\n", "", ["node"]),
    ("rules: four lanes, not three", C, "export const MAX_LANES = 3;", "export const MAX_LANES = 4;", ["node", "page"]),
    ("rules: a continued span has no bar from the top", C, "top: date === first && item.s.start < first,", "top: false,", ["node"]),
    ("rules: every day has a foot", C, "foot: date === item.s.end,", "foot: true,", ["node"]),
    ("rules: a span with a damaged file is read as if it were fine", C, 'if (!raw || typeof raw !== "object" || raw.v !== SPAN_VERSION) return null;', 'if (!raw || typeof raw !== "object") return null;', ["node"]),
    ("storage: the span file name has no revision and is overwritten", S, "const spanPath = (id, rev) => `${SPAN_PREFIX}${id}.${rev}.json`;", "const spanPath = (id, rev) => `${SPAN_PREFIX}${id}.json`;", ["node", "page"]),
    ("storage: a span is put under the entries' prefix", S, 'const SPAN_PREFIX = "journal/spans/";', 'const SPAN_PREFIX = "journal/e/";', ["node", "page"]),
    ("api: a refused create of a span is taken as made", A, "if (await store.createSpan(w)) { records[w.id] = w; continue; }", "await store.createSpan(w); records[w.id] = w; continue;", ["node"]),
    ("api: the months view leaves the spans out", A, "return reply(200, { months: view(files, months), spans });", "return reply(200, { months: view(files, months) });", ["node", "page"]),
    ("page: a past day is not marked past", J, 'if (date < today) { li.setAttribute("data-past", "true"); }', "", ["page", "browser"]),
    ("page: the line is cleared before the span is made", J, 'submit({ op: "spanAdd", span: { id: id, start: date, end: end, text: line.text } }, {}).then(function (ok) {\n      if (!ok) { return; }\n      submit({ op: "line", date: date, rev: line.rev, text: "" }, {});\n    });', 'submit({ op: "line", date: date, rev: line.rev, text: "" }, {}).then(function (ok) {\n      if (!ok) { return; }\n      submit({ op: "spanAdd", span: { id: id, start: date, end: end, text: line.text } }, {});\n    });', ["page", "browser"]),
    ("page: just this day removes the span before the line is written back", J, 'submit({ op: "line", date: span.start, rev: line.rev, text: text }, {}).then(function (ok) { if (ok) { ask(); } });', 'ask().then(function (ok) { if (ok) { submit({ op: "line", date: span.start, rev: line.rev, text: text }, {}); } });', ["page"]),
    ("page: the handle drag can start an entry drag", J, "    event.preventDefault();\n    event.stopPropagation();\n    if (spanDrag) { endSpanDrag(false); }", "    if (spanDrag) { endSpanDrag(false); }", ["page"]),
    ("page: releasing on the first day makes a span", J, "} else if (drag.target !== drag.start) {\n      makeSpan(drag.start, drag.target);", "} else {\n      makeSpan(drag.start, drag.target);", ["page", "browser"]),
    ("page: Esc does not cancel a handle drag", J, 'if (event.key === "Escape" && spanDrag) {', 'if (event.key === "Never" && spanDrag) {', ["page", "browser"]),
    ("page: Just this day does not end the span", J, "    if (end === context.start) {\n      if (context.span) { justThisDay(context.span.id); }\n      return;\n    }", "    if (end === context.start) {\n      return;\n    }", ["browser"]),
    ("page: clicking a bar selects nothing", J, 'bar.addEventListener("click", function () { selectSpan(b.id); });', "", ["browser"]),
    ("page: Delete with the span selected does nothing", J, 'event.key === "Delete" && selectedSpan === id', 'event.key === "Never" && selectedSpan === id', ["page", "browser"]),
    ("page: Undo of a span delete reuses the removed span's id", J, '{ op: "spanAdd", span: { id: newId(), start: kept.start', '{ op: "spanAdd", span: { id: id, start: kept.start', ["page", "browser"]),
    ("page: words do not indent past the lanes", J, 'li.style.setProperty("--lanes", String(rowSpan.lanes));', 'li.style.setProperty("--lanes", "0");', ["browser"]),
    ("page: the handle shows for a finger too", J, "@media (pointer: coarse) { .span-handle { display: none; } }", "", ["page"]),
    ("page: Until menu rows are 36px", J, ".until-menu button { display: flex; justify-content: space-between; width: 100%; min-height: 44px;", ".until-menu button { display: flex; justify-content: space-between; width: 100%; min-height: 36px;", ["page", "browser"]),
    ("page: a refused change draws over the typed words", J, "      if (answer.status === 401) { return; }\n      refused(", "      if (answer.status === 401) { return; }\n      takeSpans(answer.body && answer.body.spans);\n      refused(", ["page", "browser"]),
    ("page: the Today row's range is muted on the selected fill", J, '.date-row[data-mark="today"] .span-range { color: var(--notes-ink); }', "", ["page"]),
]


def main() -> int:
    only = sys.argv[1:]
    for name in ("node", "page"):
        failing = run(name)
        if failing:
            print(f"BASE {name} is not green: {failing}")
            return 2
    print("base: the Node tests and the page tests are green before any break\n")
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
            print(f"SKIP  {what}: the text to break was found {text.count(find)} times", flush=True)
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
        print(f"{status} {what}  [{', '.join(suites)}]\n         {len(failing)} failed: {'; '.join(failing[:3])}{' ...' if len(failing) > 3 else ''}", flush=True)
    print(f"\n{ran - missed} of {ran} deliberate breaks were caught")
    return 1 if missed else 0


if __name__ == "__main__":
    sys.exit(main())
