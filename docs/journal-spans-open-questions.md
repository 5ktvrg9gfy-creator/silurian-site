# Journal Month panel: past days and multi-day spans, open questions

Branch `journal-spans`, 23 October 2026. Format: what it blocks, the recommended default, cost if wrong.

## Answered by the product owner before the build (23 October 2026)

- **Q1. What happens to the old line when its text becomes a span, and the reverse?** Default accepted. The span is made first, then the line is cleared. "Just this day" writes the line back first, then removes the span. A failure leaves the words twice, never lost, and the page shows them once when the text matches.
- **Q2. A longest span?** 366 days, accepted.
- **Q3. A span may start on a past day, shown muted?** Yes.
- **Q4. Where does "Span deleted. Undo" appear?** In the existing message bar, accepted.
- **Plan corrections accepted:** Month rows show event text and not circles, so the event text is muted on past days; the dashed preview bar is a repeating gradient, because a dashed border would break the 1px border rule.

## Raised by the build (defaults taken, none blocks anything; please confirm or overturn)

### Q5. Two or more spans whose words belong on the same row
- Blocks: nothing.
- What happens: a day has one line editor. When two spans start on the same day (made on two devices), or two spans run into the same 1st of a month, the first (by start, then id) is the editable line and the others are shown after it as muted text with their range, for example "Away (to Tue 3)". To edit one of the others, click its bar: the page goes to the month it starts in, where it has its own row if it is alone there.
- Recommended default: as built. It is rare, and nothing is hidden or lost.
- Cost if wrong: a row that can hold several editors, which means several lines of text in a 36px row.

### Q6. The drag handle stops at the last day of the month on screen
- Blocks: nothing.
- What happens: dragging cannot go past the end of the viewed month, and on a span the handle is on its last day, so a span that ends in a later month is resized from that month. The Until menu's "Later date" reaches any day up to 366 days after the first.
- Recommended default: as built.
- Cost if wrong: a drag that carries the list into the next month, with the scrolling and the month change that needs.

### Q7. Touch has no drag handle and no bar to tap
- Blocks: nothing.
- What happens: the handle is hidden under a coarse pointer. A finger makes and changes a span with the Until button and ends it by clearing the words or choosing "Just this day". The bar is 14px wide, which is a mouse target, and a tap on it still selects the span.
- Recommended default: as built. The design asked for the Until button as the touch route.
- Cost if wrong: a 44px bar target, which needs the lanes to be 44px apart.

### Q8. "Just this day" when the first day already has a different line
- Blocks: nothing.
- What happens: the two are joined with "; " when the result fits in 200 characters. When it does not, nothing changes and the message bar says "That day already has a line, and both together are too long. Shorten the line first." A line the span cleared is empty, so this only happens when a line was typed on a spanned first day from another device.
- Recommended default: as built, because it never drops words.
- Cost if wrong: a choice offered each time.

### Q9. Each load lists every span
- Blocks: nothing.
- What happens: a span is keyed by its id alone and can cover any run of months, so there is no month to list by. Each load lists the `journal/spans/` prefix once, reads the highest revision of each span, and sends the ones that touch the months asked for. That is fine for the tens of spans a person keeps (read files are kept by path for the life of the instance). It is the first thing to change if spans reach the hundreds.
- Recommended default: as built, with this note.
- Cost if wrong: an index file, which would be the one file that is overwritten, so it would need the revision treatment.

### Q10. The design text was stale on colours
- Blocks: nothing. Recorded because the brief said to.
- What was found: `--notes-muted` is already `#66615f` (4.12 was the old `#77716e`), the dark Month hover is `#302d2b` (4.81 against muted), there is no yellow theme and `--notes-text` does not exist (the page's `--notes-ink` is used). Every pair measured as drawn is at or over its floor, so no colour was changed. See `docs/evidence/journal/month-contrast-ratios.txt`.

**Q5 to Q10: defaults accepted by the product owner, 23 October 2026**, after the Preview. Waiting for an answer: 0.
