# Assay theme, pass 2 evidence

Built 16 September 2026 from rulings 6 to 9 and the pass 2 scope. Base: `main`
at `cfb6ffc`, which is PR 104 merged.

Two files changed: `forecast-app/static/index.html` and
`forecast-app/tests/test_workspace_ui.py`.

**Pass 2 is the adding half.** Radius, one elevation, the header fill and the
type scale.

---

## 1. No control file moved

No fixture, no `expected_*.json`, no golden file, no schema. No version bump
was due. **278 tests pass, up from 273.** Five added, all ruling 9.

## 2. Cards: 4px and the one elevation step

The definition applied, not a list guessed at: a bounded panel holding one
kind of output, that could be moved elsewhere without breaking what surrounds
it. **Thirteen selectors**, each with a fill and padding of its own:

`.quality-hero`, `.validation-panel`, `.provenance`, `.bundle-view`,
`.chart-card`, `.analysis-panel`, `.quality-statement`, `.quality-method`,
`.quality-exception`, `.bundle-warning`, `.routing-headline`, `.ai-banner`,
`.risk`.

Read back out of the browser rather than asserted: all thirteen compute
`4px` and one elevation step. Every radius on the page is 4px or 0px, and
`card_elevation_steps` returns exactly one distinct value.

### Left flat and listed, per ruling 2

| Left flat | Why |
| --- | --- |
| `.workspace-panel`, the eight tab panels | **Named as cards in ruling 2, and left flat anyway.** They have no bounded surface: no fill, no border, `padding:28px 0`. A radius on a transparent box does nothing and an elevation draws a shadow around nothing, so making them cards means choosing a fill, and pass 2 authorises radius and elevation, not fills. Both candidate fills are wrong: `--surface` merges with the tables inside them, and `--paper` is lighter than the page, which breaks section 9's panels-darker-than-the-page rule. **This is a decision, not a mechanical step, and it needs one line from the product owner.** |
| `form` | A surface the user acts on, which is ruling 3's other category. Section 9a permits 4px on cards, buttons and inputs, and pass 2's scope says cards |
| `.quality-summary` | A three-up strip that divides rather than holds one output |
| `table`, `.classification-matrix`, `.routing-split`, `.matrix-cell`, `.routing-split>div` | Grids and their cells. Rounding a grid's corners clips the new header fill |
| `.line-detail>td` | A row expansion. Not movable: it belongs to the row above it |
| `.resolution-recorded`, `.resolution-form .consequence` | Inline callouts inside a form |
| `.run-context`, `.evidence`, the badges and chips | Not panels |

**Buttons and inputs are not in pass 2 either.** Section 9a permits them 4px.
Pass 2's scope says cards, and says "and nothing else". A 4px card full of 0px
inputs will read as unfinished, and that is Q15.

## 3. Seams, under rulings 3, 7 and 8

**23 selectors dropped to 1px.** The 20 dividers from the pass 1 count, plus
the three accent panels ruling 3 names: `.analysis-panel` from 4px,
`.quality-hero` and `.routing-headline` from 6px.

**Held, and why:**

| Held | Weight | Category |
| --- | --- | --- |
| `.mast` | 2px | The page header, named in section 9a |
| `form` | 4px accent | A surface the user acts on |
| `.resolution-form` | 2px ink | A surface the user acts on. Marked in ink, which is why colour cannot be the test |
| `.validation-panel` | 5px | State marker. The border **is** the verdict |
| `.quality-exception` | 4px left | State marker, amber and red |
| `.bundle-warning` | 5px left | Fixed status marker, held by name |

**Not seams, untouched:** the control edge, `.history-chart`'s axis,
`.quality-grid th`'s header underline and `.open-items-grid tfoot`'s totals
rule.

The header underline is now doing less work than it was, because the header
has a fill. Out of scope and listed as Q16.

## 4. `--slate-tint` at `#d4d6d9`, and one job

Applied to the four grid headers, with `.sort-button:hover` re-derived to
`#c8cacd` by the same method. The token's narrowed job is recorded in section
9a and in a comment beside the declaration, so the next reader finds it before
using the token on a chart.

## 5. Type scale

