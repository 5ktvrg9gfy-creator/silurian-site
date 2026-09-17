# Spacing tokens and the undeclared var() control: evidence

Built 17 September 2026 from the masthead design record, section 7. Base:
`main` at `c75ce5b`, which is PR 119 merged.

Two commits, as the story asked. Part 1 fixes today's instance. Part 2 is the
control, and it is the half that matters.

---

## 1. The defect, restated from the record

`--space-1` through `--space-4` were declared in `index.html` and nowhere
else. Any other page naming `var(--space-4)` got nothing.

The failure mode is why this needs a test rather than a note. **An undefined
custom property makes the whole declaration invalid at computed-value time.**
Not a console error. Not a fallback to something sensible. The declaration
does not happen and the page renders as though the line was never written.

It had not bitten. That is luck, not a control.

## 2. Part 1: the move

Four declarations out of `index.html`, into `tokens.css` where every other
token lives. Values unchanged, and they keep their original `.0` so a reader
can see nothing was retuned in the move.

**Nothing about `index.html`'s appearance was meant to change and nothing
did.** Proved the way band S1 proved it, not asserted:

| | Before | After |
| --- | --- | --- |
| `index.html` @1440 | `3131494440d9de74` | `3131494440d9de74` |
| `index.html` @768 | `8e45d5ba577f82cf` | `8e45d5ba577f82cf` |
| `index.html` @390 | `b7cdf7fd577ed9b4` | `b7cdf7fd577ed9b4` |
| `index.html` @320 | `5a3f981fc6dec3df` | `5a3f981fc6dec3df` |

Sixteen full-page screenshot hashes were taken across all four pages at all
four widths. **All sixteen are byte identical.** The other twelve are in
`before.json` and `after.json` in the build scratchpad and are not committed;
the four above are the ones the story is about.

## 3. Part 2: the control

`MarketingSiteVariablesResolve` in
`forecast-app/tests/test_marketing_site_tokens.py`. Six tests.

It builds each page's declared set from **the chain the page itself declares**,
read out of its own `<link rel="stylesheet">` tags rather than assumed to be
`tokens.css`, then holds every `var()` reference in the page against it.

Comments are stripped before the declaration scan, so prose naming a token
cannot be mistaken for declaring one. That matters here: `tokens.css` now
carries a comment that mentions `var(--space-4)` by name.

### Proved before trusted, twice

**Probe A, an invented token.** `var(--swatch-size)` planted on
`forecastability.html`. Fired, naming the token. Reverted, and the file hashed
byte identical to before the probe.

**Probe B, the historical defect itself.** The pre-move world rebuilt: the four
spacing tokens put back into `index.html` only, removed from `tokens.css`, and
`privacy.html` given `margin: 40px 0 var(--space-3)`. The control fired:

> `privacy.html uses ['--space-3'] and nothing in its chain (privacy.html, tokens.css)`

That is the exact defect the record describes, reproduced and caught, naming
the page, the token and the chain it searched. Reverted.

**A first attempt at probe B was wrong and is recorded rather than dropped.**
It removed the tokens from `tokens.css` without putting them back in
`index.html`, so the control fired on `index.html` instead and never reached
`privacy.html`. The grep for the expected message found nothing, which could
have been read as the probe passing quietly. It was re-run properly. A probe
that does not fire where you expected has not proved what you think.

## 4. Three limits, stated in the test's own docstring

**It is a static scan.** A declaration inside a media query counts as declared
even though it applies only at some widths.

**It reads `var()` and not JavaScript.** `forecast-risk.html` reads seven token
names as strings through `getComputedStyle` to paint its canvas, which a canvas
cannot avoid. Same defect class, different door, **not covered**. Raised as Q1
in `docs/marketing-site-open-questions.md` with a recommendation, not folded
in, because the story asked for `var()`.

**It proves a name is declared, not that the value is sensible.** A token
declared as garbage still passes.

## 5. Suite

**278 tests before, 284 after.** Six added, all part 2. No fixture, no
`expected_*.json`, no golden file, no schema, no version bump due.

The named controls the story listed both still pass: the hand-written size
control and the raw colour control are untouched and green.

## 6. Not run

No Vercel Preview and no Production check. Outbound network is blocked in this
environment, so neither is available to this session, and neither is claimed.

No real device. Every render is headless Chromium.
