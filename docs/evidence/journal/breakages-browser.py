"""Proves the browser run for the new storage can fail.

This is the round after the Preview retest of 22 October 2026 (one file per entry
revision), so it holds only the breaks for that storage. The earlier cases, for sign
out, the strip timer and the clash message, are in the git history of this file
(commit 3e5d4fc) and were not run again.

Each case breaks one journal file, runs docs/evidence/journal/browser-check-journal-lag.mjs
(about three minutes each, in real time), lists the checks that went red, and puts
the file back. Run from the repository root:

    python docs/evidence/journal/breakages-browser.py
"""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CASES = [
    ("the page replaces its copy with every read, so a read that lacks or predates a save wins", "journal/index.html", "      confirmed[m] = core.mergeMonth(confirmed[m], months[m]);", "      confirmed[m] = months[m];"),
    ("the API finds the entry a change starts from through a listing, which lags 60 seconds", "api/_lib/journal-api.js", "      const found = await store.readEntry(need.list, need.id, need.rev);\n      if (found) records.push(found);", "      const listed = await store.entriesOfMonth(parseList(need.list).month);\n      const found = listed.find((r) => r.entry.id === need.id);\n      if (found) records.push(found);"),
    ("a repeat of a move is not recognised, so it copies again", "journal/core.js", "        entry && entry.state === op.how && entry.to === op.to && entry.toId === copyId && entry.rev === item.rev + 1;", "        false;"),
    ("a move to a day no longer offers Open day", "journal/index.html", "offerUndo(\"Moved to \" + words + \".\", [undoOp(listKey, id, target)], open);", "offerUndo(\"Moved to \" + words + \".\", [undoOp(listKey, id, target)], null);"),
]
import sys
only = sys.argv[1:]
for case in CASES:
    what, file, find, replace = case[:4]
    script = "docs/evidence/journal/browser-check-journal-lag.mjs"
    if only and not any(word in what for word in only):
        continue
    path = ROOT / file
    original = path.read_bytes()
    text = original.decode("utf-8")
    assert text.count(find) == 1, what
    try:
        path.write_text(text.replace(find, replace), encoding="utf-8")
        out = subprocess.run(["node", script], cwd=ROOT, capture_output=True, text=True, timeout=400)
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
