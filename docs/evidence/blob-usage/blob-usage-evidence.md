# Blob usage, evidence

Branch `blob-usage`, 25 October 2026. Not merged.

## Why

The Vercel Hobby team was paused on 24 October 2026 for Blob Advanced Operations: 3.3K used against a 2K monthly limit. Simple Operations were 4.5K of 10K. The product owner is moving to Pro. This branch brings the usage down so it does not approach a limit again.

## What counts as what

Vercel's Blob usage and pricing page, as read from a search summary on 25 October 2026 because the page itself could not be fetched from the build sandbox (`getaddrinfo ENOTFOUND vercel.com`): "Simple Operations: Counts when a blob is accessed by its URL and it's a cache MISS, or when you retrieve blob metadata without downloading the blob." and "Advanced Operations: Counts when you upload, copy, or list blobs, and when you create a Blob store." Cache hits do not count. The page does not name delete; it is counted on its own line and never folded into either figure. Hobby includes 2,000 advanced and 10,000 simple operations a month. The wording should be checked against the live page (see Q2 and Q3 in `docs/blob-usage-open-questions.md`).

So here: **advanced = put + copy + list. Simple = get + head**, with every get counted as a cache miss, which is the most it can be because the adapters read with `useCache: false`.

## How it was measured

`notes-tests/counting-sdk.js` wraps the in-memory Blob stand-in and counts every call. `docs/evidence/blob-usage/measure.mjs` serves the real pages and the real route code over it and drives Chromium (Playwright's clock moves time, so an idle hour takes seconds). Seeded data: a journal with 23 days of October, 30 days of September, migrate lists and two spans; forty notes, five labels, three notes with five revisions each. **Cold** means every request is answered by a function that remembers nothing it read or wrote, the most an action can cost. **Warm** means one instance answers everything and keeps what it read, the least. A real deployment sits between. Cold is what the budget holds.

The "before" figures were taken from the untouched code (commit `d564fb0`, a worktree of it) with the final script. One mistake in the first draft of the script is kept on the record: it moved the page clock with the machine's real date, which jumped it three days and made the first "after" figures for list and label requests look worse than they were. It was found because the archive step still asked for the list, and fixed before any figure below was taken.

Run: `LABEL=after node docs/evidence/blob-usage/measure.mjs --check` (cold, holds the figures to `notes-tests/blob-budget.json` and exits 1 if one is over or one was not measured at all) and with `--warm`. Results are in `usage-before-cold.md`, `usage-before-warm.md`, `usage-after-cold.md` and `usage-after-warm.md`, with the JSON beside them.

## Before and after, per idle hour (cold instances)

| One hour, window open and idle | Before advanced | Before simple | After advanced | After simple |
|---|---:|---:|---:|---:|
| Journal, focused | 320 | 6,880 | 0 | 0 |
| Journal, visible but not focused | 320 | 6,880 | 0 | 0 |
| Journal, hidden | 0 | 0 | 0 | 0 |
| Notes list | 0 | 0 | 0 | 0 |
| A note being edited | 0 | 0 | 0 | 0 |

The journal asked every 45 seconds while visible (80 asks an hour), each ask listing four prefixes and reading about 86 files. That alone was most of the 3.3K: ten hours of one open window is 3,200 advanced operations. Notes never polled.

## Before and after, per action (cold instances)

| Action | Before adv | Before simple | After adv | After simple |
|---|---:|---:|---:|---:|
| Journal: open | 4 | 86 | 4 | 86 |
| Journal: add an entry | 1 | 0 | 1 | 0 |
| Journal: move an entry | 2 | 1 | 2 | 1 |
| Journal: edit an entry and tick another | 2 | 2 | 2 | 2 |
| Journal: type a calendar line | 1 | 0 | 1 | 0 |
| Journal: make a span | 2 | 1 | 2 | 1 |
| Journal: return to the window after 6 minutes | 36 | 810 | 3 | 90 |
| Journal: return again after 1 minute | 8 | 180 | 0 | 0 |
| Journal: Quick notes, one minute of typing | 25 | 197 | 2 | 2 |
| Notes: open the list | 2 | 2 | 2 | 2 |
| Notes: open a note | 2 | 3 | 1 | 2 |
| Notes: type for one minute | 36 | 78 | 4 | 2 |
| Notes: label the open note | 3 | 14 | 2 | 2 |
| Notes: archive the open note | 7 | 47 | 2 | 2 |
| Notes: search | 1 | 55 | 1 | 46 |
| Notes: revision cleanup, one list after eight settled revisions | 2 | 2 | 1 | 3 |

The return rows before the change include the polling that ran while the clock moved on, which is what a window left open does. Revision cleanup is done by a list that is already being made (`del` is 1 call for the eight revisions), so it adds no listing of its own.

## A typical day, one user on two devices

The mix is stated so it can be argued with: five journal opens, four returns to a window left open for over five minutes, eight entries added, two moves, three edits or ticks, one calendar line, one minute of Quick notes, two visits to the notes list, three notes opened, two minutes of typing in notes, one label, one archive, one search. Idle open windows are not in it.

| | Advanced | Simple (cold) | Simple (warm) |
|---|---:|---:|---:|
| Before | 301 | 4,160 | 111 |
| After | **73** | 864 | 57 |

Plus the idle hour figure for every hour a window is left open: before, 320 advanced for each journal hour. After, none.

73 a day is about 2,200 a month, which is over the Hobby 2,000 and is why the team is on Pro. At the Pro rates the product owner supplied (five dollars a million advanced, forty cents a million simple) a month of this is about a cent.

## Decision: the under-20 target is withdrawn (product owner, 25 October 2026)

The brief set a target of under 20 advanced operations for a typical day. After the cuts the day is 73, and **the product owner has accepted 73 on the Pro plan and withdrawn the target.** Why it cannot be reached without a different storage design:

- **Writes set a floor of about 22.** Every change is a new immutable file, because Vercel documents that an overwritten blob can be served stale for up to 60 seconds, and an overwrite is how two devices lose each other's work. An add is one put. An edit is one put. A move is two puts (the copy, then the original's next revision with its arrow). A tick, a calendar line and a span are one each. Eight adds, two moves, three edits and a line is 22 puts before anything is read.
- **Opening the journal costs 4 lists and cannot be made cheaper without a snapshot.** The four are this month's entries, this month's calendar lines, the spans, and the months that have files (for the morning strip). They are four different prefixes, and one listing cannot span them. A cached copy on the device is ruled out by the rule that the page keeps nothing but the theme, the tab and Month's width. A summary file written by the server would be an overwritten file, which is the thing the immutable design exists to avoid, and each write would cost a put of its own.
- **A return costs 3**, after the months list was dropped from it. Five opens (20) and four returns (12) are 32 before any write.
- Notes adds little: a list is 2 (the notes and the labels), a save is 2 puts, a label change is 2.

