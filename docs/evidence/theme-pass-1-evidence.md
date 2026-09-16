# Assay theme, pass 1 evidence

Built 16 September 2026, from the product owner's two pass split and three
rulings, against the approved changeset "Assay app theme and dashboard shell".

Base: `main` at `5b79bbf`, which is PR 102 merged. One production file
changed, `forecast-app/static/index.html`.

**Pass 1 is the quietening half.** It only takes weight away. Nothing here
adds a radius, a shadow, a fill or a type change.

---

## 1. No control file moved

```
$ git status --short
 M CLAUDE.md
 M docs/assay-theme-open-questions.md
 M docs/evidence/theme-pass-1-evidence.md
 M forecast-app/static/index.html
```

No fixture, no `expected_*.json`, no golden file, no schema. No version bump
was due. 273 tests pass, 273 passed before.

## 2. What was built

| Asked for | Built |
| --- | --- |
| The table treatment on all four grids | Row rule and row hover on `.quality-grid`, which every one of the four tables carries. The six bare `<table>` elements elsewhere are untouched |
| `--control-border` on inputs | `input`, `select`, `textarea` go from 2px `--text` to 1px `--control-border`. The button keeps its 2px ink, because the ruling says inputs |
| `--accent-pressed` button hover | On action buttons. The six utility button classes are excluded by name |

Four tokens added: `--row-rule`, `--row-hover`, `--control-border`,
`--accent-pressed`.

## 3. The row rule was not built as specified, and this is why

**The changeset's `--row-rule: #eeebe9` was chosen against a white card.**
Assay's tables sit on `--surface` `#eae9e9`, because section 9 puts panels
darker than the page.

| Row rule | Against | Ratio | Side of its ground |
| --- | --- | --- | --- |
| `#eeebe9` | the mock's white card | 1.19:1 | darker |
| `#eeebe9` | Assay's `--surface` | 1.02:1 | **lighter** |
| `#aaaaaa`, today | `--surface` | 1.92:1 | darker |
| `#dcd9d7`, shipped | `--surface` | 1.16:1 | darker |

It was built with `#eeebe9` first and looked at. The row division is not
faint, it is gone. The only horizontal line left in a row is the sparkline's
own baseline, which is not a row division and reads as one.

`#dcd9d7` holds the changeset's own relationship, just over 1.1:1 and darker
than its ground, against Assay's surface instead of the mock's card. **It is
derived, not chosen, and it is not an approved value.** Flagged in a comment
beside the token, in the pull request, and as Q10 in
`docs/assay-theme-open-questions.md`.

Shipping `#eeebe9` would have removed the row divisions from the four densest
screens in the product, which is the opposite of what the changeset argues
for. Reverting to `#aaaaaa` would have meant pass 1 showed no table change at
all, which was the point of the pass.

**The wider point matters more than the value.** Every colour in the changeset
was picked against a white card. `--card-border`, `--row-hover` and
`--slate-tint` are all lighter than `#eae9e9` too. `--row-hover` survives,
because a hover should be lighter than the row it lifts. `--slate-tint` as a
table header fill will not. Recorded in section 9a and in Q10.

## 4. The button hover reaches the right buttons and no others

Every visible button was hovered in a browser and its computed fill read at
rest and on hover.

| Class | At rest | On hover | Count |
| --- | --- | --- | --- |
| no class, the action buttons | `rgb(236, 105, 23)` | `rgb(214, 92, 17)` | 6 |
| `run-pill run-pill-button` | `rgb(236, 105, 23)` | `rgb(214, 92, 17)` | 1 |
| `filter-chip`, pressed | `rgb(236, 105, 23)` | unchanged | 1 |
| `filter-chip`, at rest | transparent | unchanged | 3 |
| `sort-button` | transparent | its own `rgb(222, 220, 220)` | 9 |
| `term` | transparent | unchanged | 28 |
| `workspace-tab` | transparent | unchanged | 8 |

The six utility classes are excluded by name rather than by a selector that
happens to miss them today. Excluding them leaves their hover exactly as it
was, so pass 1 adds one hover state and changes none.

`--accent-pressed` `#d65c11` carries `--ink-deep` at **4.51:1**, over the 4.5
floor. White on it would be 3.89:1 and would fail, which is the same trap band
2.9 found in the changeset's button label and is recorded as Q5.

## 5. Same screens, same words

The rendered text of every screen captured from the running app and compared
with the unmodified app.

```
11 screens, including the line detail and open items reached twice
  -> IDENTICAL once the per-run id and manifest hash are masked
open items on 31_routing_portfolio.csv
  -> IDENTICAL
```

