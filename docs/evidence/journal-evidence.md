# The journal at /journal, 22 October 2026

Branch `journal`, cut from `main` at `05969ba` (the notes speed merge), with `journal-design-brief` merged in so the brief and the questions file come with it. Not merged to `main`. `CLAUDE.md` section 9e. The Vercel Preview is checked by the product owner himself: **there is no Preview URL in this file because none was run from here** (this environment cannot reach Vercel hosts). The screenshots are from a local Chromium 141 run of the real page and the real API handlers over in-memory stores and a password made for the run.

Governing documents: `docs/briefs/journal-design-brief.md` and `docs/journal-open-questions.md`. Where the build differs from the brief it says so below, and each difference is a numbered question in the questions file.

## What ran

* **`npm ci`, then `npm test`: 121 before, 185 after, 185 pass.** `journal-core.test.js` 26, `journal-api.test.js` 31, six more in `site.test.js` (the journal page served beside notes, noindex, nothing links to it, no outside request, no dash, the manifest) and one more in `blob-auth.test.js`. The 121 and the 345 were counted again on `05969ba` in a clean worktree, not taken from the handoff.
* **`python -m unittest discover -s tests` from `forecast-app/`: 345 before, 385 after, all pass.** `test_journal_page.py` is 40 tests in three classes. `test_notes_page.py` and `test_marketing_deploy_allowlist.py` changed (below). It needed `pip install -r requirements.txt` first, as before; three Assay modules cannot import without `fastapi`, which is an environment gap and not a failure.
* **Every existing notes browser check, against the notes page as committed here (it has one new menu item): `browser-check` 38 of 38, `browser-check-v2` 25 of 25, `browser-check-signout` 26 of 26, `browser-check-v3` 66 of 66, `browser-check-v4` 149 of 149, `browser-check-speed` 52 of 52.** Their screenshots were rewritten by the run and put back with `git checkout`, so no old evidence file changed.
* **New `docs/evidence/journal/browser-check-journal.mjs`: 208 checks, 0 failed**, run six times in a row on the final code with the same result. It writes the 37 screenshots below and takes in sign in, nothing painted first, the layout at 1920, 1280, 1000, 900, 375 and 320px, adding by keyboard and by prefix, ticking, editing, deleting and Undo, bold and strike-through, every move with a mouse and with a finger, the date picker, Month and its picker and the day log and the way back, the strip (a day, a weekend, a month end, and the date changing under an open window with ten minutes of timers), quick notes and a clash on them, two devices (a clash on an edit, a clash on a tick, entries on both), a failed send, sign out and the page's memory (a heap search for an entry's text), leaving the page, a 401, what the device keeps, storage blocked, no-store on every address, install, the notes menu, and each panel drawing alone.
* **`npm run test:vercel` ran, and passes** (the network was available this time). `vercel build` deploys six functions, `journal.func` among them, with `journal/core.js` bundled inside it (listed from the build output), and the static files are exactly the allowlist, journal files included. Vercel's own Node wrapper answers the journal's three methods through the gate. This is Vercel's tooling run locally. It is not the platform.
* **Deliberate breakages: 51 of 51 caught** (`docs/evidence/journal/breakages.py`), and **4 of 4 caught in the browser check** (`breakages-browser.py`). The last full run caught 50 of 51; the one it missed, the Today row losing its selected fill, was held only by the browser check, so a unit test was added (`test_today_and_tomorrow_are_marked_in_month_by_a_fill_and_a_word`) and that break was run again alone and caught. Detail below.
* **Not run:** the Preview, a real Blob store, Edge itself, Safari, a real iPad or phone. See "Install" and "What only the Preview can show".

## Install: does Edge offer Install without a service worker

**There is no service worker, and nothing in the page can store journal content, an API answer or the page itself.** Edge is built on Chromium. Chromium 141, run here against the real page and manifest over `localhost`, reports **no installability errors** (`Page.getInstallabilityErrors` returned an empty list) and parsed the manifest with no errors, with no service worker registered. **I have not run Edge itself**, so "Edge offers Install" is not proved, only that Edge's engine finds nothing to stop it. Step 8 of the Preview steps is that check. If Edge does not show Install, the fix is a service worker with no fetch handler that never stores anything, which is a small file, and it is recorded as Q15 (c).

