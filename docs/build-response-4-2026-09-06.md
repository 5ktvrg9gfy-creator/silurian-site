# Build response 4 to the design handoff

From: the build session (Claude Code, marketing site repository)
To: the design session, via James
Date: 6 September 2026
Against: the third revision of `designdecisions.md`
Branch: `claude/silurian-marketing-site-wks2f7`, pull request 88

Built. One number in the brief is still stale, one page is left as an exception on purpose, and one defect was introduced and caught inside the change.

---

## 1. Executed

**The sub-note.** "Work is taken directly, not brokered." sits under the paragraph at 15px in `--color-text` at full ink, `margin-top: 22px`, with no rule above it. Measured: the paragraph bottom is at 451.7px, the sub-note top at 473.7px, exactly the 22px specified. Your reasoning for no rule is recorded in the CSS next to it, so nobody adds one back later thinking it was an omission.

**The single-link brand block.** `privacy.html` and `forecast-risk.html` now carry the mark and the wordmark inside one anchor to `index.html`. Verified by clicking each half in a browser and confirming where it lands, rather than by reading the markup: on both pages, the mark goes home and the wordmark goes home.

**The round badges.** Nothing to do. They were already round and stay round. Recorded in `docs/marketing-site.md` as the site's one agreed radius exception, with the note that it was raised and withdrawn, so the next reader does not raise it a third time.

Suite: 222 tests, passing. Twelve page and width combinations render with no failed request, no horizontal overflow, Archivo loaded.

## 2. A defect I introduced, caught before it shipped

Adding the sub-note put a **third child into a two-column grid**. CSS grid put it in column two and pushed the services list down into column one, under the paragraph.

Nothing caught this except measurement. The suite passed. No page overflowed. The page still rendered, and at a glance it looked like a page. It was found by reading back the position and width of each element, where the services list came back 363.6px wide in the left column instead of 636.4px in the right.

Fixed by wrapping the paragraph and its sub-note as one grid child. Recorded in the repository as a general rule: count the children before adding one to a grid with a fixed template, and check positions rather than the absence of errors.

## 3. The left column arithmetic is still out

The brief now says the paragraph plus the sub-note leave the left column "about 37px short of the list, which is the intended uneven edge."

Measured at 1440: **75.5px short**, roughly double.

The cause is the same stale number as last time. The brief carries the services list at 257.1px tall. It is **277.5px**. The measure and leading in the current note are right, at about 50 characters and 22.5px, so that part is fixed; the list height is the piece that did not get corrected.

The intent holds either way. The edge is uneven, the list is the heavier side, and it reads as deliberate. Only the number in the note is wrong, and it matters because the next copy change will be sized against it. Suggested wording: **the left column finishes about 75px above the list bottom.**

## 4. One thing left as an exception, deliberately

The constraint says the brand block is one link and describes `index.html` as already being that. **It is not a link at all** on the homepage: the mark and the wordmark sit in a plain `<div>`.

I have not changed it. A link from the homepage to itself is standard and harmless, but it is also a change to a page the constraint did not name, and the two pages you did name are now consistent. Say whether the homepage brand should self-link and it is a two-line change.

## 5. Still open, not started

The four `forecast-risk.html` items remain a separate pass, untouched: the status palette to be written down as an exception scoped to that page, the 12px label step carrying nine roles where the panel subtitles and chart legend want body at 15px, the mixed voice, and the borrowed-credibility notice on TimesFM.

The warning from response 3 still stands on that pass: moving the panel subtitles and chart legend back to 15px partly reverses the rollout on that page, and stopping the table dropping to 12px on a phone re-opens the 320px overflow the cell padding was tightened to fix. Those two are one job, not two.

The detail lines under domains 1 and 2 still want James's own words.

## What this session cannot verify

No access to the live site, any preview, or a real device. Every render is headless Chromium against the branch, which does not reproduce platform control styling at all. The brand block is now an anchor wrapping an image on two pages, and how a phone treats the tap target is not something this environment can answer.
