# Silurian site — agreed design changes

Handoff notes for Claude Code.

**Baseline:** the current live deployment at https://www.silurianconsulting.co.uk/ — that is the source of truth, not any file in the design project.
**Target:** options 1A, 2B, 3C and 4A in the reference mock `Hero Layout Options.dc.html`, which is built on a copy of the live `tokens.css`.
**Scope:** `index.html`, plus `forecast-risk.html` and `privacy.html` for the type scale only. The Assay product at `forecast-app/static/` is out of scope — it deploys separately and has its own tokens.

All five items below are agreed. Two open questions are listed at the end.

**Every colour comes from `tokens.css`. No hex values appear in this document by design** — earlier drafts quoted hexes from a stale local file and were wrong on the accent, the ink and the muted text. Use the token names.

| Role | Token |
| --- | --- |
| Ground | `--color-bg` |
| Ink, and every rule | `--color-text` / `--color-divider` |
| Accent | `--color-accent` |
| Reversed type, lifted surface | `--color-paper` |
| Secondary text | `--color-text-muted` |

---

## 1. Hero — headline at full content width

**Status:** agreed (option 1A)

The hero was a two-column grid with the headline in the narrow left column and the large mark floating in the right. The mark has since been removed from the live site. Do not replace the empty column with an image — the fix is to let the headline occupy the full content width.

```
[ top bar on --color-paper: mark 26px | "Silurian Consulting LTD" | nav link ]
────────────────────────────────────────────────────  2px --color-divider
  h1                       uncapped, full content width — one line at desktop
  subline                  max-width 34em
  ──────────────────────────────────────────────────  2px --color-divider
  [ paragraph 4fr ]   [ services 7fr ]
```

- `h1` — 40px, the `display` step (item 4). `line-height: 1.06`, `letter-spacing: -0.03em`, weight 800. **No `max-width`** — the headline takes the full content width and sets on one line at desktop (it needs 958px of the 1072px available). Fluid down to ~30px on mobile, where it wraps naturally.

  **Measure decided: uncapped (option 5B).** A 15em cap was trialled, giving two lines at 600px, and rejected — the second line read as orphaned from the first. Note this means the headline is a single line at desktop and wraps to two below roughly 1000px of content width; check the breakpoint where it turns over, since a two-word last line would reintroduce the same problem.

  Do not add `text-wrap: balance`. It has no effect on a single line and, once the headline wraps on smaller screens, balancing is what produces the orphan that was rejected.
- Subline — 19px, the `lead` step. Weight 800, `line-height: 1.4`, `max-width: 34em`, `margin-top: 20px`.
- Rule below the subline — `margin-top: 56px`, `padding-top: 40px`, `border-top: 2px solid var(--color-divider)`.
- Lower grid — `grid-template-columns: minmax(0,4fr) minmax(0,7fr)`, `gap: 56px`. Paragraph left, services right, column tops aligned.
- Section padding — `72px 64px 80px`.

**The headline size does not change.** It is 42px live; 40px is the scale step it snaps to. Two earlier drafts of this document were wrong here — the first specified 82px, invented and never derived from the site, the second 51px. Both are repudiated. The gain is the full width, not a larger size.

**Why:** the mark already sits in the bar directly above, so a second large instance was redundant. Removing it takes the headline from four lines to two and stops the services list wrapping.

## 2. Services — eight items become three domains

**Status:** agreed (option 2B)