The manifest, the five PNG icons and `core.js` are public and ungated, because a browser fetches them with no cookie. A check fetches them with no cookie and gets 200. They hold nothing private.

## Where the build differs from the brief, and why

Each is a numbered question in `docs/journal-open-questions.md` with its default and its cost.

1. **Storage is one file per month, not one per day** (Q9). A month is one read.
2. **The strip looks through three earlier months at most** (Q10).
3. **Weekdays are three letters** (Q11). One letter cannot tell Tuesday from Thursday.
4. **The page keeps itself current** on window focus, every 45 seconds while visible and when the date changes, and only ever redraws (Q12).
5. **A moved or dropped entry cannot be reopened after the ten second Undo** (Q13).
6. **Month opens as near to today as it can scroll** (Q14).
7. **A counting error in the brief.** Section 9 says the journal's sprite has eleven symbols, nine of them new. It has eleven, of which **eight** are new there; the ninth new icon is `i-journal`, which is in the notes sprite and takes it from twelve to thirteen. Built as the brief's list of shapes says, and the counts in `CLAUDE.md` 9e are the true ones.
8. **A rule the brief left to the build: "every write goes through a version check" and "two devices never silently overwrite each other"**, against Q5, accepted, which says changes to different entries merge. Built as two layers: every Blob write is conditional on the etag of the file it read (and retried against the newer file), and every change to an existing entry or line names the revision it started from, so changes to different entries do not clash and a change to the same entry is refused with the plain message and the typed text on screen. Quick notes keep the notes rule exactly. Written up in `CLAUDE.md` section 3.
9. **The shared rules file.** The brief did not name one. `journal/core.js` holds every rule once and is used by the API and by the page, so the page can show a change at once and know the revision the server will give it. It is served with the page, so it is public; it holds no data and no secret. Section 5 of `CLAUDE.md` (one implementation of any judgement) is the reason.

## Existing tests and checks changed, and why

Reported, not quietly edited. The design brief and the build brief win for `/journal`.

1. `notes-tests/site.test.js`: "vercel.json only touches /notes" now says `/notes` and `/journal`, and holds both rewrites and no `crons`; the API folder list gains `journal.js`.
2. `notes-tests/gate.test.js`: the route files wired to the gate are five, not four, and the handlers fifteen, not twelve.
3. `notes-tests/vercel-local.check.js` (opt-in): six functions, the journal files in the static list, the journal rewrite, and the journal handlers answering 401 through Vercel's wrapper.
4. `forecast-app/tests/test_marketing_deploy_allowlist.py`: `PUBLIC_FILES` gains the eight journal files (page, `core.js`, manifest and five icons), and the `vercel.json` rule check accepts `/journal` as well as `/notes`.
5. `forecast-app/tests/test_notes_page.py`: `test_exactly_twelve_icon_shapes...` is `test_exactly_thirteen_icon_shapes...` and holds `i-journal`; `test_the_menu_is_a_nav_with_the_items_in_order_and_no_headings` holds Journal as the last item, a plain link with no `data-key`.
6. `notes/index.html`: the Journal menu item and its icon, and nothing else. `git diff --stat` shows two insertions.
7. `notes-tests/blob-auth.test.js`: one test added, none changed.

## Contrast

No colour variable was added. `test_contrast_for_every_pair_the_journal_uses_in_both_themes` computes every pair from the declared values, both themes.

