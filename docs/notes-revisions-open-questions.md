# Notes save safety: open questions

Each: what it blocks, the default built, and the cost if wrong. Brief: the notes save safety build brief of 22 October 2026 (revision files for notes, following the journal pattern). **None waiting. Q1 to Q4 were answered on 23 October 2026: all four defaults accepted, Q1 to be a small separate change later.**

**Q1. Creating a note is not made safe against a repeat.**
Blocks: nothing. The brief is about revisions of a note's text, labels and archive flag.
Default built: unchanged. A new note is made by a POST that carries no id of its own, so if the answer is lost and the page sends it again, a second note is made. That is how it has always worked; it is not a revision and nothing is overwritten. The page's retry after a failed save of an existing note (5 seconds later, the same version, the same text) is recognised and makes no second revision.
Cost if wrong: after a lost answer on the very first save of a new note, a duplicate note can appear. Making it safe means the page choosing the new note's id, which changes the create call and is a separate small change.

**Q2. A removed note's last revision is kept for good.**
Blocks: nothing. The brief says never delete the newest revision.
Default built: a removed note is a revision that says so, and it stays, a few bytes, so a page that still shows the note can be told it is gone. Its older revisions and text go once safely superseded. The list answer carries the ids as `gone`, and the page drops them.
Cost if wrong: one tiny file per deleted note, and a list of ids that grows with every deletion (tens, for a personal notepad). If it should be tidied after a day or a month, it is one rule in `garbageOf`, and a page open for longer than that would keep showing a deleted note until reloaded.

**Q3. Opening a note and reading the labels make one more request, one after the other.**
Blocks: nothing. The brief says speed of list and view switches must not change.
Default built: the list is unchanged (a listing and the index, five requests when one note changed, two after). Opening a note, which is shown from memory at once and then refreshed, now lists that note's files before reading them: three requests where there were two, one wait longer on the server. The label list is a listing and a read where it was a read. Saving a note makes the same number of requests as before. Counts are in `docs/evidence/notes-revisions-evidence.md`.
Cost if wrong: about one storage round trip more on the refresh behind an open and on the label read. The page does not wait for either, because it draws from memory. If it matters, a note's newest revision number could be kept in the index and the listing skipped.

**Q4. A note made a moment ago may not be openable from another device until the store lists it.**
Blocks: nothing. Found while testing against a store that lists a file only after a delay, which the documentation does not promise.
Default built: a save from a version the caller names finds the note whatever a listing shows, by asking for the files after the listing by their paths. Opening a note with no version to go on uses the listing, so on a store whose listing is up to a minute behind, a note made seconds ago on another device could answer "does not exist" for that long. The page opens notes from its own list, which is built from the same listing, so it does not offer a note the store has not listed.
Cost if wrong: a rare, brief miss that corrects itself. Nothing is lost or overwritten.

## Answered by the brief, recorded here

**What was done with the two files that are overwritten in place today** (brief item 6):
* **The label list** was one file overwritten on every change, checked against its version by a read. It is now revisions in the same way as a note: `labels/<rev>.json`, each created and never overwritten, the newest winning, a repeated change recognised, old ones tidied after a minute. A `labels.json` made before revisions is read as revision 0.
* **The metadata index** (`notes-index.json`) is still overwritten in place, on purpose. It is only a copy of each note's newest small file, and nothing trusts it: each entry is tagged with the revision it was made from, a revision never changes, every list is checked against a fresh listing, and the version check never reads it. An old copy of it, or a lost update to it, can cost an extra read and cannot put a wrong row on screen or change a version check. Held by `notes-tests/speed.test.js` and `revisions.test.js`.
