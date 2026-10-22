# Journal: open questions

Each: what it blocks, the default the design brief uses, and the cost if wrong. Brief: `docs/briefs/journal-design-brief.md`. Answers by the product owner are recorded under each question. **None waiting. Q18 and Q19, raised on 22 October 2026 while rebuilding the storage, were answered the same day.** Q9 to Q15 were answered the same day. Q16 is superseded by Q18 and Q17 is accepted.

## Decision, not a question: desktop layout

Answered by the product owner. From 1000px up the layout matches James's current sticky notes at every width: Month as a full height left column, Today above Tomorrow in the middle column, Migrate above Quick notes in the right column. The five column layout is dropped. The 761 to 999px layout and the phone layout are kept as briefed. Replaces the 1000 to 1399px and 1400px and up rows in section 1 of the brief.

## Answered

**Q1. Is a calendar line the same thing as a day's log?**
Blocks: Month, and how a scheduled entry shows.
Default: no. A calendar line is one line of free text per date, kept apart from that date's entries.
**Answer: separate.** Moving an entry to a date puts it in that day's log, with a left arrow on the original, so it appears in Today when that date arrives. The Month line shows that date's events. The brief reads "events" as the event entries in that date's log, which is Q8.

**Q2. After a weekend, what does the morning strip show?**
Default: the most recent earlier day with open tasks, one day at a time.
**Answer: yes.** The strip offers open tasks from the most recent earlier day that has any.

**Q3. End of month: do open Migrate tasks move to next month?**
Default was: not built.
**Answer: yes, never automatic.** On the first open of a new month, last month's open Migrate tasks appear in the same Bring forward or Drop strip, bringing them into the new month's Migrate. Now in scope. The brief shows it as a second group in the strip, because it goes to a different place from the daily group.

**Q4. Does a done task stay put?**
**Answer: default accepted.** Done tasks stay where they are, crossed and struck, in the order logged.

**Q5. Conflicts: operations by entry, not refuse and keep text.**
**Answer: default accepted.** Entry changes merge on the server by entry id. Quick notes keeps the notes rule of refuse and keep the text.

**Q6. Offline.**
**Answer: default accepted.** Online only, no service worker.

**Q7. The accent focus outline is 2.73:1 against the panel in light mode.**
**Answer: default accepted.** Unchanged, same outline as notes.

## Answered, 22 October 2026, in the build brief

**Q8. What exactly does the Month line show as "that date's events"?**
Default was: the line's own text, then the event entries in that date's log, as read only text, with a count chip.
**Answer: the design session's reading is correct.** Event entries from that date's log, shown after the line's own text. Built as written.

**The three assumptions are accepted** (listed under "Assumed, not asked" below): the panel order, equal width desktop columns, and Migrate being always the current month's list. The fourth, that the month group in the strip offers only open tasks, is accepted with them.

## Raised by the build, answered 22 October 2026 after the Preview

**Answered: the defaults of Q9 to Q15 are accepted, each as built, by the product owner on 22 October 2026.** Recorded under each question. The Preview also settled part of Q15, below.

**Q9. Storage shape: one file per month, not one per day.**
Blocks: nothing. The design brief (section 10) sketched a file per date, a file per month for Migrate and one for Quick notes.
Default built: `journal/month/YYYY-MM.json` holds a month's calendar lines, daily logs and Migrate list, and `journal/quick.json` holds Quick notes. Month needs every day of the month at once, so one file is one read, where a file per day is up to thirty one.
Cost if wrong: every change rewrites a small file (tens of kilobytes at most), and two devices changing the same month at the same moment contend for one file. A lost race is retried against the newer file, so it costs a retry and never a change. Moving to a file per day later is a migration the page would not notice.
**Answer: default accepted, 22 October 2026.** One file per month.
**Superseded the same day by Q18, and the cost line above was wrong.** It said a lost race "costs a retry and never a change". On the real store it cost entries: a shared file read from an old copy and written back loses what came after the copy. The second Preview retest showed it. This note stays on the record.

**Q10. The strip looks back through three earlier months at most.**
Blocks: nothing.
Default built: the first load sends this month, tomorrow's month and up to three earlier months that have a file, and the strip looks only in those. After a weekend, or a week away, it finds the task. After four months away it would not offer a task left open that long.
Cost if wrong: a task left open more than three months ago is still in its old log, open, and is never offered. Raising the number costs one more read per load for each month.
**Answer: default accepted, 22 October 2026.** The strip looks through three earlier months.