| Text on fill | Light | Dark | Floor | Used for |
|---|---|---|---|---|
| `--notes-ink` on `--notes-panel` | 11.76 | 12.68 | 4.5 | entry text |
| `--notes-muted` on `--notes-panel` | 5.23 | 5.91 | 4.5 | done, moved, scheduled and dropped entries |
| `--notes-muted` on `--notes-hover` | 5.01 | 4.81 | 4.5 | a greyed entry while it is hovered |
| `--notes-muted` on `--notes-field` | 6.10 | 5.44 | 4.5 | the placeholder, the strip, the add line |
| `--notes-ink` on `--notes-hover` | 11.25 | 10.33 | 4.5 | the Tomorrow row |
| `--notes-ink` on `--notes-field` | 13.72 | 11.68 | 4.5 | the strip and the add line |
| `--notes-strong` on `--notes-selected` | 12.91 | 10.25 | 4.5 | the Today row and the chosen type button |
| `--notes-ink` on `--notes-selected` | 10.08 | 8.64 | 4.5 | text on the Today row |
| `--notes-icon` on `--notes-selected` | 6.78 | 7.03 | 3.0 | bullets on the selected fill |
| `--notes-on-accent` on `--notes-accent` | 5.52 | 5.52 | 4.5 | Bring forward |
| `--notes-ink` on `--notes-ground` | 12.94 | 11.68 | 4.5 | buttons |
| `--notes-bad` on `--notes-ground` | 6.71 | 6.14 | 4.5 | the sign in error |
| `--notes-icon` on `--notes-panel` | 7.91 | 10.33 | 3.0 | bullets and icons |

`--notes-muted` on `--notes-selected` is 4.49 light and 4.02 dark, below 4.5, which is why nothing muted sits on the Today row; `test_muted_is_never_set_on_the_selected_fill` holds it. The 2px accent focus outline is 2.73:1 against the panel in light mode, the notes outline, accepted as Q7.

## Controls proved able to fail

Each break was made in the file named, the suites that should notice it were run, and the file was put back from its bytes. **The base was green before the first break, and `git diff --stat` after the run showed no stray change.** One earlier run of this loop is worth the record: **five of the first 48 were not caught**, and each was a defect in the control, not in the page. A "no timer" test that could never fail, because an `or` made one half always true; a test for the page working out a revision that looked for `rev + 1` and not `(x) + 1`; no test that the strip has no "Drop all"; and two breaks whose text had not been found, because `vercel.json` is formatted across lines. A test for a timer in the API also hung the suite rather than failing it, which is why `breakages.py` now treats a suite that does not finish as a catch. All five were fixed and the loop was run again from the start.

* **The rules** (`journal/core.js`), nine breaks: a move that leaves no arrow; an edit that stops checking the revision; a move that lands at the top; a move of several that is no longer all or nothing; Undo taking back a copy that was ticked; the strip offering events and notes; the strip missing Friday; a rule that reads the clock; a damaged month file read as empty.
* **The API and the store**, ten breaks: Quick notes losing the gate; a 401 no longer no-store; reading that writes; a write that ignores the version it read; a refused move that leaves its copies behind; the quick notes version check gone; a timer added; data written under `notes/`; a write that stops using `ifMatch`; a read that may come from the cache.
* **The site**, four breaks: a cron in `vercel.json`; the journal no longer no-store; the region pin dropped; `journal/` taken off the allowlist.
* **The page**, twenty five breaks: a new colour variable; a raw colour; muted on the Today row, twice; a theme value moved so a pair falls under 4.5:1; the Today row losing its selected fill (the one a unit test did not hold at first); a five column layout back at 1400px; Tomorrow above Today; a 5px corner; a shadow; a 2px border; the More button and a bullet under 44px for a finger; a twelfth icon; an icon not stroked in the current colour; `pagehide` no longer emptying the page; the strip months kept on sign out; a timer that brings tasks forward; entries written to `localStorage`; the page working out a revision; a service worker registered; an empty state reworded; an em dash in a message; a wrong theme colour in the title bar tag; "Drop all"; a panel reaching into another.
* **The manifest and the notes menu**, two breaks: a start address outside the scope; the Journal item gone.
* **In the browser check**, four breaks, each shown red: the month files kept in memory after sign out (three heap checks went red); a timer that brings the strip forward by itself (the ten minutes of timers check, 7 writes against 6); the edit check removed from the shared rules (the two device check stopped waiting for a refusal that never came); a refused change left on screen.

## Screenshots

In `docs/evidence/journal/shots/`, from `browser-check-journal.mjs`. Light and dark at the four widths the brief asked for, from a real week of data (every state, the strip with a daily and a month group, calendar lines, quick notes with bold and strike-through):

