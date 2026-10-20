# Notes speed: evidence

Branch `notes-speed`, cut from `main` at `8d79552` (the notes version 4 merge), 20 October 2026. Not merged.

## What was measured, and how

`docs/evidence/notes-speed/measure.mjs` drives the real page in Chromium over the real API handlers and the real Blob adapter (`api/_lib/store.js`), with a counting stand-in for the Blob package. Every Blob call is counted against the request that made it. 40 notes (4 archived), 6 labels. A 40 ms delay is put on each Blob call and 60 ms on each API request, to stand in for distance. **The millisecond figures are relative: they show what an action costs on the same machine before and after, not what Vercel answers in.** The request and Blob-call counts are exact for this page and this store. The raw results are in `measure-before.json` (main), `measure-after-b.json` (server changes only) and `measure-after.json` (everything). Not measured: a real Blob store, a real Vercel function, a real phone.

## Before and after (requests / Blob calls / time until the screen shows the result)

| Action | Before (main) | After |
|---|---|---|
| open list (first load) | 3 / 42 / 287 ms | 3 / 44 / 326 ms (builds the index once) |
| open note from list | 2 / 3 / 227 ms | 2 / 3 / 212 ms (never opened before: still waits for the server) |
| back to list | 2 / 42 / 205 ms | 2 / 3 / 50 ms |
| open a second note | 2 / 3 / 208 ms | 2 / 3 / 171 ms |
| open a note opened before (compared with "open a second note") | 2 / 3 / 208 ms | 2 / 3 / 56 ms |
| tick a label | 1 / 4 / 30 ms | 1 / 4 / 56 ms (the chip was already on screen at once on main; the save is two steps deep instead of four) |
| untick a label | 1 / 4 / 39 ms | 1 / 4 / 42 ms |
| archive from the open note | 3 / 46 / 432 ms | 4 / 13 / 56 ms |
| archive from a list row | 3 / 46 / 279 ms | 2 / 8 / 45 ms |
| switch view: a label | 2 / 42 / 212 ms | 2 / 3 / 52 ms |
| switch view: Archive | 2 / 42 / 200 ms | 2 / 3 / 46 ms |
| switch view: Notes | 2 / 42 / 205 ms | 2 / 3 / 65 ms |
| search | 2 / 122 / 511 ms | 1 / 42 / 426 ms |

The 3 Blob calls on a repeated list are one listing, one index read and one labels read. Request counts rose by one for archive from the open note (the list is drawn from memory and then asked for, and a refresh follows the save) and fell for the others. Blob calls are the cost that grows with the number of notes: a list was N+2, it is now 3 whatever N is.

## Findings from the first part of the brief

- **Region.** Root `vercel.json` set no region, so the five notes functions ran in the Vercel default (Washington DC, `iad1`). Assay is pinned to `lhr1` by `forecast-app/vercel.json`, a different Vercel project. Now `"regions": ["lhr1"]` in the root `vercel.json`. The root project's only functions are the notes routes, so the static pages are untouched, and Assay's file is unchanged (both held by `notes-tests/site.test.js`). **Open: whether the Blob store is in London. See Q1 in `docs/notes-speed-open-questions.md`.**
- **Reads of every note per request, on main:** the list (N metadata files), every label or archive view (the same), the label-count check before deleting a label (the same), the empty-label check (the same, through the archive view), and search (N metadata files, then N more, then N texts). After a save, archive or label change the page also refetched the whole list. After: a list is one listing and one index read; search is one listing, one index read and N texts.

## What changed

