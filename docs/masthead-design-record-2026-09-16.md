# Silurian site: masthead design round

**For the design session, from the build session, routed by the product owner.**

Round opened 16 September 2026 with the change "masthead product label".
Closed the same day. Everything below is live on `silurianconsulting.co.uk`.

Read this instead of the conversation. The conversation is not in the
repository and will not survive.

---

## 1. Where the header started and where it ended

Before, at the top of the evening:

```
[mark]  Silurian Consulting LTD                    AI Forecast Diagnostic
```

After the product owner's two instructions, which is what the design change
was written against:

```
[mark]  Silurian                     |  AI Forecast Diagnostic
        PROJECT & PROGRAMME DELIVERY
```

After the design change, which is what is live now:

```
[mark]  Silurian                     │  AI Forecast Diagnostic
        PROJECT & PROGRAMME DELIVERY
```

The difference between the last two is not visible in a diagram and is the
whole point of the round: the label now sits on the wordmark's baseline rather
than floating at the optical centre of a two-line block, and the divider is a
1px rule spanning the lockup rather than a pipe character sitting mid-air.

## 2. The diagnosis, measured before anything moved

All three causes in the change were checked on the shipped page at 1440px.

| Claim | Verdict | Measurement |
| --- | --- | --- |
| Label centred against a two-line lockup, aligns to nothing | Correct | Wordmark text 12 to 32px from the bar top, label 23.4 to 39.4px. Its baseline sat 12px below the wordmark's and 12px above the strapline's |
| Same visual weight as the wordmark, similar size, similar ink | Half correct | Ink identical, `rgb(63, 61, 59)`, which is `--color-text`. Sizes not similar: 18px/800 against 15px/600 |
| Case and tracking match neither line beside it | Correct | Wordmark sentence case at -0.36px, strapline uppercase at +0.96px, label sentence case at normal |

The half that was right is the half that mattered. The label was the same ink
as the company name.

## 3. What shipped

The alternative route, with two substitutions and one refusal.

- **The lockup is a grid, not a row of flex items.** The wordmark and the label
  are in the same grid row, so the browser performs the baseline alignment.
  No offset is typed in by hand anywhere in the header.
- **The divider is 1px `var(--color-divider)`**, spanning the lockup,
  `var(--space-4)` either side, of which the row's own column gap supplies 14
  of the 16.
- **The label is `--color-text-muted`**, 15px/600, sentence case. Contrast
  6.1:1 against the header ground where the wordmark is 10.81:1.
- **Below 522px** the label drops to its own row and the rule goes with it.

The shipped markup, in full:

```html
<div class="mast-brand">
  <img class="mast-mark" src="logo-stone.svg" alt="" style="width:26px;aspect-ratio:200/290" />
  <p class="wordmark">Silurian</p>
  <p class="mast-subline">Project &amp; Programme Delivery</p>
  <span class="mast-rule" aria-hidden="true"></span>
  <nav class="mast-nav" aria-label="Forecasting tools">
    <a class="forecast-link" href="forecastability.html">AI Forecast Diagnostic</a>
  </nav>
</div>
```

**Evidence.** Every width from 320 to 1440, 1121 in total, on four checks each:
baseline delta, the rule spanning the lockup, the rule never showing on a
stacked bar, horizontal overflow. Zero violations. The suite is 278 tests and
passes.

**One method note worth having.** The first baseline probe reported the label
0.91px off. It was checked against a control before the number was believed:
two spans on one text line, which share a baseline by definition, also read
0.91px apart, so the probe was measuring its own bias rather than the page.
The normalised probe reads 0.00 on the control and 0.00 on the page.

## 4. What was refused

**The preferred route**, which drops the strapline from the header and makes
the product name the second line.

It was refused because it deletes "Project & Programme Delivery", which the
product owner asked for the same day and ruled on the same day. The build
session does not resolve a contradiction between a specification and the
product owner. The design session has since accepted that the alternative was
the real specification and should have been written as the only one.

Two further objections, recorded because they outlive this round:

- **"AI Forecast Diagnostic" is not a product label on this page.** It is the
  site's only navigation, an anchor to `forecastability.html` inside a `nav`
  landmark. Stacking it under the wordmark makes a link read as the second
  line of a wordmark, and the site record already holds that the header brand
  block is one link to `index.html` on every page.
- **The site masthead and Assay's header are two products**, deploying from
  separate Vercel projects. Confirmed since as site only.

## 5. The four questions and the answers

| # | Question | Answer, 16 September 2026 |
| --- | --- | --- |
| 1 | `--color-neutral-700` and `--color-neutral-300` do not exist here | Both substitutions accepted, no new token. `--color-text-muted` on the label. Hairline stays `--color-divider` at full ink: this system does not fade its rules, and the subordination is carried by the 1px weight against the header's 2px close |
| 2 | "Wordmark unchanged: 19px/800, -0.01em" contradicts the live value and the change's own "not to change" list | The wordmark does not move. The 19px was an error carried over from the Assay dashboard's scale. `clamp(15px, 1.8vw, 18px)` at -0.02em stands |
| 3 | Site masthead or Assay header | Site masthead only. Assay untouched |
| 4 | Case on the label | Sentence case at 15px confirmed. It is a navigation link, and 12px uppercase would have made a second strapline of it |

## 6. Still open

- **Conditional, with the design session.** If the rule reads heavy in place,
  the divider's height gets looked at rather than its value. Nobody has seen
  it in place yet.
- **With the design session.** The amendment writing the deleted ramp
  constraint into `design-decisions.md` has not reached this repository.
  `docs/designdecisions.md` on `main` mentions neither the ramp, nor
  `styles.css`, nor commit `f2f2ca6`, checked by reading the file. The copy
  that was amended is the one in the design project, which no build session
  reads. It needs routing in the way the last version was.