Band 2.10 re-checked in the live DOM after the restyle: 5 open items, both
sections, 7 rows on the first visit and 7 on the second, totals 25.39 percent
and 9.04 percent unchanged.

## 6. Nothing pass 1 excludes was touched

Every computed control change against merged `main`, in full:

```
x124 <input>            borderColor  rgb(63, 61, 59)    -> rgb(201, 197, 194)
x21  <select>           borderColor  rgb(63, 61, 59)    -> rgb(201, 197, 194)
x10  <textarea>         borderColor  rgb(63, 61, 59)    -> rgb(201, 197, 194)
x4   .quality-search    borderColor  rgb(183, 180, 180) -> rgb(201, 197, 194)
```

No radius moved. No background moved. No colour moved. The row rule and row
hover are on `td` and `tr` and so do not appear in a control scan; they are
evidenced by the crops in the pull request instead.

**`--control-border` measured.** `#c9c5c2` is 1.71:1 against the white field
and 1.41:1 against the panel, under the 3:1 floor WCAG 1.4.11 sets for a
component boundary. The field stays identifiable because its white fill sits
on a darker panel and the hairline defines the edge, which is the render
rather than the number, and the crops show it. Stated because the number is
below the floor and somebody should know that rather than find it later.

## 7. What pass 1 did not do

- **No `--slate-tint` and no table header fill.** Ruling 1 is held complete
  for pass 2, token, note and section 9a line together. The reason is Q11: the
  two pass split names the table treatment in pass 1 and `--slate-tint` in
  pass 2, and those overlap. The explicit pass 2 listing was followed.
- **No seams.** The 2px ink under `.quality-grid th`, the 2px totals rule on
  `.open-items-grid tfoot`, and the accent top borders on the forms are all
  untouched and are ruling 3's work in pass 2.
- **No type changes**, so the 11px/700 header treatment waits with the fill.
- **`.sort-button:hover` still uses `#dedcdc`**, a warm grey that will sit on
  a cool header fill once pass 2 lands. Not in pass 1's scope. Listed so it is
  not missed.
- **No iOS check, no Preview, no Production check.** The evidence above is
  Chromium at 1440px on Linux.

## 8. Seam count for ruling 3, so pass 2 can be scoped

Counted out of the stylesheet by a script, not by eye, because the first
count I wrote from memory was wrong in both columns.

### Category A, ink rules separating one block from the next, drop to 1px

**22 selectors.** Three of them use `border-block` and so draw two rules each,
so 25 rules in all. Not all are 2px today: `.chart-card` is 3px,
`.bundle-centre` and `.provenance` are 4px, `.bundle-view` and
`.validation-panel` are 5px. Ruling 3 says these drop to 1px, so the four
heavier ones drop further than the rest and that is a bigger visual move than
the 2px majority. **Worth a look before it ships rather than after.**

### Retained at 2px, 1 selector

`.mast`, the page header. Ruling 3 names it.

### Not seams, out of ruling 3, 4 selectors

The control edge on `input,select,textarea,button`, the chart axis on
`.history-chart`, the table header underline on `.quality-grid th`, and the
totals rule on `.open-items-grid tfoot`. The last two sit inside tables rather
than between blocks, and the totals rule is load bearing: it is what separates
a total from the rows it totals. Left alone and listed.

### Category B, accent top borders, 4 selectors

| Selector | Weight | Acted on? |
| --- | --- | --- |
| `form` | 4px | **Yes.** The two forms. Unambiguous, stays |
| `.analysis-panel` | 4px | Ambiguous |
| `.quality-hero` | 6px | Ambiguous |
| `.routing-headline` | 6px | Ambiguous |

Ruling 2 says to list a genuinely ambiguous panel rather than guess. **Three
are listed.** All three carry an accent top border and none of them is a
surface you act on: they mark a result. Under ruling 3 as written the border
is kept "wherever it marks a surface the user acts on", which these do not, so
the rule does not say what happens to them. They were left exactly as they
are, at 4px and 6px, and need a decision in pass 2.

**One more, the other way round.** `.resolution-form` **is** a surface the
user acts on, and its top border is 2px ink rather than accent. Under category
A it drops to 1px, which would make the one form in the workspace the quietest
thing on the panel. Flagging it because ruling 3's two categories were written
assuming forms are marked in accent, and this one is not.

### Accent left borders, 9 selectors

Row markers on the caveated, not usable and ineligible rows, and callout bars
on `.ai-banner`, `.quality-statement`, `.line-detail`, `.winner`,
`.resolution-form .consequence` and `.resolution-recorded`. In neither
category of ruling 3 and untouched. Listed so nobody assumes they were
covered.
