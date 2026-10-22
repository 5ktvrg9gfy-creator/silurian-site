"""Proves the controls on notes save safety can fail.

Each case makes one deliberate break in a file that carries a new storage rule (the
revision files, the version check, the tidying, the labels, the page's merge), runs
the suites that should notice it, records which tests failed, and puts the file
back. A control that has never been seen to fail has not been proved. Only the new
storage rules are broken here, as asked; the rest of notes is held by the suites it
already had. Run from the repository root:

    python docs/evidence/notes-page/breakages-revisions.py [words to pick cases]

The files are restored from their bytes before the next case and again at the end.
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
NODE = ["node", "--test", "notes-tests/revisions.test.js", "notes-tests/blob-store.test.js", "notes-tests/speed.test.js",
        "notes-tests/v4.test.js", "notes-tests/blob-auth.test.js", "notes-tests/conflict.test.js", "notes-tests/roundtrip.test.js", "notes-tests/v2.test.js"]
PAGE = [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_notes_page.py", "-k", "NeverDraws"]
BROWSER = ["node", "docs/evidence/notes-page/browser-check-revisions.mjs"]


def run(name: str) -> list[str]:
    command, cwd = {"node": (NODE, ROOT), "page": (PAGE, ROOT / "forecast-app"), "browser": (BROWSER, ROOT)}[name]
    try:
        result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        return ["the run did not finish"]
    out = result.stdout + result.stderr
    if name == "page":
        return re.findall(r"^(?:FAIL|ERROR): (\w+)", out, re.MULTILINE)
    if name == "browser":
        red = re.findall(r"^FAIL (.+)$", out, re.MULTILINE)
        return red or (["the run stopped early"] if result.returncode != 0 else [])
    return re.findall(r"^not ok \d+ - (.+)$", out, re.MULTILINE)


S = "api/_lib/store.js"
A = "api/_lib/notes-api.js"
P = "notes/index.html"
CASES = [
    ("store: the next revision of a note may overwrite one that exists", S, 'await sdk.put(path, body, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType });', 'await sdk.put(path, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType });', ["node"]),
    ("store: a text file may be overwritten", S, '{ access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: TEXT_TYPE }', '{ access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: TEXT_TYPE }', ["node"]),
    ("store: a version newer than the listing shows is not looked for", S, "    if (atLeast !== null && (!found || found.updatedAt < atLeast)) {\n      for (let next = Math.max(rev, 0) + 1, steps = 0; steps < MAX_PROBE; next += 1, steps += 1) {\n        const there = await readRevision(id, next);", "    if (false) {\n      for (let next = Math.max(rev, 0) + 1, steps = 0; steps < MAX_PROBE; next += 1, steps += 1) {\n        const there = await readRevision(id, next);", ["node"]),
    ("store: the same save sent again is not recognised", S, "if (record && !record.deleted && record.from === base && record.fp === fp) return record;", "if (false) return record;", ["node"]),
    ("store: a note made before revisions is not read", S, "else if ((match = LEGACY_META.exec(name))) of(match[1]).revs.set(0, blob);", "else if ((match = LEGACY_META.exec(name))) { /* ignored */ }", ["node"]),
    ("store: a revision is deleted the moment it is superseded", S, "const settled = revs.filter((r) => ageOf(entry.revs.get(r), t) > SUPERSEDED_MS);", "const settled = revs.filter((r) => ageOf(entry.revs.get(r), t) > -1);", ["node"]),
    ("store: the newest revision is deleted with the rest", S, "const paths = revs.filter((r) => r < floor).map((r) => entry.revs.get(r).pathname);", "const paths = revs.filter((r) => r <= floor).map((r) => entry.revs.get(r).pathname);", ["node"]),
    ("store: the text the newest revision uses is not counted as used", S, "      if (!record.deleted) used.add(record.text);", "", ["node"]),
    ("store: a text file left by a lost save goes at once", S, "if (new Date(blob.uploadedAt).getTime() <= settledAt || ageOf(blob, t) > ORPHAN_MS) paths.push(blob.pathname);", "paths.push(blob.pathname);", ["node"]),
    ("store: a removed note is not reported as gone", S, "if (item.deleted) { gone.push(id); return null; }", "if (item.deleted) { return null; }", ["node"]),
    ("store: the index trusts a tag that does not change with the revision", S, "const tag = rev >= 0 ? `r${rev}` : `t:${text.etag || text.uploadedAt}`;", "const tag = rev >= 0 ? \"r0\" : `t:${text.etag || text.uploadedAt}`;", ["node"]),
    ("store: the label list is changed from any version", S, "      if (version !== base) return { ok: false };", "      if (false) return { ok: false };", ["node"]),
    ("store: the same label change sent again is not recognised", S, "if (record && record.from === base && record.fp === fp) return { labels: record.labels, updatedAt: record.updatedAt, created: record.created };", "if (false) return null;", ["node"]),
    ("api: a save does not say which version it started from when it looks for the note", A, "const current = await store.meta(id, base);\n        if (current === null) return fail(409, MESSAGES.deletedElsewhere);", "const current = await store.meta(id);\n        if (current === null) return fail(409, MESSAGES.deletedElsewhere);", ["node"]),
    ("api: a save sent again after its answer was lost is a clash", A, "const done = await store.repeat(id, base, textPrint(body.bytes));", "const done = null;", ["node"]),
    ("api: a label change is made whatever the store says", A, "    if (!saved.ok) {\n      const again = await store.labelsRepeat(base, print);", "    if (false) {\n      const again = await store.labelsRepeat(base, print);", ["node"]),
    ("api: a text save is said to be made whatever the store says", A, "        const saved = await save(id, body, current.updatedAt, current);\n        if (!saved.ok) {", "        const saved = await save(id, body, current.updatedAt, current);\n        if (false) {", ["node"]),
    ("store: a refused create of a revision is taken as made", S, "const made = await createOnly(metaPath(id, rev), JSON.stringify(file), META_TYPE);\n    if (made) {", "const made = true;\n    if (made) {", ["node"]),
    ("page: the list from the server replaces the rows held", P, "mem.all = mergeList(mem.all, data.notes, data.gone);", "mem.all = data.notes;", ["page", "browser"]),
    ("page: an older copy of the open note replaces the newer", P, "if (loaded.version <= note.version) { return; }", "if (loaded.version === note.version) { return; }", ["page"]),
    ("page: a note this page deleted is brought back by an older list", P, "    mem.gone[id] = true;\n", "", ["page", "browser"]),
    ("page: an older row replaces a newer one in memory", P, "    if (held && held.updatedAt > item.updatedAt) { return; }   // never an older copy over a newer one\n", "", ["page"]),
]


def main() -> int:
    only = sys.argv[1:]
    for name in ("node", "page", "browser"):
        failing = run(name)
        if failing:
            print(f"BASE {name} is not green: {failing}")
            return 2
    print("base: every suite is green before any break\n")
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
        print(f"{status} {what}\n         {len(failing)} failed: {'; '.join(failing[:3])}{' ...' if len(failing) > 3 else ''}")
    print(f"\n{ran - missed} of {ran} deliberate breaks were caught")
    return 1 if missed else 0


if __name__ == "__main__":
    sys.exit(main())
