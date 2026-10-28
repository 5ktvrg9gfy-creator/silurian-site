# Journal: Done list, Quick notes bullets and calendar search, evidence

Branch `journal-done-search`, cut from `main` at `ac41590` on 28 October 2026. Not merged. Questions: `docs/journal-done-search-open-questions.md` (nine waiting, none blocks the Preview).

## What was built

- **Done list.** `#done/YYYY-MM`, a full-window read only view with Back, Escape and month arrows. The server route is `GET /api/journal?view=done&month=`; the grouping is `core.doneGroups`; the tick time is the listing's `uploadedAt` for the first revision of the run of done revisions ending at the newest.
- **Quick notes bullets.** A bullet button; "- " or "* " typed at the start of a line, Enter on a bullet and Enter on an empty bullet. Rules in `core.js`, carried out on screen through editing commands.
- **Calendar search.** A field at the top of Month; `GET /api/journal?view=all` once per window; `core.searchCalendar` in the page.
- Two icons, `j-tick` and `j-bullet`. No new colour, size, width or radius.

## Usage, measured (counting stand-in, instances that remember nothing)

Same seed as the other rows (23 days of October, 10 of September, a span), five of the October tasks ticked and one edited after its tick.

| Action | Advanced | Simple |
|---|---:|---:|
| Open the Done list (October) | 2 | 84 |
| Change its month (September) | 2 | 10 |
| First search in a window (the page holds October) | 3 | 12 |
| Next search in the window | 0 | 0 |
| Idle, with the Done list or a search open | 0 | 0 |

Set in `notes-tests/blob-budget.json` at exactly these figures. The floor for Done is one listing for each of two months and one read for every entry whose newest revision falls in the window, because the state is in the file. Entries whose newest revision was written before the month are not read (held by a test). The browser check shows a month already seen is asked for no more within five minutes, and no later search asks. These actions are not in the typical day of 73, which is a browser measurement of a stated mix.

## Tests

- Node: 265 before, 285 after (`notes-tests/journal-done-search.test.js` 20; the budget test gained three rows inside an existing test).
- Python `test_journal_page.py`: 83 before, 96 after (13 new in `JournalDoneListSearchAndBullets`). Three existing tests changed: the two icon count tests (14 to 16, with the two new shapes) and the spell check test was met by leaving `spellcheck="false"` off the search field.
- Browser: `docs/evidence/journal/browser-check-journal-done-search.mjs` 57 of 57 (first run 56 of 57: a test expectation had "Sep" where the locale writes "Sept"; the page was right). Existing journal browser check 404 of 404 and lag check 33 of 33, run after the change.
- Deliberate breakage proofs for the new rules only: `docs/evidence/journal/breakages-done-search.py`, 17 of 17 caught, output in `breakages-done-search-run.txt`. **Two missed on the first run and were closed:** a test for "a file written before the month is not read" put its old files in a month the route never lists, so it could not fail (fixed to put them in September's log), and the Back break left a second branch that gave the same result (the break now removes both).

## What the checks saw

The browser check counts what it looked at: 4 Done rows over two days, an empty September, 5 search results across 4 months, a narrower search, no results, a result opened in March, results back after the log, clear and Escape, a Migrate result, an entry added in the window found without a read, 8 bullet steps. Screenshots in `docs/evidence/journal/shots/` (`done-list.png`, `done-list-390.png`, `search-results.png`, `quick-bullets.png`).

## Not run

The Vercel Preview, a finger on an iPad, a real Blob store (the stand-in counts calls; real `uploadedAt` values come from the package and were not seen), `npm run test:vercel`, and the Production usage result for blob-usage (not available to this session, Q9).
