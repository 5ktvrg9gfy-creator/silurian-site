"""Proves the controls on the Peels and Month's resize handle (23 October 2026) can
fail. Only these rules are broken, as asked; the rest of the journal is held by the
suites it already had.

Each case makes one deliberate break, runs the suite that should notice it (the
journal page tests, and for what only a browser can see the whole browser check),
records what went red, and puts the file back. Run from the repository root:

    python docs/evidence/journal/breakages-peels.py [words to pick cases]
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
    ("colours: the dark theme gets a darker yellow", J, "      --notes-peel-yellow: #fcf0b8;", "      --notes-peel-yellow: #d9cc92;", ["page"]),
    ("colours: the dark theme gets lighter Peel muted text", J, "      --notes-peel-muted: #66615f;", "      --notes-peel-muted: #9f9893;", ["page"]),
    ("colours: a Peel stops setting its own text colour", J, "    color: var(--notes-peel-ink);\n    --notes-ink: var(--notes-peel-ink);", "    --notes-ink: var(--notes-peel-ink);", ["page", "browser"]),
    ("colours: the pink Peel's buttons stay on the page ground", J, "    --notes-ground: var(--notes-peel-pink-field);\n", "", ["page", "browser"]),
    ("colours: Today is not a Peel", J, 'id="panel-today" data-panel="today" data-peel="yellow"', 'id="panel-today" data-panel="today"', ["page", "browser"]),
    ("colours: Quick notes becomes a Peel", J, 'id="panel-quick" data-panel="quick"', 'id="panel-quick" data-panel="quick" data-peel="pink"', ["page"]),
    ("colours: a Peel keeps the accent focus outline", J, "  .panel[data-peel] :focus-visible { outline-color: var(--notes-peel-focus); }\n", "", ["page", "browser"]),
    ("colours: muted stays muted on a hovered Peel row", J, "  .panel[data-peel] .entry:hover, .panel[data-peel] .moved-toggle:hover, .panel[data-peel] .pick-day:hover { --notes-muted: var(--notes-ink); }\n", "", ["page", "browser"]),
    ("colours: muted stays muted on a Peel that is a drop target", J, '  .panel[data-peel][data-drop="true"] { --notes-muted: var(--notes-ink); }\n', "", ["page"]),
    ("colours: the bin goes red on a Peel that is a drop target", J, '  .panel[data-peel][data-drop="true"] .entry-delete { color: var(--notes-icon); }\n', "", ["page"]),
    ("colours: a field on a Peel has the faint edge again", J, "  .panel[data-peel] .editor-line, .panel[data-peel] .empty, .panel[data-peel] .strip-group, .panel[data-peel] .date-pick { border-color: var(--notes-icon); }\n", "", ["page", "browser"]),
    ("handle: it shows below 1000px", J, "  .panel-handle { display: none; }\n\n  /* Three columns", "  .panel-handle { display: block; }\n\n  /* Three columns", ["page", "browser"]),
    ("handle: the maximum ignores the other two columns", J, "Math.min(Math.floor(available / 2), available - 2 * OTHER_MIN)", "Math.floor(available / 2)", ["page", "browser"]),
    ("handle: the minimum is 200px", J, "var MIN = 240;", "var MIN = 200;", ["page", "browser"]),
    ("handle: a drag stores the width while it moves", J, "setWidth(event.clientX - grab - frame.left - PAD - GAP / 2, false);", "setWidth(event.clientX - grab - frame.left - PAD - GAP / 2, true);", ["page", "browser"]),
    ("handle: a reset keeps the stored width", J, "if (width === null) { localStorage.removeItem(HANDLE_KEY); } else {", "if (width === null) { } else {", ["page", "browser"]),
    ("handle: trimming for a small window rewrites the stored width", J, 'panels.style.setProperty("--month-width", clamp(width) + "px");', 'width = clamp(width); keep(); panels.style.setProperty("--month-width", width + "px");', ["page", "browser"]),
    ("handle: Enter does not reset", J, 'event.key === "Enter") { reset(); }', 'event.key === "Never") { reset(); }', ["page", "browser"]),
    ("handle: a double click does not reset", J, 'handle.addEventListener("dblclick", reset);', "", ["page", "browser"]),
    ("handle: it has no name", J, 'aria-label="Resize Month" ', "", ["page"]),
    ("handle: the middle and right columns are not equal", J, ".panels[data-month-width] { grid-template-columns: var(--month-width) minmax(0, 1fr) minmax(0, 1fr); }", ".panels[data-month-width] { grid-template-columns: var(--month-width) minmax(0, 2fr) minmax(0, 1fr); }", ["page", "browser"]),
    ("handle: a finger gets 36px, not 44px", J, "    .panel-handle { width: 44px; }", "    .panel-handle { width: 36px; }", ["page", "browser"]),
    ("handle: the arrow keys do nothing", J, 'if (event.key === "ArrowRight") { setWidth(now + step, true); }', 'if (event.key === "Never") { setWidth(now + step, true); }', ["page", "browser"]),
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
