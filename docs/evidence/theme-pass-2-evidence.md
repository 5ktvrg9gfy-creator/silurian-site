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

**The overflow is pre-existing and is not pass 2's.** The overflowing element
is the same on both: `table.quality-grid`, which has an intrinsic width of
937px and no scroll wrapper, so the page scrolls instead of the table. Pass 2
moved it by a few pixels in each direction, because the 12px label step
changes the header's intrinsic width and therefore where it wraps.

**The changeset warns about exactly this defect and Assay already has it**:
"the rows must sit in a single `overflow-x:auto` wrapper inside the card, each
row carrying `min-width:620px`, so the table scrolls and not the page. This
was a real defect in the mock; do not reintroduce it by dropping the wrapper."
Out of pass 2's scope. Q18, with a recommendation.

## 9. What pass 2 did not do

- **No fills invented.** `.workspace-panel` stays flat, see section 2.
- **No radius on buttons or inputs.** Section 9a permits it, pass 2 does not
  scope it. Q15.
- **No gridline token.** Ruling 6 says one gets derived when something needs
  one.
- **No iOS check, no Preview, no Production check.** Chromium on Linux at six
  widths.
