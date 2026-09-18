# Evidence: delivery page and wordmark rename

Built 18 September 2026, from `docs/change-wordmark-silurian-pm.md` and
`docs/change-delivery-page.md`, both committed in the same change.

## What was run

Full suite from `forecast-app/`, `python -m unittest discover -s tests`.
294 tests before the change, 294 after, OK both times. The count is unchanged
because no test was added: `delivery.html` was added to `EXPECTED_PAGES` in
`tests/test_marketing_site_tokens.py`, which is what
`test_the_page_list_is_pinned` instructs a new page to do.

Rendered checks in headless Chromium 1194 against a local static server, so
the Archivo variable font was actually loaded before anything was measured.
`document.fonts.status === 'loaded'` was awaited on every page.

## The 521px breakpoint moved to 804px

Measured, not chosen. Method: temporary copies of `index.html` and
`delivery.html` with the breakpoint media query neutralised, so the desktop
lockup could be measured at every width; viewport stepped 1300px down to 300px
in 1px steps; at each width the subline, the wordmark and each nav label were
measured for line count by counting the client rects of a Range over their text
nodes, and the two nav links compared for equal top offsets.

Result, identical on both pages:

- 805px: subline 1 line, wordmark 1 line, both nav labels 1 line, nav links on
  one line. Holds.
- 804px: nav links no longer on one line. First failure.

The binding constraint changed. The old 521px was the width at which the
subline broke to two lines, which is what failed first when the lockup was
three strings and one link. With two service links in the nav, the pair stops
fitting at 804px while the subline still holds one line far below that, so the
subline is no longer what sets the number.

## Verification, with observation counts

34 observations across the two pages, on the committed files with the
breakpoint live. Every one held.

Above the breakpoint, at 1400, 1200, 1000, 900, 850 and 805px on both pages:
`.mast-rule` rendered at 1px, the nav's `border-left` at 1px solid
`rgb(63, 61, 59)` which is `--color-divider` at full ink, `padding-left` 16px,
nav links on one line, subline on one line, no horizontal overflow.

At and below, at 804, 803, 700, 600, 522, 521, 480, 400, 360 and 320px on both
pages: `.mast-rule` computed `display: none` and the nav's `border-left`
computed `0px` with `padding-left: 0px`. Both hairlines disappear together, at
the same width, which is what the changeset asked for. No horizontal overflow
at any width: `documentElement.scrollWidth` equalled the viewport width at
every step down to 320px.

The subline goes to two lines at 320px on both pages. That is pre-existing and
intended: `.mast-subline` carries no `white-space: nowrap` precisely so it wraps
rather than pushing the bar past a 320px screen.

Attributes, read at 1200px on both pages: `aria-label="Services"`; nav links in
order `Programme and Project Delivery` then `AI Forecast Diagnostic`, pointing
at `delivery.html` and `forecastability.html`. On `index.html` neither link
carries `aria-current` and both compute `rgb(102, 97, 95)`, the muted ink. On
`delivery.html` the delivery link carries `aria-current="location"`, computes
`rgb(63, 61, 59)` and is underlined at a 5px offset, and the second link
computes the muted ink with `text-decoration-line: none`.

## Radius

Rendered scan, every element on the page read through `getComputedStyle` and
all four corners checked, which covers the browser-default blind spot the
declaration scan in `MarketingSiteKeepsZeroRadius` documents and cannot reach.

- `delivery.html`: 78 elements read, 0 with a non-zero radius.
- `index.html`: 64 elements read, 2 with a non-zero radius, both the approved
  contact badges in the closing field. Unchanged by this work.

`delivery.html` declares no radius at all, so `APPROVED_ROUND_SELECTORS` is
untouched and still holds exactly three entries.

## Copy

The nine typical assignments, the five numbered items with their headings and
paragraphs, the H1, the lead and the two approach paragraphs were compared
block by block against the changeset text after stripping tags. 33 blocks,
all matching, nothing extra.

## What was not run

No Preview and no Production check. Nothing was deployed as part of this work,
so there is no Vercel evidence to record and none is claimed. `PROJECT_HANDOFF.md`
is not updated for the same reason: it records actual merge and deployment
evidence, and there is none yet.

The one route to `delivery.html` is the masthead nav on `index.html`. Confirmed
by grep across every page: two matches in markup, the link on `index.html` and
the self-link on `delivery.html`, and nothing else.

## Correction, 18 September 2026: the breakpoint is 716px, not 804px

The 804px recorded above was correct when it was measured and is no longer the
value in the code. The nav label "Programme and Project Delivery" was shortened
to "Project Management" after this evidence was written, which moved what fails
first, so the breakpoint was remeasured and both pages now carry 716px.

