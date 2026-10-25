# Blob usage: open questions and decisions

Branch `blob-usage`, 25 October 2026. Format: what it blocks, the recommended default, cost if wrong.

## Decided by the product owner (25 October 2026)

### D1. The under-20 advanced operations a day target is withdrawn; 73 is accepted on the Pro plan
- The brief asked for a typical day under 20. After the cuts it is 73 (301 before). Accepted, on Pro.
- Why the floor is there (full figures in `docs/evidence/blob-usage/blob-usage-evidence.md`): **writes** are about 22 of the 73, because every change is a new immutable file (an add is one put, an edit one, a move two), and immutable files are what stop two devices overwriting each other, given Vercel's documented 60 second stale window on overwritten blobs. **Opening the journal** is 4 lists (this month's entries, its calendar lines, the spans, and the months that have files, four different prefixes) and a return is 3; five opens and four returns are 32 before any write. The page may not keep journal content on the device, and a summary file written by the server would be an overwritten file.
- What would lower it: a month snapshot or a small database for the journal's current view. Not done. Recommended default: leave it. About 2,200 advanced a month on Pro costs about a cent at five dollars a million.
- Cost if wrong: if the monthly figure ever matters, the snapshot is a design change of its own, with its own brief.
- The budget test (`notes-tests/blob-budget.json`) is set at the measured figures with no slack, so this cannot creep up without a recorded decision.

## Raised by the build (defaults taken; please confirm or overturn)

### Q2. The Vercel pricing page could not be read from the build sandbox
- Blocks: nothing.
- The definitions of advanced and simple operations are quoted from a search summary of Vercel's Blob usage and pricing page, not from the page. Delete is not named on it and is counted on its own line.
- Recommended default: confirm the wording against the live page once. The figures in this branch would only move if delete is billed as advanced (the measured days contain very few deletes).
- Cost if wrong: the day's advanced count could be a handful higher. The rules and the cuts do not change.

### Q3. Every get is counted as a cache miss
- Blocks: nothing.
- The adapters read with `useCache: false`, so every read is a miss in the stand-in and in the figures. Vercel does not count cache hits, so real simple operations may be lower. Advanced operations (puts and lists) are never cached, so those figures are exact for the stand-in.
- Recommended default: treat the simple figures as an upper bound and check the Vercel usage page after a week of use.
- Cost if wrong: none, they only read high.

### Q4. A window that has been open a while shows another device's change later
- Blocks: nothing.
- The journal asks again only when the window is brought back after five minutes. Notes draws the list and label names from memory for five minutes. Another device's change appears at that point, or on a reload. No write is ever made from stale data: every change still names the version it started from and a stale one is refused.
- Recommended default: as built.
- Cost if wrong: a shorter freshness window costs 3 advanced operations a return in the journal and 2 a visit in notes.

### Q5. The morning strip's earlier months are not asked for again on a return
- Blocks: nothing.
- The strip reads last month and earlier months when the journal is opened. A return inside the same day does not read them again. A change to last month's tasks made on another device shows in the strip on the next open, and any action on a stale task is still refused by its version check. A new day always does the full load.
- Recommended default: as built.
- Cost if wrong: one more list a return.

### Q6. An expired or changed session is noticed at the next request, not at the next view switch
- Blocks: nothing.
- A notes view switch inside five minutes now asks the server for nothing, so a session that has ended (cookie expired, password changed) is found by the next request: opening a note, a save, or the list after five minutes. The screen already showed those titles. Sign out itself is unchanged and empties the page at once. The 30 day cookie limit recorded as Q11 in `docs/notes-page-open-questions.md` is unchanged.
- Recommended default: as built.
- Cost if wrong: a shorter list window, or a session check on a view switch (1 advanced operation each).

### Q7. Typing is saved after five seconds, not one
- Blocks: nothing.
- The save happens on a five second pause, thirty seconds at most from the first unsaved key, and at once when the window is hidden or the note is left. A closed tab shows the browser's "leave the page" prompt as before. A crash or a power cut can lose up to five seconds of typing (one second before).
- Recommended default: as built.
- Cost if wrong: a two second pause would save most bursts as two writes.

### Q8. A text save of a note that has labels still reads the label list
- Blocks: nothing.
- A save keeps the note's labels, dropping any that were deleted (the rule in `CLAUDE.md` section 3). That reads the label list, one advanced operation, for a labelled note. An unlabelled note does not. Archive and label changes do the same.
- Recommended default: keep the rule. Dropping stale ids only when labels change would save one operation a save of a labelled note, and would change a documented rule.
- Cost if wrong: one advanced operation per save of a labelled note.

### Q9. Search reads every note
- Blocks: nothing.
- A search is 1 list and a read of every note's text (46 simple operations in the measured store of forty notes, more as notes grow). It is simple operations only, and cache hits are free (Q3).
- Recommended default: as built. A search index file would be an overwritten file.
- Cost if wrong: a store of several hundred notes makes each search several hundred simple operations.

### Q10. A revision number sent by the page is a starting point the server verifies by reading it
- Blocks: nothing.
- The server reads that revision, and the create of the next revision is still the version check. A number that names no revision is ignored and the note's files are listed. Revisions are only ever made one after another, so the newest is never below the one named. Held by `notes-tests/blob-budget.test.js` (a stale hint is refused, a high one is ignored, no revision is skipped).
- Cost if wrong: none found. If a revision file in the middle of a note were damaged, a hinted save would be refused and answered with a plain error, not written over.

### Q11. Old revisions are deleted only when a list is made
- Blocks: nothing.
- A save from a hinted revision makes no listing, so it tidies nothing (it did not before either when the note's files were not listed in that request). Old revisions and orphan text files are removed by the next list, as the rules in section 3 already say ("never the newest, only once a newer one has been listed for over 60 seconds"). A note saved many times without a list in between keeps its revisions until the next list.
- Recommended default: as built. Storage is not billed per file.
- Cost if wrong: none for cost; more files for a while.
