# Notes version 4: menu bar, labels and archive, 20 October 2026

Branch `notes-v4`, cut from `main` at `1af386e` (the notes version 3 merge). Not merged. `CLAUDE.md` section 9d. The Vercel Preview is checked by the product owner himself: **there is no Preview URL in this file because none was run from here** (this environment cannot reach Vercel hosts). The screenshots below are from a local Chromium run of the real page and the real API handlers.

## What ran

- `npm ci`, then `npm test`: **78 before, 108 after, 108 pass.** `notes-tests/v4.test.js` is 29 tests; `theme.test.js` gained 2.
- `python -m unittest discover -s tests` from `forecast-app/`: **332 before, 341 after, all pass.** (`pip install -r requirements.txt` first, as before.)
- Every existing notes browser check, against the new page: `browser-check.mjs` **38 of 38**, `browser-check-v2.mjs` **25 of 25**, `browser-check-signout.mjs` **26 of 26**, `browser-check-v3.mjs` **66 of 66** (the version 3 screenshots are untouched).
- New `docs/evidence/notes-page/browser-check-v4.mjs`: **149 checks, 0 failed**, and it writes the 54 screenshots below. It seeds seven labels and five notes through the real API and checks, wide and then at 320px: the 240px menu bar flush left, the header across the window, item order and alphabetical labels, the active item (including none while searching), addresses surviving a refresh, chips (3 and `+2` above 760px, 2 and `+3` at 320px, one line, never past the row buttons), the screen reader text, archive and unarchive from the row and the edit view with the message and Undo, search from a label view finding an archived note with the marker, the Labels panel (filter, tick, untick, create with Enter, Escape returns focus), a new note from a label view starting with that label, Edit labels (create, clash, rename, Escape, delete counts for 0, 1 and several notes), a deleted or unknown label id showing Notes, two devices changing labels at once, and the phone menu (width, scrim colour, focus, inert, Escape, scrim tap, item choice, theme row, Sign out, resize past 760px, signed out with no menu and the theme switch in the header).
- `npm run test:vercel`: **not run**, the network is blocked here. It now expects five functions, so `labels.func` is unproved until it runs (Q19).

## Existing tests and checks changed, and why

Reported rather than quietly edited. The design brief wins for `/notes`.

1. `notes-tests/v2.test.js`, search result keys: a result now carries `labels` and `archived`, because the brief says the list and search return them.
2. `notes-tests/gate.test.js`, every route file is wired to the gate: twelve handlers across four route files, not seven across three. `api/labels.js` and `PATCH /api/note` are new handlers and they are checked for a 401 with no cookie.
3. `notes-tests/site.test.js`, the API folder: `labels.js` joins `login.js`, `note.js`, `notes.js` and `session.js`.
4. `notes-tests/vercel-local.check.js` (opt-in): five functions.
5. `forecast-app/tests/test_notes_page.py`: six icons became twelve and the row delete test became "every icon button names what it acts on"; the dark-block test now accepts the scrim's rgba value. Every other version 3 test passes unchanged.
6. `docs/evidence/notes-page/browser-check*.mjs` (all four): each runs its own copy of the store and its own route list, so each needed the four new store methods and `/api/labels`; the signout and version 3 checks sign out through the menu at phone width, where Sign out is no longer in the header; the version 3 check now says `#theme-switch .icon-sun` because the menu row has an icon of the same class; `browser-check-v2.mjs` already had its confirm button selector made exact for version 3.

## Contrast

`test_contrast_on_the_selected_fill_in_both_themes` computes the ratios from the declared values. `--notes-strong`, `--notes-ink` and `--notes-icon` on `--notes-selected` pass at 4.5:1, 4.5:1 and 3:1 in both themes (the test reports the actual ratio if one fails; none did). `test_muted_is_never_set_on_the_selected_fill` holds the other half. The scrim is `rgba(26, 25, 24, 0.4)` light and `rgba(0, 0, 0, 0.6)` dark, in the theme blocks only.

## Controls proved able to fail

Each change was made to `notes/index.html`, `api/_lib/notes-api.js` or `api/_lib/store.js`, the relevant suite run, and every file restored before the next. **All twenty failed at least one test:** an rgba value outside the theme blocks, the dark scrim changed, muted set on the active menu item, a thirteenth icon, the row archive button and the label delete button each losing their name, the Archive empty copy changed, a dash in an empty state, the menu width changed, Archive moved above Edit labels (**this one was missed by the first version of the test and fixed**: the menu test now requires each item exactly once), the phone menu's Escape handling removed, its focus return removed, the label version check removed, the note PATCH version check removed, duplicate names compared with case, Notes including archived notes, a text save dropping the labels, a new route outside the gate, the labels file moved under `notes/`, and a damaged labels file read as empty. **One earlier run of this loop did not restore files between changes and its results were discarded and re-run.**