What would lower the floor, not done because each is a design change, not a trim: a month snapshot or a small database (Vercel KV or Edge Config) for the journal's current view, written when a change is made. That trades the immutable files' safety for fewer reads, and costs a put or a write per change. Recommended: not now. Revisit if the monthly figure on Pro ever matters.

## What changed

- **Journal.** The 45 second poll is gone. The page asks again when a window is shown or focused, only if it is visible and five minutes have passed since it last asked (or the date has changed), never while hidden. A return asks for `view=home&light=1`: this month's files and the spans, without the listing of months that have files, and the earlier months the strip read at open are not asked for again. Quick notes save after a five second pause, thirty seconds at most from the first unsaved key, and on blur or when the window is hidden.
- **Notes.** Autosave waits for a five second pause, thirty seconds at most, and saves when the window is hidden or the note is left. The page keeps the revision number the server gave for each note and sends it back (`X-Base-Rev`), so a save, a label change and an archive go straight to that revision (one read, then the create of the next) instead of listing the note's files first. It is a starting point only: the create of the next revision is still the version check, and a hint that names a revision that is not there is ignored. The notes index is rewritten only when it names a note that has gone, is empty, or is eight or more notes behind (one note behind costs one small read at the next list instead of an advanced operation). Coming back to the list inside five minutes draws what the page holds and asks nothing; the label names are cached the same way; the list is no longer asked for again after the page's own archive or label change, because the page already holds the new state.
- **Kept, unchanged:** every version check, no overwrite, higher revision wins, no stale data drawn over newer, sign out rules, the stale-store tests.

