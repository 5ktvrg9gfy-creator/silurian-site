# Silurian site, agreed design changes

Handoff notes for Claude Code. Rewritten 6 September 2026 after two build responses. This supersedes every earlier version: where an earlier draft said something different, this document is right and the earlier one is not. Superseded reasoning has been removed rather than kept, so nothing here is a record of what was once considered.

**Baseline:** the live deployment at https://www.silurianconsulting.co.uk/, not any file in the design project.
**Reference mocks:** `Hero Layout Options.dc.html` for the layout, `Hero Paragraph Check.dc.html` for the hero band at the real 1056px content width.
**Scope:** `index.html` in full, plus `forecast-risk.html` and `privacy.html` for the type scale. The Assay product at `forecast-app/static/` is out of scope, it deploys separately and has its own tokens.

**Every colour comes from `tokens.css`. No hex values appear in this document by design.** Earlier drafts quoted hexes from a stale local file and were wrong on the accent, the ink and the muted text. Use the token names.

| Role | Token |
| --- | --- |
| Ground | `--color-bg` |
| Ink, and every rule | `--color-text` / `--color-divider` |
| Accent | `--color-accent` |
| Reversed type, lifted surface | `--color-paper` |
| Secondary text | `--color-text-muted` |

---

## 1. Hero, headline at full content width

**Status:** agreed, built on branch `claude/silurian-marketing-site-wks2f7`.

The hero was a two-column grid with the headline in the narrow left column and the large mark floating in the right. The mark has been removed from the live site. Do not replace the empty column with an image. The fix is to let the headline occupy the full content width.

```
[ top bar on --color-paper: mark 26px | "Silurian Consulting LTD" | nav link ]
────────────────────────────────────────────────────  2px --color-divider
  h1                       uncapped, full content width, one line at desktop
  subline                  max-width 34em
  ──────────────────────────────────────────────────  2px --color-divider
  [ paragraph 4fr ]   [ services 7fr ]
```

- `h1`, 40px, the `display` step. `line-height: 1.06`, `letter-spacing: -0.03em`, weight 800, **no `max-width`**. It needs 957.9px of the 1056px available and sets on one line down to 800px viewport width. Below that it breaks into two balanced lines and no orphan appears at any width.
- Do not add `text-wrap: balance`. It does nothing on a single line, and once the headline wraps it produces the orphan that was rejected.
- Do not reinstate the `<span class="line">` hard breaks. A headline cannot set on one line while carrying them.
- Subline, 19px, the `lead` step. Weight 800, `line-height: 1.4`, `max-width: 34em`, `margin-top: 20px`. Set the weight explicitly: `<strong>` renders 700, not 800.
- Rule below the subline, `margin-top: 56px`, `padding-top: 40px`, `border-top: 2px solid var(--color-divider)`.
- Lower grid, `grid-template-columns: minmax(0,4fr) minmax(0,7fr)`, `gap: 56px`. Paragraph left, services right, column tops aligned.
- Section padding, `72px` top and `80px` bottom. The horizontal gutter stays on the site's `--edge`, `clamp(20px, 5vw, 72px)`, not the 64px an earlier draft specified. `.wrap` is shared by the header, contact band and footer, so 64px on this section alone would misalign the headline against the wordmark above it. Content width is therefore 1056px.

**On the headline size.** An earlier draft claimed the size does not change, on the basis that it was 42px live. That was false: the size inventory read fixed `font-size` values and skipped every `clamp()`. Live it is `clamp(36px, 4vw, 58px)`, rendering 57.6px at 1440px, so the 40px step is a 30 per cent reduction at desktop and not a 2px snap.

The step holds anyway. One line at full width was the point, and 57.6px cannot do it: the headline would need 1379px against 1056px available. The largest size that still sets on one line is about 44px, which leaves 2px of slack and is not a real option. So a 40px headline running the full measure as a single line, above a 19px subline, is the setting. The gain is the full width. The cost is a smaller headline, and it is accepted.

## 2. Services, eight items become three domains

**Status:** agreed, built.

The eight-item list flattened three different kinds of thing into one numbered run: the service, who it is for, adjacent specialisms, and two items that were not services at all. The actual proposition, independent PM and PgM for Transformation and NPI, was split across three of them, with supply chain items above them in reading order.

```
#1  Transformation programmes
    Operating model change, site and network reconfiguration.
    ──────────────────────────────────────────────  1px --color-divider
#2  NPI and global expansion
    Launch readiness, tech transfer, new market entry.
    ──────────────────────────────────────────────  1px --color-divider
#3  Supply chain and operations
    Demand forecasting, inventory diagnostics, risk and exception management.
```

