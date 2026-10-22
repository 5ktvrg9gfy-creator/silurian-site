"""Proves the journal's controls can fail.

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
NODE = ["node", "--test", "notes-tests/journal-core.test.js", "notes-tests/journal-api.test.js", "notes-tests/journal-stale.test.js", "notes-tests/site.test.js", "notes-tests/gate.test.js"]
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
    ("the rules: a move forgets to leave the arrow on the original", "journal/core.js", "        entry.state = op.how;\n", "        entry.state = entry.state;\n", ["node"]),
    ("the rules: an edit stops checking the revision", "journal/core.js", "if (!live || entry.rev !== op.rev ||", "if (!live ||", ["node"]),
    ("the rules: a move lands at the top of the target, not the bottom", "journal/core.js", "        target.push({ id: item.copyId,", "        target.unshift({ id: item.copyId,", ["node"]),
    ("the rules: a move of several is no longer all or nothing", "journal/core.js", "      if (entries.some((x) => !done(x) && (!x.entry || x.entry.rev !== x.item.rev || x.entry.state !== \"open\"))) {", "      if (false) {", ["node"]),
    ("the rules: Undo takes back a copy that has been ticked", "journal/core.js", "if (!copy || copy.rev !== 1 || copy.state !== \"open\") {", "if (!copy) {", ["node"]),
    ("the rules: the strip offers events and notes", "journal/core.js", "export const isOpenTask = (entry) => entry.type === \"task\" && entry.state === \"open\";", "export const isOpenTask = (entry) => entry.state === \"open\";", ["node"]),
    ("the rules: the strip stops at yesterday and misses Friday", "journal/core.js", "const dates = Object.keys(file.days).filter((d) => d < before).sort().reverse();", "const dates = Object.keys(file.days).filter((d) => d === core_yesterday(before)).sort().reverse();\n  function core_yesterday(d) { return addDays(d, -1); }", ["node"]),
    ("the rules: the rules read the clock", "journal/core.js", "const stale = () =>", "const nowStamp = () => Date.now();\nconst stale = () =>", ["node"]),
    ("the rules: a damaged month file reads as empty", "journal/core.js", "  if (!raw || typeof raw !== \"object\" || raw.v !== FILE_VERSION) return null;", "  if (!raw || typeof raw !== \"object\" || raw.v !== FILE_VERSION) return emptyMonth();", ["node"]),
    ("the API: Quick notes lose the gate", "api/_lib/journal-api.js", "    PUT: guarded(async (request) => {", "    PUT: (async (request) => {", ["node"]),
    ("the API: a 401 answer is no longer no-store", "api/_lib/journal-api.js", "  \"Cache-Control\": \"no-store\",", "  \"Cache-Control\": \"max-age=60\",", ["node"]),
    ("the API: reading writes", "api/_lib/journal-api.js", "        const { files } = await loadMonths(months);\n        return reply(200, { today,", "        const { files, tags } = await loadMonths(months);\n        await store.writeMonth(thisMonth, files[thisMonth], tags[thisMonth]);\n        return reply(200, { today,", ["node"]),
    ("the API: a write ignores the version it read", "api/_lib/journal-api.js", "await putMonth(month, files[month], tags[month])", "await putMonth(month, files[month], null)", ["node"]),
    ("the API: a refused move leaves its copies behind", "api/_lib/journal-api.js", "if (op.op === \"move\" && attempt > 0) await takeBackCopies(op);", "", ["node"]),
    ("the API: the quick notes version check is gone", "api/_lib/journal-api.js", "if (current.updatedAt !== base) return fail(409,", "if (false) return fail(409,", ["node"]),
    ("the API: a timer is added", "api/_lib/journal-api.js", "const MAX_TRIES = 6;", "const MAX_TRIES = 6;\nsetInterval(() => {}, 1000).unref();", ["node"]),
    ("the store: journal data is written under notes/", "api/_lib/journal-store.js", "const MONTH_PREFIX = \"journal/month/\";", "const MONTH_PREFIX = \"notes/month/\";", ["node"]),
    ("the store: a write stops using ifMatch", "api/_lib/journal-store.js", "{ ...options, allowOverwrite: true, ifMatch: tag }", "{ ...options, allowOverwrite: true }", ["node"]),
    ("the store: a read may come from the cache", "api/_lib/journal-store.js", "{ access: \"private\", useCache: false }", "{ access: \"private\" }", ["node"]),
    ("the site: vercel.json gains a cron", "vercel.json", "\"regions\": [\n    \"lhr1\"\n  ],", "\"regions\": [\n    \"lhr1\"\n  ],\n  \"crons\": [{ \"path\": \"/api/journal\", \"schedule\": \"0 0 * * *\" }],", ["node"]),
    ("the site: the journal stops being no-store", "vercel.json", "\"source\": \"/journal/(.*)\",\n      \"headers\": [\n        {\n          \"key\": \"X-Robots-Tag\",\n          \"value\": \"noindex, nofollow\"\n        },\n        {\n          \"key\": \"Cache-Control\",\n          \"value\": \"no-store\"", "\"source\": \"/journal/(.*)\",\n      \"headers\": [\n        {\n          \"key\": \"X-Robots-Tag\",\n          \"value\": \"noindex, nofollow\"\n        },\n        {\n          \"key\": \"Cache-Control\",\n          \"value\": \"max-age=60\"", ["node"]),
    ("the site: the region pin is dropped", "vercel.json", "  \"regions\": [\n    \"lhr1\"\n  ],\n", "", ["node"]),
    ("the allowlist: journal/ is taken off", "site-allowlist.txt", "journal/\n", "", ["allow"]),
    ("the page: a new colour variable", "journal/index.html", "    --notes-bad: #a52a1f;\n", "    --notes-bad: #a52a1f;\n    --notes-extra: #123456;\n", ["page"]),
    ("the page: a raw colour in a rule", "journal/index.html", "  .message { margin: 0 0 16px; font-weight: 600; color: var(--notes-bad); }", "  .message { margin: 0 0 16px; font-weight: 600; color: #a52a1f; }", ["page"]),
    ("the page: a theme value changes so a pair falls below 4.5:1", "journal/index.html", "    --notes-muted: #66615f;", "    --notes-muted: #8a8582;", ["page"]),
    ("the page: the Today row stops being a selected fill", "journal/index.html", "  .date-row[data-mark=\"today\"] { background: var(--notes-selected); }", "  .date-row[data-mark=\"today\"] { background: var(--notes-panel); }", ["page"]),
    ("the page: a panel reaches into another when it draws", "journal/index.html", "    $(\"date-tomorrow\").textContent = longDate(tomorrow());\n    renderList($(\"list-tomorrow\")", "    $(\"date-tomorrow\").textContent = longDate(tomorrow());\n    $(\"panel-today\").setAttribute(\"data-x\", \"1\");\n    renderList($(\"list-tomorrow\")", ["page"]),
    ("the page: muted on the Today row", "journal/index.html", ".date-row[data-mark=\"today\"] .date-open .wk { color: var(--notes-strong); }", ".date-row[data-mark=\"today\"] .date-open .wk { color: var(--notes-muted); }", ["page"]),
    ("the page: the Today row weekday is hovered muted on selected", "journal/index.html", "  .date-row[data-mark=\"today\"] { background: var(--notes-selected); }", "  .date-row[data-mark=\"today\"] { background: var(--notes-selected); color: var(--notes-muted); }", ["page"]),
    ("the page: a five column layout comes back at 1400px", "journal/index.html", "@media (min-width: 1000px) {", "@media (min-width: 1400px) {\n    .panels { grid-template-columns: repeat(5, 1fr); }\n  }\n  @media (min-width: 1000px) {", ["page"]),
    ("the page: Tomorrow moves above Today", "journal/index.html", "\"month today migrate\" \"month tomorrow quick\"", "\"month tomorrow migrate\" \"month today quick\"", ["page"]),
    ("the page: a 5px corner", "journal/index.html", "    border-radius: 8px;\n    background: var(--notes-panel);\n    overflow: hidden;", "    border-radius: 5px;\n    background: var(--notes-panel);\n    overflow: hidden;", ["page"]),
    ("the page: a shadow", "journal/index.html", "  .strip { margin: 8px; display: grid; gap: 8px; }", "  .strip { margin: 8px; display: grid; gap: 8px; box-shadow: 0 1px 2px var(--notes-line); }", ["page"]),
    ("the page: a 2px border", "journal/index.html", "    border: 1px solid var(--notes-line);\n    border-radius: 8px;\n    background: var(--notes-panel);\n    overflow: hidden;", "    border: 2px solid var(--notes-line);\n    border-radius: 8px;\n    background: var(--notes-panel);\n    overflow: hidden;", ["page"]),
    ("the page: the More button loses 44px for a finger", "journal/index.html", "    button.icon-button { width: 44px; }\n  }\n\n  button:focus-visible", "  }\n\n  button:focus-visible", ["page"]),
    ("the page: a bullet is 40px for a finger", "journal/index.html", ".bullet { width: 44px; height: 44px; }", ".bullet { width: 40px; height: 40px; }", ["page"]),
    ("the page: a twelfth icon", "journal/index.html", "  <symbol id=\"i-moon\"", "  <symbol id=\"j-extra\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M1 1h2\"/></symbol>\n  <symbol id=\"i-moon\"", ["page"]),
    ("the page: an icon not stroked in the current colour", "journal/index.html", "<symbol id=\"j-note\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\"", "<symbol id=\"j-note\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\"", ["page"]),
    ("the page: pagehide stops emptying the page", "journal/index.html", "  window.addEventListener(\"pagehide\", function () {\n    clearContent();", "  window.addEventListener(\"pagehide\", function () {\n    ", ["page"]),
    ("the page: sign out stops dropping the strip months", "journal/index.html", "    stripMonths = [];\n    pending = [];", "    pending = [];", ["page"]),
    ("the page: a timer brings tasks forward by itself", "journal/index.html", "  setInterval(function () {\n    if (!signedIn) { return; }", "  setInterval(function () {\n    if (signedIn && stripRemaining() > 0) { bringForward(core.stripFrom(stripFiles(), today).daily, core.stripFrom(stripFiles(), today).daily.tasks, core.dayList(today)); }\n    if (!signedIn) { return; }", ["page"]),
    ("the page: the page stores the entries on the device", "journal/index.html", "    pending.push({ op: op, hooks: hooks });", "    pending.push({ op: op, hooks: hooks });\n    try { localStorage.setItem(\"entries\", JSON.stringify(op)); } catch (e) { /* x */ }", ["page"]),
    ("the page: the page works out a revision itself", "journal/index.html", "    var op = { op: \"undo\", list: listKey, id: id, rev: now ? now.rev : 1 };", "    var op = { op: \"undo\", list: listKey, id: id, rev: (now ? now.rev : 0) + 1 };", ["page"]),
    ("the page: a service worker is registered", "journal/index.html", "  var TAB_KEY = \"silurian-journal-tab\";", "  var TAB_KEY = \"silurian-journal-tab\";\n  if (navigator.serviceWorker) { navigator.serviceWorker.register(\"/journal/sw.js\"); }", ["page"]),
    ("the page: an empty state is reworded", "journal/index.html", "No tasks waiting this month. Add one below, or choose Migrate on any entry to park it here.", "Nothing is waiting for this month.", ["page"]),
    ("the page: an em dash in a message", "journal/index.html", "\"Entry deleted.\"", "\"Entry deleted &mdash; done.\"", ["page"]),
    ("the page: a wrong theme colour in the title bar tag", "journal/index.html", "<meta name=\"theme-color\" content=\"#262422\" media=\"(prefers-color-scheme: dark)\">", "<meta name=\"theme-color\" content=\"#000000\" media=\"(prefers-color-scheme: dark)\">", ["page"]),
    ("the page: a Bring forward and Drop all", "journal/index.html", "      var all = make(\"button\", \"strip-foot\", \"Bring all forward\");", "      var all = make(\"button\", \"strip-foot\", \"Drop all\");", ["page"]),
    ("the lag: a read older than the page's copy replaces it", "journal/index.html", "      if (core.isNewer(confirmed[m], months[m])) { confirmed[m] = months[m]; }", "      confirmed[m] = months[m];", ["page"]),
    ("the lag: a look that began before a save is no longer dropped", "journal/index.html", "      if (gen !== generation || pending.length > 0 || sending || seq !== saveSeq) { return false; }\n      var others", "      if (gen !== generation || pending.length > 0 || sending) { return false; }\n      var others", ["page"]),
    ("the lag: a change no longer says which revision the page holds", "journal/index.html", "Object.assign({}, item.op, { known: known })", "item.op", ["page"]),
    ("the lag: a change that could not be sent is not sent again", "journal/index.html", "(answer.status === 0 || answer.status >= 500) && tries < RETRY_MS.length && gen === generation", "false", ["page"]),
    ("the lag: older quick notes replace newer", "journal/index.html", "    if (!core.laterStamp(fresh.updatedAt, quick.base)) { return; }", "    if (fresh.updatedAt === quick.base) { return; }", ["page"]),
    ("the lag: a repeat of a move makes a second copy", "journal/core.js", "        entry && entry.state === op.how && entry.to === op.to && entry.toId === item.copyId && entry.rev === item.rev + 1;", "        false;", ["node"]),
    ("the lag: a repeat of an edit is a clash", "journal/core.js", "((op.op === \"edit\" && entry.text === cleanText(op.text)) ||", "((false) ||", ["node"]),
    ("the lag: the API applies a change on a file older than the page's", "api/_lib/journal-api.js", "      const behind = months.some((month) => files[month].rev < known[month]);", "      const behind = false;", ["node"]),
    ("the lag: the API gives up at once instead of waiting", "api/_lib/journal-api.js", "      if (attempt >= WAITS_MS.length) return fail(503, MESSAGES.busy);\n      await sleep(WAITS_MS[attempt]);", "      return fail(503, MESSAGES.busy);", ["node"]),
    ("the lag: the API forgets what it wrote", "api/_lib/journal-api.js", "    if (typeof written === \"string\") recent.set(month,", "    if (false) recent.set(month,", ["node"]),
    ("the lag: the API keeps what it wrote after the store has newer", "api/_lib/journal-api.js", "if (now() - kept.at > RECENT_MS || kept.file.rev <= file.rev) recent.delete(month);", "if (now() - kept.at > RECENT_MS) recent.delete(month);", ["node"]),
    ("the lag: quick notes wait for nothing", "api/_lib/journal-api.js", "        const behind = laterStamp(base, current.updatedAt);", "        const behind = false;", ["node"]),
    ("the moved line: moved entries show in the list again", "journal/index.html", "    var entries = all.filter(function (e) { return !isMoved(e); });", "    var entries = all;", ["page"]),
    ("the moved line: it opens by itself", "journal/index.html", "    var open = moved.length > 0 && ui.movedOpen[listKey] === true;", "    var open = moved.length > 0 && ui.movedOpen[listKey] !== false;", ["page"]),
    ("the moved line: it shows with nothing moved", "journal/index.html", "    host.hidden = moved.length === 0;", "    host.hidden = false;", ["page"]),
    ("the moved line: the count is worded differently", "journal/index.html", "    toggle.textContent = moved.length + \" moved\";", "    toggle.textContent = \"Moved: \" + moved.length;", ["page"]),
    ("the manifest: the start address leaves the scope", "journal/manifest.webmanifest", "\"start_url\": \"/journal/\"", "\"start_url\": \"/journal\"", ["node", "page"]),
    ("the notes page: the Journal item goes", "notes/index.html", "<a class=\"menu-item\" href=\"/journal/\" id=\"menu-journal\">", "<a class=\"menu-item\" href=\"/journal/\" id=\"menu-jrnl\">", ["notes"]),
]

SUITES = {
    "node": (NODE, ROOT),
    "page": (PY, ROOT / "forecast-app"),
    "allow": (PY_ALLOW, ROOT / "forecast-app"),
    "notes": (PY_NOTES, ROOT / "forecast-app"),
}


def main() -> int:
    only = sys.argv[1:]
    # A clean base first: every suite passes before anything is broken.
    for name in ("node", "page", "allow", "notes"):
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
