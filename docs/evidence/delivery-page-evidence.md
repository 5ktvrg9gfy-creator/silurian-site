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