| Changed | From | To |
| --- | --- | --- |
| `.kicker, label`, the label step | 11px/700 | 12px/700 |
| `.value`, the top-line figures | 28px/700 | 36px/800, `-0.025em` |
| `.quality-summary strong` | 28px/700 | 36px/800, `-0.025em` |

**Not changed, and listed.** `.risk strong` is already 36px in a different
context. `.matrix-cell strong` at 24px and `.routing-split strong` at 22px are
in-grid figures, not top-line metrics. The 11px and 10px label steps inside
tables, pills and the line detail are denser contexts with their own sizes.
Moving all of them is a different decision, and the changeset's figure size
was specified for three metric cards.

**One thing the changeset did not anticipate.** Its metric figures are short
numerals: 1,284, 55%, 31.4%. One of Assay's three summary values is a date
range, "2026-01 to 2026-03", which at 36px/800 nearly fills its cell. It fits
at every width tested and it is not clipped, but it is the widest thing on the
panel and it is worth knowing before a longer range appears. Q17.

## 6. Ruling 9: the three state markers are pinned

Both halves the ruling names: the width, and the fact that the colour varies
by state.

| Test | Holds |
| --- | --- |
| `test_state_markers_keep_their_width` | Each marker's edge, width and resting colour |
| `test_the_varying_state_markers_still_vary` | Every state variant and the token it paints |
| `test_the_fixed_status_marker_is_recorded_as_fixed` | `.bundle-warning` has no variants and is held by name |
| `test_a_thinned_state_marker_is_caught` | The probe |
| `test_a_dropped_state_variant_is_caught` | The probe |

### The first version of this control was wrong, and the page said so

It asserted that a state marker's own rule paints a status token.
`.validation-panel`'s does not: at rest it is `--text`, because before a
verdict arrives there is no verdict to paint, and the status colour comes with
the verdict class. The test failed on the real page, the assumption was wrong
rather than the code, and the control now reads: **a state marker carries a
status colour at rest or in a variant**, with the resting colour pinned
separately. Recorded because a control that had been written to pass would
have hidden the thing it was built to protect.

### Proved able to fail, three ways, against the real page

| Probe | Result |
| --- | --- |
| The seam rule applied correctly to all three markers, each thinned to 1px | FAILED, both width tests, all three subtests |
| One verdict colour dropped from `.validation-panel` | FAILED, 2 failures |
| `.bundle-warning` repainted in ink, losing its status colour | FAILED, 2 failures |

The page was restored byte for byte after each and the suite is green.

The first probe is the one that matters: it is not a typo, it is **the seam
rule applied correctly to something the seam rule does not cover**, which is
exactly how the next theme band would break these.

## 7. Same screens, same words

```
11 screens, including the line detail and open items reached twice
  -> IDENTICAL to the unmodified app, once the run id and manifest hash are masked
open items on 31_routing_portfolio.csv
  -> IDENTICAL
```

Band 2.10 re-checked in the live DOM after the restyle: 5 open items, both
sections, 7 rows on each of two visits, totals 25.39 percent and 9.04 percent.

## 8. Six widths, and a pre-existing overflow that is not this band's

| Width | Horizontal overflow, pass 2 | Same on merged `main` |
| --- | --- | --- |
| 1440 | 0 | 0 |
| 1100 | 0 | 0 |
| 900 | 0 | 0 |
| 768 | 0 | 0 |
| 390 | 20px | 14px |
| 320 | 80px | 90px |

**The overflow is pre-existing and is not pass 2's.** That much held up.

**The cause named here was wrong and is corrected in Q18.** This section
originally blamed `table.quality-grid` for having no scroll wrapper. It has
one, and so do three of the five grids. The real cause is the run footer,
which prints a 64 character manifest hash with no break opportunity, found by
hiding each child in turn and watching `scrollWidth` rather than by sorting
elements by how far past the viewport they sit. A wide element inside an
`overflow:auto` wrapper is the wrapper working, and the first probe could not
tell that from a defect.

The fix is one declaration, `word-break:break-word` on `.report-footer`, which
is the pattern `.provenance-grid strong` already uses on the same kind of
value. Measured: 90px of overflow without it, 0px with it, 84px again after
reverting. Q18 carries the full correction.

## 9. What pass 2 did not do