**Q11. Weekdays show as three letters, "Thu", not one letter.**
Blocks: nothing. The brief says a weekday letter.
Default built: three letters. One letter is T for Tuesday and Thursday and S for Saturday and Sunday, and a column that cannot tell them apart makes a reader count.
Cost if wrong: a few pixels of width in each Month row. One letter is one line of the page.
**Answer: default accepted, 22 October 2026.** Weekdays are three letters.

**Q12. The page keeps itself current, and only ever redraws.**
Blocks: nothing. The brief does not say how a second device's change reaches the first.
Default built: the page asks again when the window gets focus or becomes visible, every 45 seconds while it is visible, and when the date changes, and it skips the ask while something is being typed or is on its way. It then redraws. It never moves, migrates or drops anything, and never replaces text being typed.
Cost if wrong: two to five small reads each time. With no ask at all, the iPad would show the PC's changes only after a reload.
**Answer: default accepted, 22 October 2026.** The page keeps itself current and only redraws. **Amended the same day**: the Preview found that a redraw from a read older than a save could replace newer data, so a refresh now never replaces a newer copy (Q16).

**Q13. A moved, scheduled or dropped entry cannot be reopened once the ten second Undo has passed.**
Blocks: nothing.
Default built: those entries are fixed, greyed with their arrow or the word Dropped. Undo is the only way back, and it lasts ten seconds and is refused if the copy has been changed. A done task can be reopened by its bullet, at any time.
Cost if wrong: a Drop made by mistake needs the task typed again after ten seconds. A Reopen on a dropped task is one small change to the rules and the page.
**Answer: default accepted, 22 October 2026.** Moved and dropped entries cannot be reopened after the ten second Undo. It now applies to a moved entry that is also hidden behind the moved line (the ruling below).

**Q14. Month opens as near to today as the month allows, not always with today at the top.**
Blocks: nothing.
Default built: Month scrolls so today is as near the top as the list lets it, which is the top for most of the month and the end of the list in its last days, because a month is 31 rows and the list cannot scroll past its end.
Cost if wrong: at the end of a month on a tall window, today sits in the lower half. Blank space under the last date would let it reach the top, at the price of a blank area every other day.
**Answer: default accepted, 22 October 2026.** Month scrolls as near to today as the month allows.

**Q15. Three things only the Preview can show.**
Blocks: the product owner's acceptance.
Default built, and not proved from here: (a) a sixth function deploys on the Vercel project. **Part of this is now shown:** `npm run test:vercel` ran in the build session and passes, so `vercel build` deploys six functions, `journal.func` contains `journal/core.js` from outside `api/`, the static files are exactly the allowlist, and Vercel's own Node wrapper answers the journal's three methods behind the gate. What is not shown is the platform itself; (b) the real Blob store honours the version a write names (`ifMatch` on the etag the read returned), which the tests prove the adapter asks for and cannot prove the store does; (c) Edge offers Install with no service worker. Chromium 141, Edge's engine, reports nothing to stop the install, but Edge itself was not run.
Cost if wrong: (a) the journal returns 404 and a function has to go, probably by folding `api/journal.js` into an existing route; (b) two devices could overwrite each other inside one second, which the entry level version check still catches for the same entry; (c) a do-nothing service worker that never stores anything, a small file.
**Answer: default accepted, 22 October 2026. Outcome of the Preview, reported by the product owner:** (a) the Preview deployed with the journal function and it works; (c) **Edge offered Install with no service worker, and the install worked** (so no service worker is needed); (b) the two device conflict message appeared as designed. The Preview also showed the real store returning reads older than writes, which is the defect fixed under Q16.

## Ruling, 22 October 2026: moved entries are hidden behind a quiet line

Ruled by the product owner on 22 October 2026, after the Preview, and recorded in `CLAUDE.md` section 9e. **Moved entries no longer show in the list.** The original is kept in storage with its arrow and its destination. At the bottom of each panel a quiet line, "N moved", shown only when N is 1 or more, opens and closes the moved entries, greyed with their arrows as before. Closed by default. It replaces the first design, in which a moved entry stayed in the list greyed, and which the Preview showed made a single move read as two. A moved entry is a moved or a scheduled one (the right and the left arrow); a dropped task stays in the list, struck. Month's count chip now counts only what the log shows.

## Waiting

