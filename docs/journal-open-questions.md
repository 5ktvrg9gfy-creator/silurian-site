# Journal: open questions

Each: what it blocks, the default the design brief uses, and the cost if wrong. Brief: `docs/briefs/journal-design-brief.md`. Answers by the product owner are recorded under each question. **One waiting: Q8.**

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

## Waiting

**Q8. What exactly does the Month line show as "that date's events"?**
Blocks: Month, and the aggregate read.
Default built: the line shows the calendar line's own text, then the event entries (circle bullets) in that date's log, as read only text. Tasks and notes in the log do not show on the line, and a count chip says how many entries the log holds. Editing an event is done in that date's log.
Cost if wrong: if "events" meant the line text only, delete the event part of the line and the date's log is reached through the chip and the date number alone. If it meant everything in that date's log, the line gets long fast and would need to give way to a count. Either is a change to one row's rendering and one field in the month read, not to storage.

## Assumed, not asked

* Panel order on the phone tabs and in the 761 to 999px layout follows the owner's list: Month, Today, Tomorrow, Migrate, Quick notes.
* Desktop columns are equal width. At 1920px each is about 620px, which is wide for a list of short lines. If Month should be narrower, it is one CSS value.
* Migrate is always the current month's list. Browsing another month in Month does not change it.
* The month group in the strip offers only open tasks, never events or notes left on the old list.
