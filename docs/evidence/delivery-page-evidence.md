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

## Correction, 18 September 2026: the wordmark did not match across pages

The product owner compared the Preview's mastheads and found "Silurian PM"
rendering differently on `index.html` and `delivery.html`. He was right, and the
cause was the home link added to the delivery page's wordmark.

`.mast-bar a:not(.btn)` is the nav link rule. It catches every anchor in the bar,
and the wordmark anchor was one, so the mark inherited the nav link treatment:
the 12px label step instead of the 18px wordmark step, `+0.06em` tracking
instead of `-0.02em`, and `text-transform: uppercase`. The override written with
it set colour and text-decoration only, which fixed the two properties that were
easy to see and left the three that changed the mark's size and case.

Measured on the element the text actually renders in, which matters here: a
first attempt read the anchor on `forecastability.html` and `forecast-risk.html`
rather than the `.brand` span inside it, and reported two false differences. The
probe now walks to the text node's parent.

State before the fix, at 1200px:

| page | renders in | size | weight | tracking | transform |
|---|---|---|---|---|---|
| `index.html` | `p.wordmark` | 18px | 800 | -0.36px | none |
| `delivery.html` | `a` | 12px | 800 | +0.72px | uppercase |
| `privacy.html` | `a.brand-home` | 15px | 800 | normal | none |
| `forecastability.html` | `span.brand` | 18px | 800 | -0.36px | none |
| `forecast-risk.html` | `span.brand` | 18px | 800 | -0.36px | none |

Two pages were wrong, not one, and only one of them was this branch's doing.
`privacy.html` has carried its mark at the body size since before this work: its
header has no `.brand` span to hang the wordmark step on, the way the two Assay
pages do, so the text took `body`'s size and no tracking. Found by comparing all
five pages rather than the two in the screenshots, which is the reason to
measure the whole set rather than the reported pair.

Both fixed. `delivery.html`'s wordmark anchor now inherits font-family, weight,
size and tracking and sets `text-transform: none`, so it is transparent to the
nav link rule rather than merely recoloured. `privacy.html`'s header anchor now
carries `var(--wordmark-size)` and `-0.02em`.

After the fix, all five pages agree at every width tested, 1400, 1200, 900, 716,
480 and 320px: 18px, 18px, 16.2px, 15px, 15px, 15px as the clamp tapers, weight
800, `-0.02em` throughout, `text-transform: none` everywhere, and no horizontal
overflow on any page at any of those widths. Suite 294 tests, OK.

## Addition, 18 September 2026: the section seam under the lead

The delivery page had no rule under its lead line, where `index.html` draws the
2px ink seam above its lower band. Spotted by the product owner in the Preview.
Added with `index.html`'s values rather than values chosen by eye: 56px of air,
`2px solid var(--color-divider)`, then 40px to the first line, collapsing to
`var(--leading)` on both sides below 720px as `index.html`'s does. The first
paragraph's top margin is zeroed so the seam's own padding is the whole gap,
which is how `index.html` seats `.note` at margin 0.

Verified against `index.html` at 1200, 900, 760, 720, 480 and 320px. Every
measured property matches at every width: border `2px solid rgb(63, 61, 59)`,
margin-top and padding-top 56/40px above 720px and 28/28px below it, measured
gaps of 56px from lead to rule and 42px from rule to first line above the
breakpoint, 28px and 30px below it. The 42 and 30 carry the border's own 2px.
The rule spans the content column, 1080px at a 1200px viewport. Suite 294, OK.

## Correction, 18 September 2026: the page needed a route home and had none

Removing the wordmark anchor left `delivery.html` with no way back to the
homepage. The builder flagged the consequence in writing and shipped it anyway,
because the ruling had been sought on a narrow question, whether the wordmark
should be a link, when the question that mattered was whether the page needs a
route home. It does. The product owner said so plainly.

Two routes now, which is what the site's other secondary pages carry:

- The mark is wrapped in an anchor to `index.html` with
  `aria-label="Silurian PM home"`. The anchor takes the mark's grid placement,
  because a wrapper that did not would become an unplaced grid item and push the
  wordmark out of column 2.
- A "Back to Silurian" link at the right of the bar, the same string and place
  `forecastability.html` and `forecast-risk.html` use.

Two things were nearly wrong and are worth recording.

**Specificity.** Written `.mast-bar a.back` rather than `.mast-bar .back`. The
nav link rule is `.mast-bar a:not(.btn)`, which is one element more specific than
two classes and would have won, rendering the link uppercase at the 12px label
step. That is the identical trap that produced the uppercase wordmark earlier the
same day, hit twice now and commented at both sites.

**The wrapped state was looked at, not reasoned about.** With `margin-left: auto`
the link floated right on an orphan line between 851px and 717px, where the bar
wraps but the lockup has not yet collapsed. A screenshot showed it reading as a
stray rather than a second row. `justify-content: space-between` on the bar gives
the same desktop result and starts a wrapped line at the left edge, in line with
the mark. Screenshots taken at 1200, 850, 716, 480 and 320px before the value was
accepted.

## Verification

The mark renders identically on all five pages at 1200px: 18px, weight 800,
`-0.36px`, `text-transform: none`.

Routes to `index.html` per page: `index.html` 0 because it is the homepage,
`delivery.html` 2, `privacy.html` 1, `forecastability.html` 2,
`forecast-risk.html` 2.

The mark link is the first Tab stop on `delivery.html` and takes a visible 2px
`rgb(236, 105, 23)` focus outline. The back link computes 15px, no uppercase,
`rgb(102, 97, 95)`, which is the muted ink the nav links use.

**The breakpoint was remeasured rather than assumed**, because a new flex sibling
in the bar could have changed when the lockup runs out of room. Same method, query
neutralised and the viewport stepped 1300px down to 300px in 1px steps: both pages
still fail at 716px and hold at 717px. The bar wraps the back link instead of
squeezing the lockup, so the value stands and no comment was touched.

No horizontal overflow at 1400, 1200, 850, 800, 717, 716, 600, 480 or 320px.
Suite 294 tests, OK.