- **No fills invented.** `.workspace-panel` stays flat, see section 2.
- **No radius on buttons or inputs.** Section 9a permits it, pass 2 does not
  scope it. Q15.
- **No gridline token.** Ruling 6 says one gets derived when something needs
  one.
- **No iOS check, no Preview, no Production check.** Chromium on Linux at six
  widths.

---

## 10. Addendum: rulings 10 and 11, the theme's last two edits

### Ruling 10, the workspace panels stay flat and the definition is corrected

The product owner amended his own ruling 2 rather than have a fill invented
for eight panels that have none. Section 9a now reads: **a card is a bounded
surface holding one kind of output, and an unbounded panel is not a card
however much it looks like a section.** The reason the alternative was refused
is recorded with it: a third value picked to make a rule fit is how the
palette grew last time.

Nothing changed in the app for this. The eight panels were already flat.

### Ruling 11, 4px on buttons and inputs

Q15 answered. Section 9a already permitted it, and hard corners inside
softened cards read as unfinished rather than as a decision.

Five rules changed. Read back out of the browser:

| Element | Radius | Readings |
| --- | --- | --- |
| `button`, no class, the action buttons | 4px | 49 |
| `input`, `select`, `textarea` | 4px | 155 |
| `.filter-chip` | 4px | 18 |
| `.quality-search` | 4px | 4 |
| `.detail-close`, `.download-record`, `.download-manifest` | 4px | 3 |

**Five left at 0px and listed**, because each is a button element that is not a
button shape:

| Left flat | Why |
| --- | --- |
| `.workspace-tab` | A tab. It sits flush on the tab strip's rule, and a radius opens a gap at the bottom corners and rounds the ends of the selected tab's accent underline |
| `.sort-button` | Fills its `th`. A radius inside a table header cell would round a corner of the header fill, not of a control |
| `.matrix-cell` | A cell in the classification grid. Rounding cells breaks a grid |
| `.run-pill` | A pill, which is badge shaped. Section 9a puts badges at 3px, and ruling 11 is about buttons and inputs |
| `.term` | An inline glossary control with `border:0` and a dotted underline. A radius is meaningless on it |

**Badges were not touched, and that is the next small question.** Section 9a
permits 3px on badges. `.validation-badge`, `.ai-chip`, `.stage-tag`,
`.band-label.not_usable`, `.decision-label.ineligible` and `.run-pill` are all
at 0px inside cards that are now 4px. Ruling 11 named buttons and inputs, so
they were left. Q19.

The rendered text of all eleven screens is still identical to the unmodified
app. 278 tests pass, unchanged, and the radius bound control accepts 4px
because 4px is the bound.

---

## 11. Addendum: ruling 14, the badges

Q19 answered. 3px on all six, which section 9a already permitted.

`.run-pill` keeps one declaration rather than gaining an override: it already
declared its own radius, so that declaration changed from `0` to `3px`. The
other five declared none and take one shared rule.

| Badge | Radius | Readings |
| --- | --- | --- |
| `.decision-label.ineligible` | 3px | 256 |
| `.band-label.not_usable` | 3px | 96 |
| `.run-pill` | 3px | 24 |
| `.ai-chip` | 3px | 8 |
| `.validation-badge` | 3px | 8 |
| `.stage-tag` | 3px | 5 |

**`.stage-tag` was checked separately and not assumed.** A first pass over the
eight tabs found zero of them, because it renders only inside an open line
detail. Opening one found five, all at 3px. A badge that reports zero readings
is not a badge that passed.

**`.run-pill` is a badge although two of its three instances are `<button>`
elements.** The product owner's words: a status pill is a badge whatever tag
it is written as. That is ruling 3's principle a third time, the marker
following the job rather than the element, and it is now in section 9a beside
the list.

Every radius computed page-wide is `0px`, `3px` or `4px`. The rendered text of
all eleven screens is unchanged. 278 tests pass, unchanged.

**This closes the theme.** Band 2.9, both theme passes and rulings 1 to 14 are
merged. The one thing outstanding is the phone check, which is
`docs/production-smoke-test.md` and cannot be run from a build session.

---

## 12. Addendum: rulings 17 and 18, the last two

### Ruling 17, the header underline is gone

The fill seats the header now, and two devices doing one job is how a palette
grows.

