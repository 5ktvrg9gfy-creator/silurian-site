# Journal: open questions

Each: what it blocks, the default the design brief uses, and the cost if wrong. Brief: `docs/briefs/journal-design-brief.md`. Seven waiting.

**Q1. Is a calendar line the same thing as a day's log?**
Blocks: Month, and how a scheduled entry shows.
Default: no. A calendar line is one line of free text per date, for things that happen on that date. A day's log is the list of entries, and Month shows a count chip when a date has entries. Scheduling to a date puts the copy in that date's log.
Cost if wrong: if James writes tasks on the date line and expects them in Today, Today needs to show that date's calendar line at the top. Small change, but it changes the data shape before anything is saved, so it is cheap now and a migration later.

**Q2. After a weekend, what does the morning strip show?**
Blocks: section 5.
Default: the most recent earlier day with open tasks, one day at a time, with its date in the heading. Friday's tasks are not lost on Monday.
Cost if wrong: if only strictly yesterday is wanted, Friday's open tasks are never offered again and sit open for ever in Friday's log.

**Q3. End of month: do open Migrate tasks move to next month?**
Blocks: nothing in this build.
Default: not built. When wanted, the next month's Migrate opens with the same Bring forward or Drop strip, fed from the previous month.
Cost if wrong: James does it by hand with the Migrate button on each task, which exists today in Today and Tomorrow only. Worth asking whether this is wanted in the first release.

**Q4. Does a done task stay put?**
Blocks: section 2.
Default: yes. Done tasks stay where they are, crossed and struck, in the order logged.
Cost if wrong: a long day looks cluttered. Sinking done tasks to the bottom is a sort, and a list that reorders under a tap is worse than a long one.

**Q5. Conflicts: operations by entry, not refuse and keep text.**
Blocks: the API.
Default: entry level changes merge on the server, because the same lists are open on two devices all day. Quick notes, being one block of text, keeps the notes rule.
Cost if wrong: if two devices edit the same entry's text at the same moment, last write wins on that one entry. If the owner would rather be refused, every cross device edit will meet a 409.

**Q6. Offline.**
Blocks: section 7.
Default: online only, no service worker. Opening the app with no network shows the browser's own error.
Cost if wrong: a flight or a train loses the sticky notes he has now. Offline with a queue is a real build, a service worker, local copies and a conflict story, and it would end the private no-store rule in practice. Not recommended in the first release.

**Q7. The accent focus outline is 2.73:1 against the panel in light mode.**
Blocks: nothing. Inherited from 9c.
Default: unchanged, same outline as notes.
Cost if wrong: a keyboard user in light mode sees a ring slightly under the 3:1 non-text guideline on panel fill. Raising it is a 9c decision for the whole notes look, so it is raised here, not changed for one page.

**Also assumed, not asked.** The panel order in section 1 follows the owner's list, Month, Today, Tomorrow, Migrate, Quick notes. His current sticky layout was not shown. If it differs, the order is one CSS change.