- List item, `display: grid; grid-template-columns: 44px 1fr; gap: 14px`
- Numeral, `var(--color-accent)`, weight 800, 19px (`lead`), `line-height: 1.35`
- Domain title, `var(--color-text)`, weight 800, 25px (`subhead`), `line-height: 1.2`, `letter-spacing: -0.02em`
- Detail line, `var(--color-text-muted)`, weight 400, 15px (`body`), `line-height: 1.5`, `margin-top: 6px`. Sentence case.
- Separators, `border-bottom: 1px solid var(--color-divider)` on items 1 and 2, `padding: 20px 0`. No rule under the last item. A hairline at full ink value, not a faded 2px seam.
- Mobile, the 44px numeral column holds, the list stacks full width.

**Capability building is dropped.** Not folded into another domain, not moved to the paragraph. Deleted.

**The Regulatory and Quality partnership lives in the paragraph**, see item 3.

## 3. Voice and copy

**Status:** agreed. The paragraph copy below is final and replaces every earlier version.

**First person plural throughout.** The page speaks as Silurian as "we" and "us", everywhere, including the paragraph. Not first person singular, not third person, not passive. Second person is used only where the sentence is about what the reader gets.

**Paragraph:**

> We bring twenty years of experience in regulated manufacturing and pharmaceutical supply chain: transformation programmes, operating model design, site and tech transfer, global product launches and programme recovery, working across manufacturing sites, external partners and global functions. We are partnered with Regulatory and Quality specialists.

349 characters. In the 4fr column it sets in 11 lines and the two lower columns come out level. **That is intended, not a defect to correct.**

**Closing line:**

> Tell us what needs to land, and by when.

Unchanged from live. An earlier draft moved it to first person singular; that was reversed.

**Two things deliberately absent.** "Independent" is not repeated in the paragraph: it leads the headline meaning not brokered, and applying it to the Regulatory and Quality specialists means external, which reads as a stutter. And the old sentence "Work is taken on directly, not brokered" is cut rather than rewritten, because it substantiates a claim the headline already makes and was the only defensive note on the page.

**Measure, for any future copy change.** Measured in the render, not estimated. The 4fr paragraph column is 363.6px wide, so at 15px the measure is about 32 characters a line. The services list is 257.1px tall, which is 11 paragraph lines at 23.25px leading. Capacity is therefore about 350 characters before the columns level. To keep the bottom edge uneven, stay under about 280.

**Scope.** `index.html` and the marketing pages. The Assay product pages keep a product voice, "Assay classifies your portfolio", because they are about a product rather than about the firm.

## 4. Type scale, seven steps

**Status:** agreed. Applied to `#about` on `index.html`. The rollout to the rest of `index.html`, `forecast-risk.html` and `privacy.html` is the remaining work.

`tokens.css` states there is no type scale and calls the raw sizes "a list, not a scale". The three site pages carried sixteen distinct fixed values, plus several `clamp()` values the first inventory missed. Those are not sixteen decisions. They are a handful of roles with two to four arbitrary variants each, already clustering on a ratio of about 1.28 from the 15px body. The scale is extracted, not imposed: every step is a size already in use.

| Step | Role | Replaces |
| --- | --- | --- |
| 56 | poster, the closing line in the accent field, that field only | 56 |
| 40 | display, every page headline, and the `forecast-risk.html` stat value | 42, 76, 68, 40 |
| 31 | title, section heads | 30, 32 |
| 25 | subhead, the three domain titles | 22, 25, 26 |
| 19 | lead, the subline, the domain numerals | 17, 19, 20 |
| 15 | body | 14, 15, 15.5, 16 |
| 12 | label, uppercase micro-labels and small print | 11, 12, 13 |

Ratios: 15/12 = 1.25, 19/15 = 1.27, 25/19 = 1.32, 31/25 = 1.24, 40/31 = 1.29, 56/40 = 1.40.

**All three page headlines take display at 40px.** Not poster. Poster is used once on the site, on the closing accent field. Setting the secondary pages at 56px while the homepage opens at 40px would make the homepage headline the smallest page opener on the site, which is a worse inversion than the flattening it avoids. A closing field louder than the headline above it is fine, because it is a full-bleed statement rather than a page opener.

**A `clamp()` is classified by its desktop rendered value, not by the number typed at the small end.** The minimum is a mobile floor, not a role. Write the rule into `tokens.css` beside the steps. Under it, `forecast-risk.html`'s stat value takes display at 40px, which costs nothing at desktop and four pixels on a phone. This rule is what stops the next fluid value being argued from scratch, and it would have caught the 42px, 56px, 76px and 68px errors before any of them reached a document.

**No exceptions in the scale.** Uppercase micro-labels go to 12px, not 11px: one pixel on tracked caps is invisible, and an exception written in on day one is how the last list of sizes started. `privacy.html` body goes to 15px with the rest; sustained reading is fixed by leading and measure, not by that pixel, so set it `line-height: 1.65`, `max-width: 34em`.