**Deleting the declaration was not enough.** `.quality-grid th` carried
`border-bottom:2px solid var(--text)`. Removing it let the global
`th,td{border-bottom:1px solid #aaa}` rule take over, so the header kept a
hairline underline in a grey that matches no row rule on the page. **That is
the underline back silently**, which is the one thing the ruling said not to
do, arrived at by accident rather than by choice.

Caught by reading the computed style back out of the browser rather than by
reading the stylesheet. The absence is now declared, `border-bottom:0`, in the
same spirit as band 2.9.3: say what the element does rather than let a cascade
decide it.

**Asked and answered: does the header now float?** No. It reads seated. The
header fill and the first row ground differ by **1.20:1**, the same step that
makes the header read as a band at all, and at 2x the boundary is a clean
tonal edge with no line in it. Nothing needs putting back.

```
header bottom border : 0px
header fill          : rgb(212, 214, 217)
first row ground     : rgb(234, 233, 233)
step across the seam : 1.20:1
```

### Ruling 18, the date range takes body size

The 36px step is for a single number that is the point of the card. A date
range is context.

**Body size was picked, 15px at weight 700, not label size**, and the reason
is worth keeping: the label above it is 12px bold uppercase, so a value at
label size would have read as a second label rather than as a value. Body size
keeps it a value and makes it plainly subordinate.

| Cell | Size | Why |
| --- | --- | --- |
| SKUs analysed | 36px / 800 | a single number, the point of the card |
| Periods covered | **15px / 700** | a date range, context |
| Clean volume | 36px / 800 | a single number, the point of the card |

Targeted by `#qualityPeriods`, so the classification summary keeps the figure
size on all three of its cells, which are all single numbers.

**One consequence, stated rather than left to be found:** the three values no
longer share a baseline, because a smaller value in a top-aligned cell stops
higher than a 36px one. The row still reads and the raggedness is the
hierarchy being visible. A shared baseline is a separate decision and not a
one line one.

### Checks

```
rendered text, 11 screens -> IDENTICAL to the unmodified app
page overflow at 320 and 390 -> 0px
every radius on a control    -> 0px, 3px or 4px
278 tests pass, unchanged
```

**This is the last change in the theme.** Band 2.9, both passes and rulings 1
to 18 are done. The phone check is the only thing outstanding.

---

## 13. Addendum: Q6 and Q7, the last two, folded in rather than given a band

### Q6, the abandoned palette in the chart JavaScript

Twelve literals replaced: `#ee7623` to `var(--accent)` four times, `#68615e`
to `var(--muted)` six times, `#201e1d` to `var(--text)` twice.

**`var()` resolves in an SVG presentation attribute, and that was checked in a
browser before it was written**, because a presentation attribute is not a
style rule and the two do not always behave alike. A three element test page
confirmed `stroke` and `fill` both resolve.

Then both charts were rendered from a real run of the single file diagnostic
and every colour read back out of the DOM:

| Was | Is | Where |
| --- | --- | --- |
| `#ee7623` | `rgb(236, 105, 23)` | forecast path, area fill, inventory path, period label |
| `#68615e` | `rgb(102, 97, 95)` | axis labels, handover divider |
| `#201e1d` | `rgb(63, 61, 59)` | history path, healthy inventory markers |

No abandoned value survives anywhere in the file.

**Two literals in those charts are not part of this and were left.** The
gridline stroke `#d6d2d0` and the planning adjustment line `#2674a6` are
current values written as literals rather than abandoned ones, and neither has
a token. The `--warn` and `--bad` values also appear as literals in the
inventory chart's thresholds, which now sits oddly beside a `var()` in the
same ternary. **That is a tidiness question about literals, not a live defect
about the wrong palette**, and it was not in the ruling. Stated so the
inconsistency is a known one.

### Q7, five dead tokens

`--accent-600`, `--neutral-brand`, `--radius-sm`, `--radius-md` and
`--radius-lg` deleted. The palette is now **seventeen tokens and every one is
referenced**, checked by counting `var()` uses for each.

### The theme is closed

Band 2.9, theme pass 1, theme pass 2 and rulings 1 to 18 are done. All
nineteen questions are closed. 278 tests pass.

**The phone check is the only thing outstanding**, and it cannot be run from a
build session.