`week-1920-light`, `week-1920-dark`, `week-1280-light`, `week-1280-dark`, `week-900-light`, `week-900-dark` (and the whole page, `week-900-light-full-page`, `week-900-dark-full-page`), `week-375-light`, `week-375-dark`.

At 375px each other tab in both themes: `week-375-month-*`, `week-375-tomorrow-*`, `week-375-migrate-*`, `week-375-quick-*`, and `week-375-today-moves-*` (a row's four actions opened by a finger). Also `week-1280-dark-day-log` and `week-1280-dark-month-picker`.

From the individual checks, light: `1000-light`, `1280-light`, `1920-light`, `900-light`, `375-light`, `320-light` (the empty journal at each width, 320 to show the header fits), `entries-1280-light`, `moved-1280-light`, `hover-1920-light` (the four actions at the right of a hovered row in a wide panel) and `moved-by-hover-1920-light`, `picker-375-light` (the date rows at a finger's size), `strip-1280-light`, `day-1280-light`, `conflict-1280-light` (the plain message after a refused tick), `notes-menu-1280-light` and `notes-menu-375-light` (the Journal item).

## What only the Preview can show

Q15 in the questions file. In short: (a) the sixth function on the Vercel platform itself; (b) the real Blob store honouring the version a write names, which the tests prove the adapter asks for and cannot prove the store does; (c) Edge offering Install.

## Preview steps for the product owner

On the branch Preview of the `silurian-site` project, at `/journal`, on the Windows PC and then on the iPad. Report what you see, step by step.

1. **Sign in.** Open `/journal`. Only the word Journal and a password box. Sign in with the notes password. If you are already signed in to `/notes` on the same Preview, it opens straight in.
2. **The window.** At your usual size, three columns: Month tall on the left, Today above Tomorrow in the middle, Migrate above Quick notes on the right. Today and Tomorrow are marked in Month with a fill and a word.
3. **Adding.** In Today type a task and press Enter. `Alt+2` then an event, `Alt+3` a note, or type `. `, `o `, `- ` on an empty line. Tick the task: a cross and a strike. `Ctrl+B` and `Ctrl+Shift+X` on a word.
4. **Moving.** Click the three dots on a task, then Tomorrow. The original goes grey with a right arrow and "to Tomorrow". Press Undo within ten seconds. Move another with Date and pick the 28th: a left arrow.
5. **Month.** Click the number of a date other than today: its log opens in the Month panel. Back, Escape and the browser Back button all return. Click today's number: you land in the Today add line.
6. **The strip.** Open an earlier date from Month (the 20th), add a task, reload. Today shows "From Tuesday 20 October, 1 open task" with Bring forward and Drop. Nothing moves until you press one. The month end group cannot be tried before 1 November without September data; it is held by tests and the local browser run.
7. **Two devices.** Add an entry on the PC. On the iPad press nothing: it appears within a minute or when the window gets focus. Edit the same entry on both: the second gets "This changed on another device. Your text is still on screen..." with a Reload button, and your typed text is still there. This is the step that proves the real store honours the version.
8. **Install as an app in Edge.** On the PC open `/journal` in Edge. Look for the install icon at the right of the address bar, or the three dots, Apps, Install this site as an app. Install. It opens in its own window with no browser bars, titled Journal, with a title bar the colour of the page. Pin it to the taskbar if you like. Sign in once inside it. Tell me if Edge offers no Install. On the iPad: Safari, Share, Add to Home Screen, name Journal; open it from the home screen and sign in inside it (the home screen app keeps its own sign in). Landscape shows three columns. Portrait shows Month on the left and the others stacked, or one panel and five tabs on a small iPad.
9. **Notes menu.** In `/notes` the menu has Journal as its last item, below Archive, and it opens the journal.
10. **Sign out.** Press Sign out. The page shows only the sign in. Back and refresh show only sign in.
11. **Dark mode.** The moon switches it, and the installed window's title bar follows.
12. **The Vercel checks.** The `silurian-site` project should show the Preview deployed with six functions. Assay's project is untouched by this change.

After the merge, the same steps on Production, and record the merge commit in `PROJECT_HANDOFF.md`.