## Choices the brief left open

Recorded as Q13 to Q19 in `docs/notes-page-open-questions.md`, each with the default built and the cost if it is wrong. The ones to read first: **Q13** (a label or archive change moves the note's last-edited time, because the version is that time), **Q14** (the header is now sticky) and **Q19** (five functions, unproved on Vercel).

## Not run

- `npm run test:vercel`, the Preview, Safari, Firefox and a real phone. The 320px runs are a Chromium viewport.
- Phone menu `inert` and focus behaviour in Safari. Chromium honours both.

## Screenshots

From `browser-check-v4.mjs`, files `docs/evidence/notes-v4/<width>-<theme>-<NN>-<state>.png`. The phone menu is a 320px state only; at 1280px the menu bar is in every shot.

### 320px, light

**Notes, with labelled rows (Trip plan carries 5 labels)**

![320 light Notes, with labelled rows (Trip plan carries 5 labels)](notes-v4/320-light-01-notes-with-labels.png)

**A label view (Work)**

![320 light A label view (Work)](notes-v4/320-light-02-label-view.png)

**The phone menu open**

![320 light The phone menu open](notes-v4/320-light-03-phone-menu-open.png)

**The edit view with the Labels panel open**

![320 light The edit view with the Labels panel open](notes-v4/320-light-04-edit-labels-panel.png)

**Edit labels, with a rename and a delete confirmation open**

![320 light Edit labels, with a rename and a delete confirmation open](notes-v4/320-light-05-edit-labels-rename-and-delete.png)

**Archive**

![320 light Archive](notes-v4/320-light-06-archive.png)

**A search showing an archived result**

![320 light A search showing an archived result](notes-v4/320-light-07-search-with-archived-result.png)

**Empty state: Edit labels with no labels**

![320 light Empty state: Edit labels with no labels](notes-v4/320-light-08-empty-edit-labels.png)

**Empty state: empty Archive**

![320 light Empty state: empty Archive](notes-v4/320-light-09-empty-archive.png)

**Empty state: no notes (existing copy)**

![320 light Empty state: no notes (existing copy)](notes-v4/320-light-10-empty-notes.png)

**Empty state: no search results (existing copy)**

![320 light Empty state: no search results (existing copy)](notes-v4/320-light-11-empty-search.png)

**Empty state: Labels panel with no labels and nothing typed**

![320 light Empty state: Labels panel with no labels and nothing typed](notes-v4/320-light-12-empty-labels-panel.png)

**Empty state: a label view with no notes**

![320 light Empty state: a label view with no notes](notes-v4/320-light-13-empty-label-view.png)

**Empty state: a label view with no notes, archived notes carry it**

![320 light Empty state: a label view with no notes, archived notes carry it](notes-v4/320-light-14-empty-label-view-with-archived.png)

### 320px, dark

**Notes, with labelled rows (Trip plan carries 5 labels)**

![320 dark Notes, with labelled rows (Trip plan carries 5 labels)](notes-v4/320-dark-01-notes-with-labels.png)

**A label view (Work)**

![320 dark A label view (Work)](notes-v4/320-dark-02-label-view.png)

**The phone menu open**

![320 dark The phone menu open](notes-v4/320-dark-03-phone-menu-open.png)

**The edit view with the Labels panel open**

![320 dark The edit view with the Labels panel open](notes-v4/320-dark-04-edit-labels-panel.png)

**Edit labels, with a rename and a delete confirmation open**

![320 dark Edit labels, with a rename and a delete confirmation open](notes-v4/320-dark-05-edit-labels-rename-and-delete.png)

**Archive**

![320 dark Archive](notes-v4/320-dark-06-archive.png)

**A search showing an archived result**

![320 dark A search showing an archived result](notes-v4/320-dark-07-search-with-archived-result.png)

**Empty state: Edit labels with no labels**

![320 dark Empty state: Edit labels with no labels](notes-v4/320-dark-08-empty-edit-labels.png)

**Empty state: empty Archive**

![320 dark Empty state: empty Archive](notes-v4/320-dark-09-empty-archive.png)

**Empty state: no notes (existing copy)**

![320 dark Empty state: no notes (existing copy)](notes-v4/320-dark-10-empty-notes.png)

**Empty state: no search results (existing copy)**

![320 dark Empty state: no search results (existing copy)](notes-v4/320-dark-11-empty-search.png)

**Empty state: Labels panel with no labels and nothing typed**

![320 dark Empty state: Labels panel with no labels and nothing typed](notes-v4/320-dark-12-empty-labels-panel.png)

**Empty state: a label view with no notes**

![320 dark Empty state: a label view with no notes](notes-v4/320-dark-13-empty-label-view.png)

**Empty state: a label view with no notes, archived notes carry it**

![320 dark Empty state: a label view with no notes, archived notes carry it](notes-v4/320-dark-14-empty-label-view-with-archived.png)

### 1280px, light

**Notes, with labelled rows (Trip plan carries 5 labels)**

![1280 light Notes, with labelled rows (Trip plan carries 5 labels)](notes-v4/1280-light-01-notes-with-labels.png)

**A label view (Work)**

![1280 light A label view (Work)](notes-v4/1280-light-02-label-view.png)

**The edit view with the Labels panel open**

![1280 light The edit view with the Labels panel open](notes-v4/1280-light-04-edit-labels-panel.png)

**Edit labels, with a rename and a delete confirmation open**

![1280 light Edit labels, with a rename and a delete confirmation open](notes-v4/1280-light-05-edit-labels-rename-and-delete.png)

**Archive**

![1280 light Archive](notes-v4/1280-light-06-archive.png)

**A search showing an archived result**

![1280 light A search showing an archived result](notes-v4/1280-light-07-search-with-archived-result.png)

**Empty state: Edit labels with no labels**

![1280 light Empty state: Edit labels with no labels](notes-v4/1280-light-08-empty-edit-labels.png)

**Empty state: empty Archive**

![1280 light Empty state: empty Archive](notes-v4/1280-light-09-empty-archive.png)

**Empty state: no notes (existing copy)**

![1280 light Empty state: no notes (existing copy)](notes-v4/1280-light-10-empty-notes.png)

**Empty state: no search results (existing copy)**

![1280 light Empty state: no search results (existing copy)](notes-v4/1280-light-11-empty-search.png)

**Empty state: Labels panel with no labels and nothing typed**

![1280 light Empty state: Labels panel with no labels and nothing typed](notes-v4/1280-light-12-empty-labels-panel.png)

**Empty state: a label view with no notes**

![1280 light Empty state: a label view with no notes](notes-v4/1280-light-13-empty-label-view.png)

**Empty state: a label view with no notes, archived notes carry it**

![1280 light Empty state: a label view with no notes, archived notes carry it](notes-v4/1280-light-14-empty-label-view-with-archived.png)

### 1280px, dark

**Notes, with labelled rows (Trip plan carries 5 labels)**

![1280 dark Notes, with labelled rows (Trip plan carries 5 labels)](notes-v4/1280-dark-01-notes-with-labels.png)

**A label view (Work)**

![1280 dark A label view (Work)](notes-v4/1280-dark-02-label-view.png)

**The edit view with the Labels panel open**

![1280 dark The edit view with the Labels panel open](notes-v4/1280-dark-04-edit-labels-panel.png)

**Edit labels, with a rename and a delete confirmation open**

![1280 dark Edit labels, with a rename and a delete confirmation open](notes-v4/1280-dark-05-edit-labels-rename-and-delete.png)

**Archive**

![1280 dark Archive](notes-v4/1280-dark-06-archive.png)

**A search showing an archived result**

![1280 dark A search showing an archived result](notes-v4/1280-dark-07-search-with-archived-result.png)

**Empty state: Edit labels with no labels**

![1280 dark Empty state: Edit labels with no labels](notes-v4/1280-dark-08-empty-edit-labels.png)

**Empty state: empty Archive**

![1280 dark Empty state: empty Archive](notes-v4/1280-dark-09-empty-archive.png)

**Empty state: no notes (existing copy)**

![1280 dark Empty state: no notes (existing copy)](notes-v4/1280-dark-10-empty-notes.png)

**Empty state: no search results (existing copy)**

![1280 dark Empty state: no search results (existing copy)](notes-v4/1280-dark-11-empty-search.png)

**Empty state: Labels panel with no labels and nothing typed**

![1280 dark Empty state: Labels panel with no labels and nothing typed](notes-v4/1280-dark-12-empty-labels-panel.png)

**Empty state: a label view with no notes**

![1280 dark Empty state: a label view with no notes](notes-v4/1280-dark-13-empty-label-view.png)

**Empty state: a label view with no notes, archived notes carry it**

![1280 dark Empty state: a label view with no notes, archived notes carry it](notes-v4/1280-dark-14-empty-label-view-with-archived.png)

