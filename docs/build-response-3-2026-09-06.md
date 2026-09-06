# Build response 3 to the design handoff

From: the build session (Claude Code, marketing site repository)
To: the design session, via James
Date: 6 September 2026
Against: the rewritten `designdecisions.md`
Branch: `claude/silurian-marketing-site-wks2f7`, pull request 86, not merged

The rewritten brief is executed in full. One of its predictions did not survive the render, one line needs a reading confirmed, and one number is three out.

---

## 1. Executed

| Decision | Done |
| --- | --- |
| Paragraph replaced with the final copy, first person plural | Yes, verbatim, byte identical to the brief |
| Closing line back to "Tell us what needs to land, and by when." | Yes, reversed |
| All three page headlines take display at 40px | Yes. `forecast-risk.html` 76 to 40, `privacy.html` 68 to 40 |
| Stat value takes display | Yes. 40px at desktop, unchanged; 26 to 30 on a phone |
| Poster only on a closing accent field | Yes, see the one reading below |
| Wordmark leaves the scale into `--wordmark-size` | Yes |
| The `clamp()` rule written beside the steps in `tokens.css` | Yes, as the first thing in that comment |
| A type step is a layout change, recorded in the repository | Yes, in `tokens.css` and `docs/marketing-site.md` |
| Enforcement, no allowance file, reads the `font` shorthand | Yes, `MarketingSiteTypeScale` |

The control was proved on the real repository, not only in memory: a raw `13px` planted on `index.html` fails the suite, naming the value. Reverted.

Suite: 222 tests, passing. Twelve page and width combinations render with no failed request, no horizontal overflow, Archivo loaded.

## 2. The paragraph does not do what the brief says it does

This is the only place the rewritten brief and the rendered page disagree, and the disagreement is large.

The brief states: 349 characters, 11 lines in the 4fr column, the two lower columns level, "that is intended, not a defect to correct."

Measured at 1440, with the copy in verbatim:

| | Brief | Rendered |
| --- | --- | --- |
| Characters | 349 | **352** |
| Column width | 363.6px | 363.6px, exact |
| Measure | about 32 characters a line | about **50** characters a line |
| Leading | 23.25px | **22.5px** (`line-height: 1.5`, not 1.55) |
| Paragraph lines | 11 | **7** |
| Services list height | 257.1px | **277.5px** |
| Columns level | yes | **no, a 120px gap under the paragraph** |

The capacity model is out by roughly half. At the real measure and leading, levelling the columns needs about 600 characters, not 350. The brief's guidance to "stay under about 280 to keep the bottom edge uneven" would in fact produce four or five lines and a 170px gap.

**I have not touched the copy.** Copy is your call, it is shipped exactly as written, and the uneven bottom edge is the consequence. What I am not willing to do is pad your sentence to make a layout prediction come true.

Three ways out, and the recommendation is the second:

1. Extend the paragraph to about 600 characters. Levelling was the stated intent, and this is the only route to it without moving the layout.
2. **Accept the uneven edge and correct the note in the brief.** The gap does not read as a fault, the eye is drawn to the services list, and 600 characters of company description is a lot to ask a reader to take before they reach what you actually do. This is the cheapest correct answer.
3. Move the column ratio from 4fr and 7fr toward 5fr and 7fr, which widens the paragraph, shortens the list and closes some of the gap without changing a word.

Either way the measure note in item 3 should be rewritten from the real numbers, because the next copy change will be made against it.

## 3. One reading to confirm

The brief says poster is "the closing line in the accent field, that field only" and, in item 4, "poster is used once on the site".

`forecast-risk.html` has its own closing accent field with the same treatment, and its line renders 56px live. I read "that field only" as the closing field wherever it appears, rather than one instance site wide, so both closing lines take poster and both are unchanged from live.

If you meant literally one instance, `forecast-risk.html`'s closing line has no step and I will need one. Say which; it is a one-line change either way.

## 4. A small correction to the brief

The paragraph is 352 characters, not 349. It is byte identical to the text you supplied, so the count in the brief is three out rather than the copy differing. Mentioned only because the same paragraph carries a capacity calculation built on it.

## 5. Not done, correctly

The four `forecast-risk.html` issues are marked as a separate pass and are not in this change: the round contact badge, the status palette exception needing to be written down and scoped, the 12px label step carrying nine roles where panel subtitles and the chart legend want body at 15px, and the mixed voice on that page. The borrowed-credibility note on TimesFM is copy and sits with them.

Flagging one thing about that pass: **moving panel subtitles and the chart legend from label to body reverses part of what was just rolled out on that page**, and the table not dropping to 12px on a phone means the 320px overflow fix comes back into play, since the cell padding was tightened precisely because the table went to 12px. Worth doing those two together rather than in sequence.

## What this session cannot verify

No access to the live site, any preview, or a real device: outbound network is blocked by policy here. Every render is headless Chromium against the branch, which does not reproduce platform control styling at all. `forecast-risk.html` carries a select and a button and this change touched neither, but its round contact badge is in your open list and only a phone will show whether iOS rounds the corners of anything else.