> **Closed 18 September 2026.** The product owner routed it and pull request
> 125 committed it. `docs/designdecisions.md` now carries all three: the ramp
> with its commit and date, `styles.css`, and `f2f2ca6`. It also carries the
> constraint this bullet is really about, under "This file is the source": the
> document in this repository is the document, any copy in the design project
> is a working copy, and an amendment that has not reached `main` has not
> happened.
>
> The bullet above it, the conditional on the divider's height, is still open.
> Nobody has seen the rule in place.

## 7. What a site changeset has to satisfy, so the next one is not caught out

This is the section to read before writing the next change. The ramp was
missed twice, on 7 September and again on 16 September, and both times the
cause was the same: a value named from a file this repository deleted.

**Every colour token that exists.** There are fifteen and this is all of them:

```
--color-accent          --color-bg              --color-charcoal-deep
--color-chart-grid      --color-chart-series    --color-divider
--color-neutral-brand   --color-paper           --color-status-bad
--color-status-good     --color-status-warn     --color-surface
--color-text            --color-text-muted      --color-text-on-dark
```

**There is no neutral ramp.** `--color-neutral-brand` is the warm brand
neutral `#cabfad`, not a step in a scale. The 300, 500, 800 and 900 steps, and
`--color-accent-700`, lived in `styles.css`, deleted on 4 September 2026 in
commit `f2f2ca6`. Anything naming them is written against a file that is gone.

**Every type step that exists**, and the rule that they are the only sizes
allowed on a page:

```
--text-poster  --text-display  --text-title  --text-subhead
--text-lead    --text-body     --text-label  --wordmark-size
```

A hand-written size fails `test_no_page_carries_a_hand_written_size`, in the
longhand and inside the `font` shorthand. `--wordmark-size` is outside the
scale on purpose, so the wordmark is not an exception to the rule.

**A raw colour fails too**, in any form: hex, `rgb()`, `hsl()`, a `color-mix()`
over a raw value, or a canvas literal. `color-mix()` over a token is legal and
is the site's existing idiom for a tint.

**Spacing tokens are not in `tokens.css`.** `--space-1` through `--space-4`
are declared in `index.html` and nowhere else. **A change naming
`var(--space-4)` for `forecast-risk.html`, `forecastability.html` or
`privacy.html` would fail silently**, because an undefined custom property
makes the declaration invalid at computed-value time rather than raising
anything. This one has not bitten yet. It is written down here so it does not.

> **Superseded 17 September 2026. The paragraph above was true when it was
> written on 16 September and is not true now.** Pull request 120 moved
> `--space-1` through `--space-4` into `tokens.css` with their values
> unchanged, so every page can see them and a change naming `var(--space-4)`
> for any of the three pages is safe. The warning had not bitten, which was
> luck rather than a control, so the same pull request built the control:
> `test_no_page_uses_an_undeclared_var` fails the build on any `var()` naming
> something nothing in the page's chain declares, and
> `test_no_page_reads_an_undeclared_token_from_script` covers the seven names
> `forecast-risk.html` reads as strings to paint its canvas.
>
> The paragraph is left standing rather than rewritten. This file is a dated
> record of what was true on 16 September, and it is the document that named
> the gap that got the control built. Editing that away would delete the
> reason the move happened.
>
> Committed to this repository on 18 September 2026 on the product owner's
> instruction, body unedited. It was routed to the planning session as a file
> and never committed, which is the defect described in
> `docs/designdecisions.md` under "This file is the source": a document that
> controls how the next change is written, living where no build session
> reads it. Section 7 below is that document.

**Poster is one per page.** Pinned by `test_a_page_spends_poster_at_most_once`.

**No em dash or en dash in anything a user reads.** House rule of the product
owner's, enforced on the product by `test_production_copy_scope_check`.

**Zero radius on the marketing site**, with the three circular contact badges
as the documented exception. Assay is a separate documented exception with its
own 4px bound, and its rules do not come back to the site.

> **Count corrected 17 September 2026.** Three rules, four rendered elements.
> The homepage rule dresses the email badge and the LinkedIn badge together, so
> counting badges on the site gives four and reading this line gives three.
> `CLAUDE.md` section 9a carries the corrected wording, which counts rules
> because the scan reads rules: `.close .contact-badge` on `index.html` and on
> `forecast-risk.html`, and `.mail-badge` on `forecastability.html`.
>
> The rule itself is now enforced rather than advisory.
> `MarketingSiteKeepsZeroRadius` was built on 17 September, the site's first
> radius scan, and it allows those three **by selector and never by value**, so
> `50%` on anything else fails the build. Nothing enforced zero radius on the
> site before that date, including when this was written.

## 8. Where this lives in the repository

| What | Where |
| --- | --- |
| The full build reply, with the measurements | `docs/build-response-8-2026-09-16.md` |
| The answers above, appended to the same file | same file, final section |
| The merge record and what was not checked | `PROJECT_HANDOFF.md`, top entry |
| The deleted ramp, first report | `docs/build-response-6-2026-09-07.md` |
| The site's own conventions record | `docs/marketing-site.md` |

Pull requests 117 and 118 carry the change and its record. The header change
earlier the same evening is 112 through 116.

## 9. What nobody has checked

The masthead has not been seen on the live site by anyone since the design
change merged. The build session cannot reach it: the network policy in that
environment refuses both `vercel.app` and the site itself.

The thing to look at is the rule. It should span both lines of the lockup
rather than float between them, and it should be gone on a phone, where the
label drops to its own row.