This section is appended rather than edited into the text above, because the
804px measurement was not wrong: it was right about a lockup that has since
changed. Overwriting it would hide that the number tracks the label strings,
which is the thing a reader needs to know before changing a label again.

Same method as above: breakpoint media query neutralised in temporary copies,
headless Chromium 1194, Archivo loaded and awaited, viewport stepped 1300px down
to 300px in 1px steps. Both pages fail at 716px and both hold at 717px,
identically, and the failure is still the two nav links ceasing to fit on one
line rather than the subline wrapping.

Verified on the committed files with the new query live, 30 observations across
the two pages, all holding: at 1400, 1000, 805, 804, 760, 718 and 717px the
`.mast-rule` renders at 1px and the nav `border-left` at 1px solid
`rgb(63, 61, 59)` with `padding-left` 16px, nav on one line; at 716, 715, 600,
521, 480, 400, 360 and 320px both compute away together, `display: none` and
`0px`, with no horizontal overflow at any width. The 804px and 760px readings
are the point of the change: those widths now keep the desktop lockup, where the
old value sent them to the stacked form about 88px early.

The breakpoint has moved twice on this branch, 521px to 804px to 716px, each
time because a string in the lockup changed. Remeasure it whenever one does.

## Addition, 18 September 2026: the closing accent field on delivery.html

The product owner found the orange contact band missing from `delivery.html` in
the Preview and asked what had hidden it. Nothing had. It was never built: the
changeset's verbatim copy ends at "Assignments are built around clear outcomes",
with no closing-field headline, and this evidence file's own "Not built" note
recorded the absence too quietly to be read as deliberate. Investigated and
reported before anything was changed, which is what the record should show.

Findings from that investigation, each held:

- `#contact`, `.close`, `.contact-badge` and the closing line appeared zero
  times in `delivery.html` in all three commits on this branch. Nothing deleted
  it.
- Nothing hid it on `index.html` at any width. Read at 1400, 1200, 900, 760,
  717, 716, 600, 480, 360 and 320px: `display: block`, `visibility: visible`,
  `opacity: 1`, background `rgb(236, 105, 23)`, both badges present at every one.
- The 716px breakpoint commit touched nothing outside the masthead. With CSS
  comments stripped, both files hold the same non-comment line count before and
  after, 254 on `index.html` and 188 on `delivery.html`, and exactly one line
  differs per page, the `@media` prelude. Every other change in that commit was
  comment prose.

He then ruled that the delivery page reuses the homepage's closing field and its
headline verbatim, rather than taking a second line written for it.

## What the addition required beyond the markup

The field is `index.html`'s rules carried across unchanged, plus the `.btn` base
the badges are built on and the `--radius-md` token that `.btn` reads. Two
controls had to move with it, and both are recorded rather than quietly widened.

`APPROVED_ROUND_SELECTORS` in `tests/test_marketing_site_tokens.py` gained
`("delivery.html", ".close .contact-badge")`. That list is asserted as an exact
set, so a fourth rounded rule fails the suite until it is added, which is the
behaviour the test wants. CLAUDE.md section 9a was amended first, as that test's
own message instructs: the documented exception is now four rules and six
rendered elements, was three and four.

The six is measured, not counted by hand. Every element on every page read
through `getComputedStyle` with all four corners checked: `index.html` 64
elements read and 2 rounded, `delivery.html` 90 and 2, `forecast-risk.html` 173
and 1, `forecastability.html` 174 and 1, `privacy.html` 41 and 0.

**The widened list was proved still able to fail.** `border-radius: 6px` planted
on `.gets li` in `delivery.html` failed two tests, naming the page, the selector
and the value, and the exact-set test named `('delivery.html', '.gets li')` as
the item it did not expect. So the new entry permits the badge selector and not
the page. Reverted, and the 40 site tests pass again.

A stale comment was corrected in passing. `index.html`'s `--radius-md` comment
said the token was "declared and read on this page only", which the delivery
page's closing field made untrue the moment it was added. It now names both
pages and records what it used to say.

## Rendered verification of the field

`delivery.html` and `index.html` read at 1400, 1200, 760, 716, 480 and 320px.
Every measured property matches between the two pages at every width: background
`rgb(236, 105, 23)`, section height 292, 282, 253, 253, 253 and 289px
respectively, headline computing 56px at 1400px and tapering to 34px through the
poster clamp, headline text "Tell us what needs to land, and by when." reversed
to white, two badges at 40x40 with a 50% radius, and the same two `aria-label`
values and hrefs. Body child order is identical on both, `header`, `div`,
`section#contact`, `div`. The footer's top equals the field's bottom at every
width on both pages, so the field seats against the footer with no gap and no
overlap.

Poster is spent once on `delivery.html`, on this headline, which is the page's
loudest element and the same placement `index.html` uses.