The eight-item list flattened three different kinds of thing into one numbered run: what James does (#1), what he does it for (#5, #6), adjacent specialisms (#2–4), and two things that are not services at all (#7, #8). His actual proposition — independent PM and PgM for Transformation and NPI — was split across #1, #5 and #6, with supply chain items above them in reading order. #1 also restated the headline.

```
#1  Transformation programmes
    Operating model change, Site and network reconfiguration.
    ──────────────────────────────────────────────  1px --color-divider
#2  NPI and global expansion
    Launch readiness, Tech transfer, New Market Entry.
    ──────────────────────────────────────────────  1px --color-divider
#3  Supply chain and operations
    Demand forecasting, inventory diagnostics, risk and exception management.
```

- List item — `display: grid; grid-template-columns: 44px 1fr; gap: 14px`
- Numeral — `var(--color-accent)`, weight 800, 19px (`lead`), `line-height: 1.35`
- Domain title — `var(--color-text)`, weight 800, 25px (`subhead`), `line-height: 1.2`, `letter-spacing: -0.02em`
- Detail line — `var(--color-text-muted)`, weight 400, 15px (`body`), `line-height: 1.5`, `margin-top: 6px`
- Separators — `border-bottom: 1px solid var(--color-divider)` on items 1 and 2, `padding: 20px 0`. No rule under the last item. A hairline, at full ink value, not a faded 2px seam.

**Capability building is dropped.** It was #7 and does not carry through — not folded into another domain, not moved to the paragraph. Deleted.

**The Regulatory/Quality partnership moves into the paragraph** — see item 3 for the wording. An earlier draft folded capability building into that same clause; that conflated a service James performs with resource he can call on, and read as vague proximity. Reverted.

**Mobile:** the 44px numeral column holds; stack the list full width.

## 3. Voice — second person, reader first

**Status:** agreed (option 3C)

The page mixed three voices: "Behind Silurian are…" (third person), "Tell us what needs to land" (first person plural) and "Work is taken on directly" (passive).

**Paragraph becomes:**

> You get twenty years of experience in regulated manufacturing and pharmaceutical supply chain, partnered with Regulatory and Quality professionals.

**Closing line becomes:**

> Tell me what needs to land, and by when.

**The old second sentence is cut, not rewritten.** "Work is taken on directly, not brokered" was substantiating "independent" — a claim the headline already makes, and one with an unambiguous meaning in this field. It was also the only defensive note on the page.

**"Independent" is deliberately not repeated in the paragraph.** It leads the headline, and using it again for the partners meant something different — freelance rather than agency — which read as a stutter.

**Scope: `index.html` only.** The product pages keep a company and product voice: "Assay classifies your portfolio", no first person. That is not an inconsistency — those pages are about a product rather than about the owner, so the shift tracks a real change in subject.

**Why not company voice throughout:** James raised that he may expand and has saleable tools behind this. The entity is already carried by the wordmark, top bar, footer and registration line, so nobody finishes the page thinking Silurian is not a company. Brand equity separate from the owner is built by a named product with its own page, which already exists — not by pronouns in one paragraph. If he takes on people, "with me" becomes "with us".

## 4. Type scale — six steps, no new sizes

**Status:** agreed

`tokens.css` states there is no type scale and calls the raw sizes "a list, not a scale". Searching the three site pages for `font-size` gives 16 distinct values: 11, 12, 13, 14, 15, 15.5, 16, 17, 19, 20, 22, 25, 26, 30, 32, 42.

Those are not 16 decisions. They are six roles with two to four arbitrary variants each, already clustering on a ratio of about 1.28 from the 15px body. The scale is therefore extracted, not imposed — **every step is a size already in use, and nothing changes by more than 2px.**

| Step | Role | Replaces |
| --- | --- | --- |
| 40 | display — the `h1` | 42 |
| 31 | title — section heads, the closing line | 30, 32 |
| 25 | subhead — the three domain titles | 22, 25, 26 |
| 19 | lead — the subline, the domain numerals | 17, 19, 20 |
| 15 | body | 14, 15, 15.5, 16 |
| 12 | label — uppercase micro-labels, small print | 11, 12, 13 |

Ratios: 15/12 = 1.25, 19/15 = 1.27, 25/19 = 1.32, 31/25 = 1.24, 40/31 = 1.29.

**Suggested implementation:** add the six steps to `tokens.css` as `--text-display` … `--text-label` and replace the raw values page by page. One fluid rule per step then replaces the per-element `clamp()` calls, settling the mobile question in one place.

## 5. Imagery — none

**Status:** agreed

The homepage carries no photograph or illustration. This is a decision, not a gap: the empty right column that prompted the question is solved by item 1, so there is nothing to fill.

**Do not add stock manufacturing photography.** Client sites cannot be photographed, so any industry image would be stock, and stock pharma imagery is a recognisable genre that reads as a substitute for having something to show. On a page this restrained it would be the only dishonest element.

**If imagery is ever added, it should be a portrait of James** — plain background, straight to camera, well lit, no props, in black and white. It is the one image a competitor cannot use, and it answers the question the page raises. Placement beside the paragraph in the lower grid, or in the closing section immediately above the call to action. Not the hero — that would undo item 1.

No illustration, no abstract graphic, no icons.

---

## Constraints to hold

- Archivo, self-hosted variable font via `tokens.css` — `--font-heading` at weight 800, `--font-body` at 400. Not Google Fonts.
- Zero border radius anywhere.
- Structure is drawn with 2px seams and 1px hairlines and nothing else. Rules are never faded — a hairline still carries `--color-divider` at full value.
- Everything flush left, including button labels.
- The accent is spent as a mark or a field, never as a status palette.

## Still open

1. **The detail lines under #1 and #2** were drafted by Claude and confirmed as plausible by James, not written by him. Worth a final pass in his own words. He supplied them as five separate lines, so they may want breaking out as individual sub-items rather than comma runs.
2. **Two type scale judgement calls.** 11 → 12 affects uppercase micro-labels, which read larger than their nominal size because they are caps — 11px may have been deliberate; check the kickers and stat labels on `forecast-risk.html`. And 16 → 15 drops `privacy.html` body copy, the one page with sustained reading; consider leaving privacy on the `lead` step.
3. **Two meta description bugs, not yet confirmed by James.** The description renders as `Silurian Consulting LTD â€” project management…` — the em dash mis-decodes, so either the file is not UTF-8 or the charset declaration is being missed; a plain hyphen sidesteps it. The same description says "Cardiff, Wales" while the registered office is Pontypridd.

## Worth acting on in the repo

A root-relative font URL plus `font-display: swap` fails invisibly: if the path ever breaks, the site paints a fallback and looks intentional. That is exactly what happened to the design mocks in this project until it was caught by eye. A load check on the font is cheap insurance.

The copy of `tokens.css` in the design project has one deliberate deviation — a relative `@font-face` src and `font-display: block` — because that project is not served from a domain root. **Do not sync that line back.**
