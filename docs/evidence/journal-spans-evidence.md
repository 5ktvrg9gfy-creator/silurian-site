# Journal Month panel: past days and multi-day spans, evidence (23 October 2026)

Branch `journal-spans`, from `main` at `2d41245` (which has the journal-peels handoff merged, confirmed first). Journal only: `notes/` is unchanged, and no new public file. Not merged. Design and plan approved by the product owner; answers in `docs/journal-spans-open-questions.md`.

## What was built

- **Past days.** A date before today has its number, weekday, line and event text in `--notes-muted`. Today and Tomorrow unchanged.
- **Spans.** One entry for a run of days: made by a 24px handle drag (mouse) or the Until button and its menu (keyboard, touch), shown as words on the first day with "to Thu 12", a 2px bar in a lane down the later days with a foot on the last, month boundaries with "continued, to Tue 3", edited once, resized from the last day, deleted by Delete or by clearing the words with Undo.
- **Storage.** `journal/spans/<span id>.<rev>.json`, same JSON format and revision rule as entries, keyed by the id alone, never written into a day or shared file. New ops `spanAdd`, `spanEdit`, `spanRemove` in `journal/core.js`, a `changeSpan` path in the API, `readSpan`, `createSpan` and `spans` in the store, and a `spans` list in the months and home answers.

## Colours (correction A)

The design text's values were stale: `--notes-muted` is already `#66615f`, the dark Month hover is `#302d2b`, there is no yellow theme, and `--notes-text` does not exist (the page uses `--notes-ink`). Every text pair was measured as drawn on the live page, in light and dark, on Month rows (past, ordinary, today, tomorrow, a hovered past date) and from the live variables on Month, its hover and selected fills, the three Peels and Quick notes. 202 pairs, all in `docs/evidence/journal/month-contrast-ratios.txt`. **No colour was changed**, because no pair the page uses is under 4.5:1 (text) or 3:1 (icons).

| Pair as drawn | Light | Dark |
|---|---|---|
| Past day number, weekday, line, events (muted on the Month panel) | 5.23 | 5.91 |
| A past day's date button hovered (muted on the hover fill) | 5.01 | 4.81 |
| Ordinary day: number (strong), weekday (muted), line and events (ink) | 15.05, 5.23, 11.76 | 15.05, 5.91, 12.68 |
| Today row (selected fill): number, weekday, line, "Today" | 12.91, 12.91, 10.08, 12.91 | 10.25, 10.25, 8.64, 10.25 |
| Tomorrow row (hover fill): number, weekday, line, "Tomorrow" | 14.41, 11.25, 11.25, 14.41 | 12.26, 10.33, 10.33, 12.26 |
| Count chip | 11.76 | 12.68 |

Pairs under the floor exist and the page never sets them: muted on a selected fill (4.49 light and 4.02 dark on Month, 3.51 to 4.15 on the Peels) and muted on the pink Peel's hover fill (4.22). That is why the Today row's "to Thu 12" is ink and why a hovered Peel row goes to ink, both existing rules. Bars were checked at 3:1: ink and muted on the panel, ink and strong on the hover fill. The pill is strong on the page ground, over 14:1.

## Runs

| Run | Result |
|---|---|
| `python -m unittest discover -s tests` in `forecast-app/` | 431 pass (418 before: 13 added in `JournalPastDaysAndSpans`; two existing tests updated for the fourteen icons and the script-set variables) |
| `npm test` | 261 pass (233 before: 28 added in `notes-tests/journal-spans.test.js`) |
| `npm run test:vercel` | 2 pass |
| `node docs/evidence/journal/browser-check-journal.mjs` | 404 of 404 pass, twice in a row (318 before: sections 21 and 22 added) |
| `node docs/evidence/journal/browser-check-journal-lag.mjs` | 33 of 33 pass (23 before: the span phase added) |
| `python docs/evidence/journal/breakages-spans.py` | 29 deliberate breaks of the new rules; 28 caught first time, 1 missed and closed (below), so 29 of 29 caught. Output: `breakages-spans-run.txt` and `breakages-spans-rerun.txt` |