**The wordmark is not in the scale.** `clamp(15px, 1.8vw, 18px)` matches no step, and an eighth step for one element buys nothing. It is the mark rather than type, so give it its own token, `--wordmark-size`, outside the scale. The scale then keeps no exceptions and the control below has nothing to permit, because a token is not a hand-written size.

**A type step is a layout change.** Moving the `forecast-risk.html` table from 11px to 12px pushed it 10px past a 320px viewport and the page scrolled sideways; nothing in the diff showed it. The fix was cell padding at 560px and below, not the size. Roll the scale out with a render check at several widths, not a source read-through, and record that in the repository.

**Implementation.** Add the steps to `tokens.css` as `--text-poster` through `--text-label` and replace the raw values page by page. One fluid rule per step then replaces the per-element `clamp()` calls, settling the mobile question in one place.

**Enforcement, after the rollout and not before.** Every raw `font-size` on the three pages fails the build, with no allowance file, exactly as the colour control works. The check must read the `font` shorthand as well as the longhand: the header link's 15.5px was hiding in the shorthand and a `font-size` scan did not see it.

## 5. Imagery, none

**Status:** agreed.

The homepage carries no photograph or illustration. This is a decision, not a gap: the empty right column that prompted the question is solved by item 1.

**Do not add stock manufacturing photography.** Client sites cannot be photographed, so any industry image would be stock, and stock pharma imagery is a recognisable genre that reads as a substitute for having something to show. On a page this restrained it would be the only dishonest element.

**If imagery is ever added, it should be a portrait of James**, plain background, straight to camera, well lit, no props, black and white. Placement is the lower grid, under the paragraph, at the paragraph's column width. Not the hero, that would undo item 1.

No illustration, no abstract graphic, no icons.

---

## Constraints to hold

- Archivo, self-hosted variable font via `tokens.css`, `--font-heading` at weight 800, `--font-body` at 400. Not Google Fonts.
- Zero border radius anywhere.
- Structure is drawn with 2px seams and 1px hairlines and nothing else. Rules are never faded: a hairline still carries `--color-divider` at full value.
- Everything flush left, including button labels.
- The accent is spent as a mark or a field, never as a status palette. `forecast-risk.html` currently breaks this, see below.

## Closed, do not raise again

- **Cardiff against Pontypridd** in the meta description. Cardiff is the general location and is deliberate; the footer keeps Pontypridd as the registered office. Closed by James, 6 September 2026.
- **The double-encoded em dash.** Diagnosed as a latin-1 round trip, 39 sequences in `index.html`, one of them visible. Fixed with a comma. The file is valid UTF-8 and the charset declaration is correct; the earlier diagnosis in this document was wrong.
- **The 72px gutter**, see item 1.
- **The lower-left paragraph colour.** It keeps its existing `color-mix` treatment rather than moving to `--color-text-muted`. The token table names the detail lines, not the paragraph, and the two currently read as different levels, which is correct.
- **The font load check.** Built and proved.

## Open

1. **`forecast-risk.html`, four issues raised 6 September 2026, to be worked as a separate pass.**
   - The contact badge on the closing field is `border-radius: 50%`. It is the only round corner on the site and it breaks a stated constraint. Make it a square 40px badge.
   - The page introduces a red, amber and green status palette plus two chart colours, against the rule that the accent is never a status palette. This is defensible, because risk status is the content of the page rather than decoration, but it must be written down as an exception scoped to this page or it will leak onto the homepage.
   - The 12px label step carries nine roles on that page: kicker, form labels, stat labels, stat notes, panel subtitles, chart legend, table headers, risk pills, footer, and the whole exceptions table at mobile. The page loses its middle register. The panel subtitles and the chart legend are reading text and should be body at 15px; the table should not drop to 12px on a phone.
   - The voice mixes third person, "Silurian turns historical demand into", with first person plural, "We will test its forecasts". Company voice means one pronoun. Pick one.
   - Separately, the illustrative notice spends three sentences on TimesFM, Google Research and 100 billion time-points. That is borrowed credibility on a page whose argument is that the model is a baseline and the judgement is the service. The method section already makes that argument.
2. **The detail lines under domains 1 and 2** were drafted by Claude and confirmed as plausible, not written by James. Worth a final pass in his own words. He supplied them as five separate lines, so they may want breaking out as sub-items rather than comma runs, which would change the list's rhythm and the balance of the 44px numeral column.

## Worth acting on in the repo

The copy of `tokens.css` in the design project has one deliberate deviation, a relative `@font-face` src and `font-display: block`, because that project is not served from a domain root. **Do not sync that line back.**
