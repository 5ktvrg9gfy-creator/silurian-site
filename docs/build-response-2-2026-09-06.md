# Build response 2 to the design handoff

From: the build session (Claude Code, marketing site repository)
To: the design session, via James
Date: 6 September 2026
Against: `designdecisions.md` as amended, and its answers to build response 1
Branch: `claude/silurian-marketing-site-wks2f7`, pull request 86, not merged

All eight answers are executed. Four questions come back, and one correction is mine rather than yours.

---

## 1. Executed

| Answer | Done |
| --- | --- |
| Q1, hold the 40px display step | Yes. Headline sets on one line from 800px upward |
| Q2, add `poster` at 56px, closing line takes it | Yes, on `index.html` and `forecast-risk.html` |
| Q3, micro-labels 12px, `privacy.html` body 15px, no exceptions | Yes, with `line-height: 1.65` and a 34em measure |
| Q4, keep the 72px gutter | Yes, and item 1 now specifies it |
| Q5, leave the paragraph on its `color-mix` treatment | Yes, untouched |
| Q6, ship the detail lines as written | Yes, sentence case only |
| Q7, a scale test after the rollout | Not yet, and correctly so. See Q12 |
| Q8, portrait in the lower grid | Noted, nothing to build |

The font load check is built. `SelfHostedFontLoads` asserts one `@font-face` source, root relative, not third party, and the file present at a plausible size. Proved by moving `assets/fonts/Archivo-Variable.ttf` aside and watching the suite fail, then restoring it, plus in-test probes for a broken path, a relative form and a Google Fonts URL. It does not prove a browser loaded the face; only a browser can.

Suite: 216 tests, passing. Twelve page and width combinations render with no failed request, no horizontal overflow, Archivo loaded.

## 2. A correction, mine

Build response 1 and the first version of the repository record said that mapping the held values to their steps would shrink them by 37 to 47 per cent. **That is true of two of them and false of the third.**

`forecast-risk.html`'s stat value renders 40px, and the display step is 40px exactly. Mapping it costs nothing at desktop and four pixels on a phone. I had applied your table's reading, which maps its declared 26px minimum to the 25px subhead step, and then quoted the shrink from that reading without saying which reading produced it. Corrected in `tokens.css`, `docs/marketing-site.md` and `PROJECT_HANDOFF.md`.

The value is still held, but for a different reason, and that reason is Q10 below.

## 3. Evidence that no type change is cosmetic

Your ruling on the micro-labels was that one pixel on tracked caps is invisible. Visually, correct. **It still broke a layout.**

Moving `forecast-risk.html`'s table from 11px to the 12px label step pushed the exceptions table 10px past a 320px viewport, and the whole page scrolled sideways. Nothing in the source diff showed it. It was caught by rendering all three pages at four widths and asserting that scroll width never exceeds client width.

The scale keeps no exceptions, so the fix was the cell padding at 560px and below, not the size. Recording it because the general form is worth holding: **a type step is a layout change, and a scale rollout needs a render check, not a read-through.**

---

## Questions

House format: what it blocks, my recommended default, cost if wrong.

### Q9. The other two page headlines: display at 40px, or poster at 56px?

`forecast-risk.html`'s headline renders 76px and `privacy.html`'s renders 68px. Both are `clamp()` values your inventory could not see, so neither has been assigned by decision yet.

- **Blocks:** finishing the rollout, and therefore Q12.
- **Recommended default:** poster, 56px. These are page-opening display type in the same class as the closing line you just created the step for, not section heads. The display step cuts them 47 and 41 per cent; poster cuts them 26 and 18 per cent, and uses a step that already exists rather than inventing an eighth.
- **Cost if wrong:** two declarations. But choosing display would make the homepage headline and two secondary page headlines all 40px, which flattens a hierarchy that currently distinguishes them, and that is harder to notice than to fix.

### Q10. Which end of a `clamp()` does the scale classify?

This is the one that stops the mistake recurring, and it is the reason the stat value is held.

`forecast-risk.html`'s stat value is `clamp(26px, 3vw, 40px)`. Your table maps 26 to the 25px subhead step. Its rendered size on a laptop is 40px, which is the display step exactly. **Same value, two answers, 15px apart.**

- **Blocks:** the stat value now, and every future fluid size.
- **Recommended default:** classify by what renders at desktop, not by the number typed at the small end. A `clamp()`'s minimum is a mobile floor, not a role. Under that rule the stat value takes the display step, costing nothing at desktop and four pixels on a phone, and the same rule would have caught the 42px, 56px, 76px and 68px errors before any of them shipped into a document.
- **Cost if wrong:** if the minimum governs instead, the stat value drops from 40px to 25px, which is a visible 37 per cent cut to the page's headline numbers, and the rule needs stating either way so the next fluid value is not argued from scratch.

### Q11. The wordmark: add a step, or accept one exception?

The header wordmark is `clamp(15px, 1.8vw, 18px)`, rendering 18px on a laptop and 15px on a phone. **No step in the scale matches that range.** The nearest, lead at 19px, is one pixel up at desktop and four pixels up on a phone, where the header already wraps.

- **Blocks:** the rollout, and Q12 directly: a control that bans hand-written sizes cannot ship while one is deliberately hand-written.
- **Recommended default:** accept it as the scale's one recorded exception, on the ground that it is a wordmark rather than type, and mark it as such in `tokens.css` so it reads as a decision rather than a leftover. The alternative, an eighth step at 18px for a single element, buys nothing.
- **Cost if wrong:** you ruled no exceptions, and this is the second time that rule has met a value it cannot absorb. If exceptions are genuinely forbidden, the honest answer is an 18px step, and I would rather build that than leave a rule everyone knows is broken.

### Q12. Should the scale control ban every hand-written size, with no permitted list?

You answered yes to a test after the rollout. This is what it should assert.

- **Blocks:** nothing today. It is the last piece.
- **Recommended default:** ban every raw `font-size` on the three pages outright, with no exception list, exactly as the colour control bans raw colours. No allowance file, because an allowance file is where a scale goes to die. It also has to read the `font` shorthand: the header link's 15.5px was hiding there and a `font-size` scan did not see it, which is the same shape of miss as reading a hex and calling it a colour scan.
- **Cost if wrong:** a control with a permitted list is a control people learn to ignore, which this repository already holds as a principle. The cost of the strict version is that Q9, Q10 and Q11 must all be answered first, which I consider a feature.

---

## Still open, and not mine

The detail lines under domains 1 and 2 still want a pass in James's own words, with the comma run against sub-items question alongside it.

## What this session cannot verify

No access to the live site, any preview, or a real device: outbound network is blocked by policy here. Every render is headless Chromium against the branch. The repository's own record notes that headless Chromium does not reproduce platform control styling at all, so anything involving a button, select or input stays unproven until someone opens it on a phone. `forecast-risk.html` has both a select and a button, and this change touched neither.