The Node tests include the 60 second stale stand-in (an overwritten file read as it was for 60 seconds, a file made in the last 60 seconds left out of a listing): add, edit, resize and delete a second apart, the same add sent twice, a view read during the lag, every change to an instance that remembers nothing, and two hundred random changes (some sent twice, each to a different instance) checked against a model written by hand. The browser lag check does the same in real time with the window asking again every half second, then waits past 60 seconds and looks again.

**The miss, kept on the record.** The first proof run missed one break: a span file in another version of the format was read as if it were fine. The test I had used a file with no other fields, so it was refused for the wrong reason. I added a case with an otherwise valid file at version 2 and re-ran that break; it is now caught.

The browser check covers: past days and 202 measured pairs; the handle drag with the pill, the dashed bar, Esc, release on the first day; resize up and down; an entry drag onto a spanned date line still takes the selected fill and moves, leaving the span untouched, and a handle drag moves no entry; the Until menu with 44px rows, arrows, the ticked end, Later date, Just this day; the iPad case with the Until button always visible and no handle; the month end both ways; edit once and see it in both months; select by the bar then Delete; clearing the words; Undo making a new span; lanes 0, 1, 2 with a fourth as a normal line; two devices with the plain message, typed words kept and Reload; a lost answer retried making one span).

## Found while building

- A refused span change must not take the other device's span into the page, or Reload finds nothing new and the typed words stay. It does as an entry does: the screen goes back to what the server last confirmed, and Reload fetches the rest.
- Focus on the Until button was lost when the row was drawn again after the first save, and again on closing the menu (the button was hidden while the row lost focus). Both fixed and held by the keyboard check.
- A first-day row showed a make handle, which would have started a span inside a span. The handle is now only on a plain line or on a span's last day.

## Not run

- A finger on a real iPad (the browser check emulates touch and a coarse pointer at 1024px and measures the Until button and menu rows at 44px).
- The Vercel Preview, and Production.

## Preview steps for the product owner

On the PC (Edge) at 1280px or wider, signed in:
1. **Past days.** In Month the days before today are grey: number, weekday, line and any event text. Today and Tomorrow look as before. Switch to dark and check the same.
2. **Make a span by mouse.** Type "Possible Germany" on a date a few days ahead. Hover the line: a small down-arrow-to-line handle appears at the right. Drag it down three rows: the rows take a grey fill, a dashed bar and a pill "Until Thu ..." follow you. Press Esc while holding: nothing is made. Drag again and let go on the same row: nothing is made. Drag down and let go: the words stay on the first day with "to Thu 12" after them and a bar runs down the later days, ending in a short foot.
3. **Keyboard.** Click into another date's line, type words, press Tab: an "Until" button with a calendar icon appears. Enter opens a menu: Just this day, seven days, Later date. Arrow down, Enter: the span is made. Open it again: the current end is ticked. Choose "Later date..." and pick a date in the next month.
4. **Resize.** Hover the last day of a span: the handle is there. Drag up to shorten, down to lengthen. Drag it all the way up to the first day: the span goes and the line stays.
5. **Edit once.** Click the words on the first day and change them. Every day shows the change.
6. **Across the month end.** Make a span from the 29th to the 3rd of next month. In this month the bar runs off the end with no foot. Go to next month: the words are on the 1st with "continued, to Tue 3" and the bar from the top with a foot on the 3rd. Edit the words there, then come back: the change is here too.
7. **Delete with Undo.** Click the bar on a later day: the words are selected on the first day. Press Delete: the span goes and the message bar says "Span deleted." with Undo. Press Undo: the span is back. Clear the words and press Enter: the same message.
8. **An entry drag still works.** Add a task in Today and drag it onto a date line that has a span running through it: the row takes the highlight and the task moves there. The span is unchanged.
9. **Three overlapping spans** sit side by side 14px apart, and a fourth is a normal line with its range and no bar.
10. **iPad (portrait and landscape).** There is no drag handle. A line with words has an "Until" button, 44px tall, always showing. Tap it, then a day: the span is made. Tap the words on the first day and clear them: the span goes with Undo.
11. **Two devices.** Open the journal on the PC and the iPad. Change a span's words on the PC. On the iPad, still showing the old words, change them and press Enter: the iPad shows the plain message with Reload and keeps what you typed. Reload: it shows the PC's words, and there is still only one span.
