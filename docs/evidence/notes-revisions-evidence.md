# Notes save safety: revision files, 22 October 2026

Branch `notes-revisions`, cut from `main` at `4302610` (the journal handoff merge). **Not merged.** Questions: `docs/notes-revisions-open-questions.md` (four waiting).

## Records first

The product owner ran the journal Production check (merge `ca1e8bf`) and all nine steps passed, including installing the live app in Edge and on the iPad. Recorded in `PROJECT_HANDOFF.md` and in `docs/evidence/journal-evidence.md` on this branch. Reported by the product owner, not run by the build session.

## The problem

A note save checked the version and then overwrote the note's file in place. Vercel's Blob documentation says that deleting or overwriting a blob "may take up to 60 seconds to propagate through our cache" (https://vercel.com/docs/vercel-blob, as returned by a search of the page and its changelog, https://vercel.com/changelog/vercel-blob-now-supports-consistent-reads-on-private-storage; the build sandbox cannot open vercel.com, so the pages themselves were not read; the installed SDK's comments, read directly, confirm `useCache` and `allowOverwrite`). A read of the note's small file could therefore show the version a save started from after another device had saved a newer one. The check passed and the newer save was overwritten. The list could also briefly draw an older copy of a row.

**Proved on current `main`.** The new test file run against `main`'s own code (`notes-revisions-on-main-before.txt`): **13 of 14 fail**, and the first of them is the one that matters, "a stale read cannot overwrite a newer save from another instance": device B, holding the first version, saves from it after device A saved a newer one, and `main` answers 200 where it must answer 409. The one that passes is the check that the stand-in itself behaves as documented.

## What was built

* **Every save writes a new revision and never overwrites.** `notes/<id>.<rev>.json` is a revision of the small file; `notes/<id>.<token>.txt` is the text, named at random for that save so two saves never share a file; a label or archive change makes a new small file naming the same text. The newest revision wins. **The create of the next revision is the version check**, refused if that revision exists.
* **The check compares against the newest revision the listing shows plus what the caller and the instance know.** If the version a caller says it started from is newer than the listing shows, the files after the listing are asked for by their paths. Whatever is missed anyway is caught by the create.
* **The same save sent again produces no second revision.** The newest revision or one of the two before it started from the same version and says the same thing (the same text by hash, or the same labels and archive change), and is answered as done. The page retries a failed save after 5 seconds with the same version and text, so this is exercised. Label changes are recognised the same way, and a repeated "add a label" gives back the same label.
* **A note made before revisions reads as its revision 0.** `notes/<id>.json` with `notes/<id>.txt`, no migration. The first save after it makes revision 1; the old pair is not rewritten and goes with the other superseded files.
* **Old revisions are deleted only once a newer one has been listed for over 60 seconds, and never the newest.** A text file no kept revision uses goes once it is older than the revision that settled or over two minutes old, which takes the one a save that lost its race leaves behind. A save tidies its own note and a list tidies every note, at most 50 files at a time in one call. The last revision of a removed note is kept (Q2).
* **The page never draws an older copy over a newer one.** The list from the server is put together with the rows held: the newer version of each note wins, and a row is dropped only for a note the server says is gone (`gone` in the list answer) or this page deleted. An older copy of the open note never replaces a newer one on screen or in memory, and a note opens from the newer of what arrived and what was held.
* **Labels and the index** are described in the questions file under "answered by the brief".
* **Unchanged:** the cookie gate, the 1 MB limit, the conflict message with the text kept, sign out and its limits, the London region pin, the wire protocol (the version is still the last-edited time in `X-Base-Updated`), and the page's look.

## Tests

* **New:** `notes-tests/revisions.test.js`, 16 tests, on `notes-tests/stale-sdk.js`, a stand-in for the Blob package that serves an overwritten file as it was for 60 seconds and, in some tests, lists nothing made in the last 60. Each request goes to an instance that remembers nothing. It covers a stale read that cannot overwrite a newer save, with and without a lagging listing; labels and archive checked the same way; a deleted note not brought back; the same save sent again, for a text save, an archive change and a label change; a stale label list; old-format notes; the tidy rules (not before the minute, never the newest, text files, a lost race's text, a removed note's last revision); the index; **two races** (another device makes the next revision between this request's check and its create, for a note and for the label list); and **two hundred saves, changes and deletes across three devices, some sent twice, each to a fresh instance, checked step by step against a model of one device**, then the same after the tidying.
* **Changed, and why.** `blob-store.test.js`, `speed.test.js`, `v4.test.js` and `blob-auth.test.js` each described the old layout (two files per note overwritten in place, the labels file, a delete that removed files) and now describe the new one; the counts they assert for what a list reads are unchanged. `helpers.js` `memoryStore` gained the same promises as the adapter (a save is made only on top of the version it started from, a repeat is recognised). The six notes browser checks each had their own copy of the store with the old calls and now use `memoryStore`; their counts are unchanged.
* `notes-tests/revisions.test.js` also runs inside the Python suite through `NotesNodeSuite`, and `test_notes_page.py` gained `NotesPageNeverDrawsAnOlderCopyOverANewerOne` (3 tests) and one string updated for the page's memory.
* **Browser:** `docs/evidence/notes-page/browser-check-revisions.mjs`, 12 checks, two and then three devices in Chromium against the real adapter on the stand-in: device B is refused with its text kept, device A's version is what is stored, no file of a note was overwritten, and a device that is shown an older list every time it asks keeps the note it made, keeps its edit's title, and does not get a note it deleted back.
* **Deliberate breakages, new storage rules only** (`breakages-revisions.py`): see "What ran".

## What it costs (`measure-revisions-before.txt` and `-after.txt`)

Requests per call, a cold instance, the same stand-in:

| call | before | after |
| --- | --- | --- |
| create a note | 2 | 2 |
| open a note | 2 (read together) | 3 (a listing, then two read together) |
| save a note | 4 | 4 |
| archive a note | 3 | 3 |
| the list, one note changed | 5 | 5 |
| the list again | 2 | 2 |
| the label list | 1 | 2 (a listing, then a read) |
| add a label | 2 | 5 |
| delete a note | 2 | 4 |

The list and a save are unchanged. Opening a note and reading the labels wait for one listing first. The page draws both from memory and refreshes them behind, so the person does not wait for either (Q3).

## What ran

* `npm test`: **216 before, 233 after, all pass.**
* `forecast-app` suite: **391 before, 394 after, all pass.**
* `npm run test:vercel`: ran, passes.
* The notes browser checks, **all run again** (the six that existed were changed to use the shared store, and none of their counts moved): 38, 26 (sign out), 52 (speed), 25 (v2), 66, 149, and the new `browser-check-revisions.mjs` **12 of 12**.
* **Deliberate breakages, new storage rules only: 22 of 22 caught** (`breakages-revisions-run.txt`): overwriting a revision or a text file, not looking past a listing that is behind, not recognising a repeat (a save or a label change), not reading an old-format note, deleting a revision at once or the newest or the text the newest uses, deleting a lost save's text at once, not reporting a removed note, an index tag that ignores the revision, a label change from any version, an API that takes a refused create as made (for a text save, a label change and a revision), a save that does not say its version, and the page replacing rows, replacing the open note with an older one, bringing back a deleted note, or letting an older row replace a newer one. **Two of those were not caught the first time**: "a label change is said to be made whatever the store says" and "a text save is said to be made whatever the store says" passed every test, because no test made the store refuse after the API's own check had passed. The two race tests were added and both breaks are now caught.

## What was not run

The Preview, a real Blob store, and Edge. **What the stand-in cannot show:** that a create of a path is read back at once on the real store, that `list` with a prefix of one note's id returns exactly that note's files, and how long the tidying's one delete call takes on a note with many revisions. The Preview steps below are the proof.

## Rollback

The first save of a note after this is deployed makes revision 1 beside the old pair, and the old pair is deleted a minute later. **Rolling back to the previous deployment after that would show those notes as they were before their first edit.** Do not roll back past a day in which notes were saved; fix forward instead.

## Preview steps for the product owner, including the two device test

On the branch Preview at `/notes`, signed in on the PC and on the iPad (or two browser windows signed in separately).

1. **Nothing changed for one device.** Open an existing note, type, wait for Saved, reload: the text is there. Make a new note, add a label, archive it, unarchive it. Delete one. Everything behaves as it did.
2. **Two devices, the clash.** On the PC open a note and leave it. On the iPad open the same note, change a word, wait for Saved. Back on the PC, without reloading, change a different word and wait. **Pass:** the PC says the note was changed on another device and keeps the PC's text on screen. Reload the PC: it shows the iPad's version. Nothing the iPad saved is lost.
3. **Two devices, the other way, quickly.** Open the same note on both. Edit on the PC, wait for Saved, and within about ten seconds edit on the iPad without reloading. **Pass:** the iPad is refused with the same message and its text stays.
4. **Labels on two devices.** On the PC add a label. On the iPad, without reloading, add a different label. **Pass:** the iPad is told the labels changed and the list is up to date; neither label is lost.
5. **The list.** Make three notes on the PC in a minute, delete one, then watch the list for a minute with the window in front: **Pass:** the notes you made stay, the deleted one does not come back, and no title reverts.
6. **A note from before.** Open a note you have had for days and edit it. **Pass:** it saves as normal, and after a reload the new text is there.
7. **If anything disappears, reverts or says "changed on another device" when nothing else was open.** Do not retry. Note the time, what you did and what you saw, and report it.

## Preview of `57beb20`: passed, 23 October 2026

Reported by the product owner, not run by the build session. Every step passed on the PC and the iPad: single-device behaviour, the two-device clash with the text kept, labels added on both devices with neither lost, the list with no reverts and the deleted note staying gone, and an old note editing and holding. The journal also behaved correctly overnight on Production. Q1 to Q4 accepted as built; Q1 (a repeated note creation) is to be a small separate change later. Approved to merge by pull request pinned to the reviewed head.

## Production check list for the product owner

1. Open https://www.silurianconsulting.co.uk/notes and sign in. The list shows every note you had, with the same titles and labels.
2. Open an old note, change a word, wait for Saved, reload. The new text is there. (This is the first save of an old note on the new storage, which makes its revision 1.)
3. Make a new note, add a label, archive it, unarchive it, delete it. It leaves the list and stays gone after a reload.
4. Two devices: open the same note on the PC and the iPad, save a change on the iPad, then change a different word on the PC without reloading. The PC says the note was changed on another device and keeps its text. Reload the PC to see the iPad's version.
5. Add a label on each device without reloading. Neither is lost.
6. Do not roll back after notes have been saved on this version; fix forward.
7. If anything disappears, reverts, or says "changed on another device" when nothing else was open, do not retry. Note the time and report it.

## Production check passed, 23 October 2026

The product owner ran every step of the Production check list above on https://www.silurianconsulting.co.uk/notes (merge commit `92b85a066703e9cee839b3f4c928c6359f521154`). Reported by the product owner, not run by the build session.