**Q16. A change waits up to about six seconds when the store is behind, and the page retries a change it could not send.**
**Superseded, 22 October 2026, by Q18.** The second Preview retest failed with this in place (entries vanished on a refresh and "Could not save that change" showed), because a month shared by every entry, read and written back, loses a change on a store that can serve an old copy of an overwritten file, however the timing is handled. The waits, the revisions the page told the server it held and the remembered writes are removed for entries and lines. They stay only for Quick notes (Q19), the one file that is still overwritten. The page still sends a change it could not send again as the very same change, three more times, a second and a half, three and five seconds apart.

**Q17. Two devices that make the same change are not a clash.**
Blocks: nothing.
Default built: a change that has already happened is recognised by the revision it started from, so two devices both ticking the same task, both dropping it, both deleting it or both saving the same text end up agreeing without a clash message. Two devices moving the same entry to the same place are no longer a clash either, because the copy's id is now worked out from the entry, its revision and the place, so both moves make the same copy and the second finds it done. Two devices moving it to different places are still a clash, and the copy the loser made is taken back. A different change to the same entry is still refused. This is the price of making a retry safe: a retry and a second device making the same change cannot be told apart.
Cost if wrong: the second device is not told that the first got there first when both wanted the same result. If a message is wanted there, retries would need an id of their own.
**Answer: accepted, 22 October 2026.**

**Q18. One file per entry revision, never overwritten, instead of one file per month. Replaces Q9 (one file per month) and Q16.**
Blocks: nothing. Done on the specification lead's instruction after the second Preview retest, 22 October 2026, with one deviation from the wording that needs the product owner's word.
Instruction followed: one file per entry under `journal/`, named by a stable entry id; an add writes one new file and reads nothing first; a move or Bring forward makes the copy as its own file with an id worked out from the original's id and the destination, so a retry cannot make a second copy; views are built from a listing; Quick notes stay one file with the note rule; the six second wait and the stale-read workarounds are gone for entries; the version check on a single entry stays; a move to a day says so in the message bar with an Open day button.
**The deviation.** The instruction says a move updates the original entry's own file. Built: a change makes the entry's **next revision as a new file** (`<id>.<rev>.json`) and never overwrites the file it started from. Why: Vercel's Blob documentation says an overwritten blob "may take up to 60 seconds to propagate through our cache". An overwrite in place, even of one entry's own file, can therefore be read as it was a minute ago, and an edit or a move made from that old copy is then refused as a clash or applied on old data. That is the failure on the Preview, only smaller. A file that is only ever created has no old copy to read. The create is also the version check, so a conflict is a refused create, with no etag to carry. I could not read the documentation page from the build sandbox (the host is blocked), so the quotation comes from a search of the page and its changelog; the SDK's own comments in `node_modules/@vercel/blob` confirm `useCache` and `allowOverwrite`.
Cost if wrong: more files (one per revision, a few hundred bytes each; a removed entry stays as a small file) and a listing per month; a cold first load of a month reads one file per entry in it, sixteen at a time, and a warm instance reads each file once, because a file's content never changes. If in-place overwrite of one entry's file is wanted after all, the create becomes a conditional overwrite and the 60 seconds of exposure comes back for edits made within a minute of each other on different instances.
**Answer: accepted, 22 October 2026.** Revision files are the product owner's choice.

**Q19. Quick notes are still one overwritten file, and still wait up to about six seconds for the store.**
Blocks: nothing. The instruction says Quick notes stay one file with the note rule.
Default built: exactly that. They are the one thing the journal still overwrites, so they are exposed to an old read as notes is, and they keep the wait and the remembered write for it. On a store a few seconds behind a save through another instance still goes through. On a store a full 60 seconds behind, a save through an instance that did not make the previous one is answered "busy" after about six seconds, with nothing lost and the text still on the page (`journal-stale.test.js` shows both).
Cost if wrong: a Quick notes save can be refused as busy, and a clash message can appear when none is due, in the minute after a save from another device. If that matters, Quick notes become revision files too, with the newest the one shown, and "one file" is given up.
**Answer: accepted for now, 22 October 2026.**

## Assumed, not asked (all accepted, 22 October 2026)

* Panel order on the phone tabs and in the 761 to 999px layout follows the owner's list: Month, Today, Tomorrow, Migrate, Quick notes.
* Desktop columns are equal width. At 1920px each is about 620px, which is wide for a list of short lines. If Month should be narrower, it is one CSS value.
* Migrate is always the current month's list. Browsing another month in Month does not change it.
* The month group in the strip offers only open tasks, never events or notes left on the old list.
