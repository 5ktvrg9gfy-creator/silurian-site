"""Proves the browser check can fail, for the three promises a unit test cannot see.

Each case breaks one journal file, runs docs/evidence/journal/browser-check-journal.mjs,
lists the checks that went red, and puts the file back. Run from the repository root:

    python docs/evidence/journal/breakages-browser.py
"""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CASES = [
    ("sign out keeps the month files in memory", "journal/index.html", "    confirmed = {};\n    stripMonths = [];", "    stripMonths = [];"),
    ("a timer brings the strip forward by itself", "journal/index.html", "  setInterval(function () {\n    if (!signedIn) { return; }", "  setInterval(function () {\n    if (signedIn && stripRemaining() > 0) { var g = core.stripFrom(stripFiles(), today).daily; if (g) { bringForward(g, g.tasks, core.dayList(today)); } }\n    if (!signedIn) { return; }"),
    ("a clash is accepted: the edit check is gone from the rules", "journal/core.js", "if (!live || entry.rev !== op.rev ||", "if (!live ||"),
    ("a refused change leaves the optimistic change on screen", "journal/index.html", "  function refused(kind, dropped) {\n    pending.length = 0;\n    recompute();", "  function refused(kind, dropped) {\n    pending.length = 0;"),
]
import sys
only = sys.argv[1:]
for what, file, find, replace in CASES:
    if only and not any(word in what for word in only):
        continue
    path = ROOT / file
    original = path.read_bytes()
    text = original.decode("utf-8")
    assert text.count(find) == 1, what
    try:
        path.write_text(text.replace(find, replace), encoding="utf-8")
        out = subprocess.run(["node", "docs/evidence/journal/browser-check-journal.mjs"], cwd=ROOT, capture_output=True, text=True, timeout=400)
    finally:
        path.write_bytes(original)
    red = re.findall(r"^FAIL (.+)$", out.stdout, re.MULTILINE)
    # Any red check, or a run that stopped early (a wait that never ended), is caught.
    crashed = out.returncode != 0 and not red
    print(("CAUGHT " if red or crashed else "MISSED ") + what)
    for line in red[:4]:
        print("         " + line[:170])
    if crashed:
        print("         the run stopped early:", out.stderr.strip().splitlines()[-1][:150] if out.stderr.strip() else "")