1. **Region** (commit "Notes speed (a)"): one line in `vercel.json`.
2. **Server** (commit "Notes speed (b)"): `api/_lib/store.js` keeps `notes-index.json`, a copy of every note's metadata. It is only a copy. Every list lists the store once (the listing carries each file's etag) and trusts an index entry only if the etag of that note's metadata file is the one the entry was made from; anything else is read from the note's own file, and the index is repaired. A missing, damaged or other-version index is ignored. A failed index write never fails a request. **Every version check (text save, label or archive change, delete) still reads the note's own files and never the index.** Reads that do not depend on each other now go out together (a note's text and metadata; its text-file check and metadata; and for a label change, the label list). Search reads texts only. The page changes below needed no API change: `view=all` already existed.
3. **Page** (commit "Notes speed (c)", `notes/index.html` only): the page asks for every note once (`view=all`) and cuts Notes, Archive and a label from that on the page, so a view switch or Back paints at once and the server is asked again straight after; opened notes (the last 20) open at once and are checked quietly; archive from a row or an open note, and label ticks, show on screen at once and save in the background; ticks made while a save is on its way go as one next save. A refused or conflicting background save puts the screen back with the server's own message (the row's message, the flash bar or the status line, as before). Typing that is under way is never replaced by a quiet refresh: the save still carries the version the note was opened at, so a note changed elsewhere is refused as before. All of it is in memory only and is dropped on sign out, on a 401 and on `pagehide`.

## Tests

- `npm test`: 108 before, 121 after. New: `notes-tests/speed.test.js` (12 tests on the index and the parallel reads), one in `site.test.js` for the region. `blob-store.test.js`'s stand-in now gives every write a new etag, as the real store does; before, it returned a constant, which would have hidden a stale index.
- `forecast-app` suite: 341 before, 345 after (4 new in `NotesPageSpeedKeepsMemoryOnly`). **One existing assertion changed:** `test_the_addresses_are_in_the_page` required the page text to contain `view=label&label=` and `view=notes`; the page now asks for `view=all` and cuts the views itself, so it requires `view=all` and `view=archive` instead. The API still supports every view, and `v4.test.js` still holds them.
- Browser checks, Chromium, all unchanged and passing: `browser-check.mjs` 38 of 38, `browser-check-v2.mjs` 25 of 25, `browser-check-signout.mjs` 26 of 26, `browser-check-v3.mjs` 66 of 66, `browser-check-v4.mjs` 149 of 149. The five harnesses each gained one line (`text(id)` on their in-memory store, because search reads texts only now).
- New: `browser-check-speed.mjs`, 52 of 52, computer and phone width. The server is made slow (0.8 to 1.2 seconds) so a screen that appears in under 350 ms must have come from memory (measured 3 to 65 ms). It covers view switches, archive from a row and from the open note, label ticks (three ticks go as two saves), reopening a note, and:
  - **A refused background save reverts the screen and shows the message**: row archive, open-note archive and a label tick, each with the store refusing the write (the "Storage is not available" message) and each with a conflict (the note changed on another device first, the "changed on another device" message), and in each case the server still holds the old value.
  - **In-memory data is gone after sign out, after a 401 and after `pagehide`**: a unique string from a note's text is searched for in a Chromium heap snapshot taken after garbage collection. It is found before and not found after. Signing back in with a slow server draws no list from before.
- **Proved able to fail.** Four index breakages (trust every entry whatever its tag; read metadata and text check one after the other; read the label list after the note; never repair the index) each failed `npm test` (4, 1, 1 and 7 tests). Five page breakages each failed `browser-check-speed.mjs`: memory kept on `clearContent` (failed the `pagehide` check), kept on a 401 (3 checks), a refused row not put back (run timed out waiting for it), a refused tick not reverted (1 check and a timeout), a refused open-note archive silent (run timed out waiting for the message). A run that times out is a failed run, not a pass.

## Not run

`npm run test:vercel` (needs the network). The Vercel Preview, a real Blob store, a real phone and Safari. The index's use of the real store's etags is shown against a stand-in that behaves as the package's types say; the Preview is where it is proved. If the Preview shows lists as slow as before, the first thing to check is whether `list()` returns `etag` for each blob in the real store.

## Decision to merge without the Preview check, 20 October 2026

The product owner answered Q1 (the notes Blob store is in London, so the London pin stays) and chose to merge `notes-speed` **without running the Preview steps**, and to test on Production over the following day. **Preview steps: not run. Production use is the test.** The reason is his: he would rather judge the speed on the real site, with his real notes, than on a Preview. What that means for this record: everything above was shown locally only (Chromium, a stand-in for Blob, injected delay). Nothing here shows the index working against the real Blob store, and the first thing to check if Production is no faster is whether the real store returns an `etag` for each blob in a listing. Q2 to Q7 stay open and are not built.