## Tests

- `notes-tests/blob-budget.test.js` and `blob-budget.json`: every common action over the real route code and Blob adapters and the counting stand-in, cold, set at exactly the measured figures with no slack. Fails if any goes over. It also proves a revision hint cannot let a save skip or overwrite a newer revision.
- `forecast-app/tests/test_blob_usage.py`: ten tests on the pages. No timer asks the server; the one interval is the date check and does nothing while hidden; a return asks at most once in five minutes and not while hidden; every place that asks again is counted; a return lists less than an open and does not replace the strip's months; both autosaves are five seconds with a thirty second cap; the revision goes back with each change and is forgotten on sign out; the list and labels are not asked for again inside five minutes; a search always asks.
- `docs/evidence/blob-usage/measure.mjs --check` holds the same file in a browser, including the idle hours at zero. Run by hand, not part of either suite.

## Breakage proofs (new rules only)

Each was applied in turn, the named test run, and the file restored. All twelve were caught: polling brought back in the journal; a return that ignores hidden; a return that ignores the five minutes; a return that lists every month again (page and API); notes autosave back to one second; Quick notes autosave back to one second; the notes page not sending the revision; the server ignoring the hint; the index rewritten after every change; the notes list asked for again every time; the labels asked for on every note open.

## Existing tests changed, and why

- Node: the stand-in result of `store.write` now carries `rev` (two exact-shape assertions); one revisions test now says the index is left one note behind (`r1`), and one speed test says one note behind writes nothing, with a new test that eight behind rewrites it once. No safety assertion was touched.
- Python: `test_nothing_is_moved_migrated_or_dropped_by_a_timer_or_by_loading` expects five timers, not six (the polling interval went); the sign out memory test no longer names the removed poll timer.
- Browser checks: the notes checks waited a second for an autosave and now wait for Saved (five seconds, up to fifteen); the speed check's three assertions that each view switch asked the server for the list now say it asks nothing inside five minutes, and its 401 step now triggers on opening a note (the next thing that does ask) instead of a view switch; the journal checks fire the focus through `returnToWindow` in `harness.mjs`, which moves the page clock six minutes on for the instant the focus is handled and puts it back, so a refresh really happens. A first version that moved the clock for good broke undo timings and was replaced.

## A defect found by the browser checks, not by the suites

An edit made during this work removed `show("login")` from `goToLogin` in `notes/index.html`, so a signed out visitor saw only "Loading." and could not sign in. The Node and Python suites did not see it (they hold the page statically); every notes browser check failed at its first step. Fixed in the next commit. No deployed code had it. The journal does not share the function.

## What was run

Node suite 265 of 265, Python suite 441 of 441 (which runs the Node suite once more), `npm run test:vercel` (opt-in, with the network), the budget test, the twelve breakage proofs, the measurement before and after (cold and warm), and these browser checks: journal 404 of 404, journal lag 33 of 33, notes `browser-check` 39, `-v2` 25, `-v3` 66, `-v4` 149, `-signout` 26, `-speed` 52, `-revisions` 12. `-v3` and `-v4` were run after the changes but before the last edits to the other checks, and they do not touch those files.

**Not run:** the Vercel Preview, a finger on an iPad, a real Blob store (the stand-in counts calls; real billing may differ, see Q3), and any check of the live pricing page.
