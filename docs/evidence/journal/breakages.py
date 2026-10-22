"""Proves the controls on the journal's storage rules can fail.

This is the round after the Preview retest of 22 October 2026, which changed the
storage from one file per month to one file per entry revision, so this file holds
the breaks for that design only. The earlier cases for the rest of the journal are
in the git history of this file (commit 3e5d4fc) and were not run again.

Each case makes one deliberate break in a journal file, runs the fast suites that
should notice it (the Node tests and the journal page tests), records which
tests failed, and puts the file back. A control that has never been seen to fail
has not been proved. Run from the repository root:

    python docs/evidence/journal/breakages.py

The files are restored from their bytes before the next case and again at the
end, and `git diff --stat` after a run shows nothing changed.
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
NODE = ["node", "--test", "notes-tests/journal-core.test.js", "notes-tests/journal-api.test.js", "notes-tests/journal-stale.test.js", "notes-tests/blob-auth.test.js"]
PY = [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_journal_page.py"]
PY_ALLOW = [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_marketing_deploy_allowlist.py"]
PY_NOTES = [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_notes_page.py"]


def run(command: list[str], cwd: Path) -> list[str]:
    try:
        result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=240)
    except subprocess.TimeoutExpired:
        # A break that leaves something running keeps the suite from ending, which is also a failure.
        return ["the suite did not finish"]
    output = result.stdout + result.stderr
    if cwd.name == "forecast-app":
        return re.findall(r"^(?:FAIL|ERROR): (\w+)", output, re.MULTILINE)
    return re.findall(r"^not ok \d+ - (.+)$", output, re.MULTILINE)


# (what is broken, file, text to find, text to put there, which suites)
CASES = [
    # the rules of a stored entry
    ("rules: an add starts by reading the entry it is about to make", "journal/core.js", "    case \"edit\": case \"state\": case \"remove\": case \"undo\":\n      return [{ list: op.list, id: op.id, rev: op.rev }];", "    case \"add\": case \"edit\": case \"state\": case \"remove\": case \"undo\":\n      return [{ list: op.list, id: op.id || op.entry.id, rev: op.rev || 1 }];", ["node"]),
    ("rules: a copy's id ignores the revision it was copied at", "journal/core.js", "  const input = `${id}|${rev}|${to}`;", "  const input = `${id}|${to}`;", ["node"]),
    ("rules: a copy's id is chosen at random each time", "journal/core.js", "  const input = `${id}|${rev}|${to}`;", "  const input = `${id}|${rev}|${to}|${Math.random()}`;", ["node"]),
    ("rules: a removal deletes the entry instead of making a removed revision", "journal/core.js", "        entry.state = \"removed\";\n        entry.rev += 1;\n      }\n      dropEmptyDays(files[month]);", "        list.splice(list.indexOf(entry), 1);\n      }\n      dropEmptyDays(files[month]);", ["node"]),
    ("rules: a change writes every entry of the view, not only what changed", "journal/core.js", "(list, e) => { if (!was.has(e.id) || e.rev > was.get(e.id)) entries.push(", "(list, e) => { if (true) entries.push(", ["node"]),
    ("rules: a day with a line revision is dropped when it holds nothing else", "journal/core.js", "if (day.entries.length === 0 && day.line === \"\" && day.lineRev === 0) delete file.days[date];", "if (day.entries.length === 0 && day.line === \"\") delete file.days[date];", ["node"]),
    ("rules: a view shows the lowest revision of an entry", "journal/core.js", "    if (!held || record.entry.rev > held.entry.rev) best.set(record.entry.id, record);", "    if (!held || record.entry.rev < held.entry.rev) best.set(record.entry.id, record);", ["node"]),
    ("rules: a repeat of a move is not recognised, so it copies again", "journal/core.js", "        entry && entry.state === op.how && entry.to === op.to && entry.toId === copyId && entry.rev === item.rev + 1;", "        false;", ["node"]),
    ("rules: an undo refuses a copy that an earlier try already removed", "journal/core.js", "        if (!copy || (!isGone(copy) && (copy.rev !== 1 || copy.state !== \"open\"))) {", "        if (!copy || copy.rev !== 1 || copy.state !== \"open\") {", ["node"]),
    # putting a read together with what is held
    ("merge: an entry the other view lacks is dropped", "journal/core.js", "      if (!held) mine.push(JSON.parse(JSON.stringify(e)));", "      if (!held) { /* dropped */ }", ["node"]),
    ("merge: a lower revision replaces a higher one", "journal/core.js", "      else if (e.rev > held.rev) mine[mine.indexOf(held)]", "      else if (e.rev !== held.rev) mine[mine.indexOf(held)]", ["node"]),
    ("merge: the page replaces its copy with the read", "journal/index.html", "      confirmed[m] = core.mergeMonth(confirmed[m], months[m]);", "      confirmed[m] = months[m];", ["page"]),
    # the API
    ("API: the copy is made after the original, not before", "api/_lib/journal-api.js", "Number(a.list === primary) - Number(b.list === primary)", "Number(b.list === primary) - Number(a.list === primary)", ["node"]),
    ("API: a refused move leaves its copy behind", "api/_lib/journal-api.js", "if (op.op === \"move\") await takeBackCopies(madeCopies, files);", "", ["node"]),
    ("API: a change reads the whole month first", "api/_lib/journal-api.js", "    const { records, lines } = await startingPoint(op);\n    const primary", "    await loadMonths(months);\n    const { records, lines } = await startingPoint(op);\n    const primary", ["node"]),
    ("API: a create that is refused is taken as made", "api/_lib/journal-api.js", "        const made = await store.createEntry(w.list, w.entry);", "        const made = (await store.createEntry(w.list, w.entry)) || true;", ["node"]),
    ("API: a change waits for the store", "api/_lib/journal-api.js", "      const files = viewFrom(months, records, lines);\n      const before = clone(files);", "      await sleep(100);\n      const files = viewFrom(months, records, lines);\n      const before = clone(files);", ["node"]),
    ("API: the entry a change starts from is found through a listing", "api/_lib/journal-api.js", "      const found = await store.readEntry(need.list, need.id, need.rev);\n      if (found) records.push(found);", "      const listed = await store.entriesOfMonth(parseList(need.list).month);\n      const found = listed.find((r) => r.entry.id === need.id);\n      if (found) records.push(found);", ["node"]),
    ("API: an undo reads only the copy's first revision", "api/_lib/journal-api.js", "        for (; rev <= MAX_PROBE; rev += 1) {", "        for (; rev <= 1; rev += 1) {", ["node"]),
    # the store
    ("store: an entry file may be overwritten", "api/_lib/journal-store.js", "allowOverwrite: false, contentType: JSON_TYPE });\n      kept.set(path, value);", "allowOverwrite: true, contentType: JSON_TYPE });\n      kept.set(path, value);", ["node"]),
    ("store: a read may come from the cache", "api/_lib/journal-store.js", "{ access: \"private\", useCache: false }", "{ access: \"private\" }", ["node"]),
    ("store: a file that cannot change is read again every time", "api/_lib/journal-store.js", "    if (kept.has(path)) return kept.get(path);\n", "", ["node"]),
    ("store: a listing reads the lowest revision of an entry", "api/_lib/journal-store.js", "const match = /^([0-9a-f]{32})\\.(\\d+)\\.json$/.exec(name);\n        if (!match) continue;\n        const rev = Number(match[2]);\n        if (!latest.has(match[1]) || rev > latest.get(match[1])) latest.set(match[1], rev);", "const match = /^([0-9a-f]{32})\\.(\\d+)\\.json$/.exec(name);\n        if (!match) continue;\n        const rev = Number(match[2]);\n        if (!latest.has(match[1]) || rev < latest.get(match[1])) latest.set(match[1], rev);", ["node"]),
    ("store: journal entries are made under notes/", "api/_lib/journal-store.js", "const ENTRY_PREFIX = \"journal/e/\";", "const ENTRY_PREFIX = \"notes/e/\";", ["node"]),
    ("store: a damaged file reads as if it were not there", "api/_lib/journal-store.js", "    if (!value) throw new Error(\"journal file unreadable\");", "    if (!value) return null;", ["node"]),
    ("store: a month is taken from the wrong place in the path", "api/_lib/journal-store.js", "const entryPath = (list, id, rev) => `${ENTRY_PREFIX}${parseList(list).month}/${id}.${rev}.json`;", "const entryPath = (list, id, rev) => `${ENTRY_PREFIX}all/${id}.${rev}.json`;", ["node"]),
    # the page's parts of the new design
    ("page: the page chooses a copy id again", "journal/index.html", "    var op = { op: \"move\", from: listKey, to: target, how: how, items: [{ id: id, rev: entry.rev }] };", "    var op = { op: \"move\", from: listKey, to: target, how: how, items: [{ id: id, rev: entry.rev, copyId: newId() }] };", ["page"]),
    ("page: Undo of a delete makes the entry again under its old id", "journal/index.html", "entry: { id: newId(), type: removed.type, text: removed.text, state: removed.state }", "entry: { id: removed.id, type: removed.type, text: removed.text, state: removed.state }", ["page"]),
    ("page: a move to a day no longer offers Open day", "journal/index.html", "offerUndo(\"Moved to \" + words + \".\", [undoOp(listKey, id, target)], open);", "offerUndo(\"Moved to \" + words + \".\", [undoOp(listKey, id, target)], null);", ["page"]),
    ("page: a change no longer says when an entry was made", "journal/index.html", "if ((op.op === \"add\" || op.op === \"move\") && op.at === undefined) { op.at = Date.now(); }", "", ["page"]),
]

SUITES = {
    "node": (NODE, ROOT),
    "page": (PY, ROOT / "forecast-app"),
}


def main() -> int:
    only = sys.argv[1:]
    # A clean base first: every suite passes before anything is broken.
    for name in ("node", "page"):
        command, cwd = SUITES[name]
        failing = run(command, cwd)
        if failing:
            print(f"BASE {name} is not green: {failing}")
            return 2
    print("base: every suite is green before any break\n")
    missed = 0
    for what, file, find, replace, suites in CASES:
        if only and not any(word in what for word in only):
            continue
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
                command, cwd = SUITES[name]
                failing += run(command, cwd)
        finally:
            path.write_bytes(original)
        status = "CAUGHT" if failing else "MISSED"
        if not failing:
            missed += 1
        print(f"{status} {what}\n         {len(failing)} failed: {'; '.join(failing[:3])}{' ...' if len(failing) > 3 else ''}")
    ran = len([c for c in CASES if not only or any(word in c[0] for word in only)])
    print(f"\n{ran - missed} of {ran} deliberate breaks were caught")
    return 1 if missed else 0


if __name__ == "__main__":
    sys.exit(main())
