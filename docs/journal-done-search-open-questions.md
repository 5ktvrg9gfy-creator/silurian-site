# Journal: Done list, Quick notes bullets and calendar search, open questions

Branch `journal-done-search`, 28 October 2026. Each question says what it blocks, the default that was built, and the cost if the default is wrong. None blocks the Preview.

## Q1. Which month a completed task belongs to

**Blocks:** what "one month at a time" means in the Done list.
**Default built:** the month of the London date the tick was written. A task from the 28th ticked on 2 November is in November, under 2 November, with "Log: Wed 28 Oct" beside it.
**Cost if wrong:** if you meant the month of the log, the same task would be in October. It is a change to which months the server lists and to `core.doneGroups`, with no change to stored data.

## Q2. Where the tick time comes from

**Blocks:** nothing, but it is a decision about stored data.
**Default built:** the time the storage listing gives for the tick revision's file (`uploadedAt`). No stored file changed and no version number moved, so every task ticked before this change has a date. Entry revision files are never overwritten, so that time is the time of that revision.
**Cost if wrong:** if the listing ever omits the time, a task shows under "Date not recorded" in the month of its log. A task ticked in the last minute can be missing from the list for up to a minute, the same lag the rest of the journal's storage has (CLAUDE.md section 3).

## Q3. How far from its log a tick can be and still be listed

**Blocks:** the cost of opening the Done list.
**Default built:** a month shows tasks ticked in it whose log is in that month or the month before. That is two listings (2 advanced operations). A task ticked in a month before its log's month (ticking ahead into next month) or more than a month after its log's month (opening an old date in Month and ticking there) is not listed.
**Cost if wrong:** a ticked task missing from every month. Adding the month after costs 1 more advanced operation for each open and each month change. Covering any distance means listing every month, which grows with the journal.

## Q4. What the search covers

**Blocks:** which results appear.
**Default built:** calendar lines, spans and entries in every month. Not searched: Quick notes (no date to jump to), removed entries, spans that were removed, and entries that were moved (their copy is where they went, so a word is not found twice). A dropped task is searched, because it stays in its list. Source names: Calendar, Span, Today, Tomorrow, Month (an entry in any other date's log) and Migrate.
**Cost if wrong:** results the other way round are a change in `core.searchCalendar` only.

## Q5. A Migrate result in another month

**Blocks:** what clicking that result does.
**Default built:** Month goes to that month and a Migrate panel is shown only for this month's list. For another month there is no panel to open, so Month shows that month and nothing opens. Its date line reads, for example, "October 2026".
**Cost if wrong:** the other months' Migrate lists would need a place to be opened.

## Q6. What the first search costs

**Blocks:** usage as the journal grows.
**Default built:** the first search in a window lists the entry, line and span files once (3 advanced operations on the measured seed, a page more for every thousand files) and reads each entry's and line's newest file except in the months the page already holds (12 simple operations on the seed). The page keeps the result for five minutes, so the next search asks nothing. The cost grows with the number of entries. A year of use is a few thousand reads for the first search of a window.
**Cost if wrong:** the floor is one read for every entry that exists, because the words are in the files and nowhere else. Lowering it needs a stored index, which is an overwritten file, the thing the immutable design avoids.

## Q7. What the bullet button acts on

**Blocks:** nothing.
**Default built:** the line the caret is in. With several lines selected it acts on the line where the selection started.
**Cost if wrong:** a change in `toggleBulletLine` to walk every selected line.

## Q8. The clear mark in the search field

**Blocks:** nothing.
**Default built:** the browser's own clear mark, which is the browser's colour (blue in Chrome). Escape and deleting the text clear the field too. A drawn mark in the page's own colours would add a control and an icon.
**Cost if wrong:** one more icon and one more button.

## Q9. The Production usage result for blob-usage

**Blocks:** merging the `blob-usage-handoff` branch.
**What happened:** the brief asked for the Production usage result sent earlier to be recorded and that branch merged. The result was not in this session or in the repository, so it was not recorded and the branch was not merged. Nothing was invented.
**Default:** send the figures (the advanced and simple operations the Vercel Blob usage page shows after a day on the live site) and they go into `PROJECT_HANDOFF.md` and `docs/evidence/blob-usage/blob-usage-evidence.md`, then the branch is merged by pull request.
**Cost if wrong:** none beyond the wait. The handoff branch changes one line that records the merge commit of pull request 164.
