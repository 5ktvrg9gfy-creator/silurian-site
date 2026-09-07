# Build response 6: the forecastability page spec

From: the build session (Claude Code, marketing site repository)
To: the design session, via James
Date: 7 September 2026
Against: `docs/forecastability-page-spec.md`, committed verbatim

**The page is not built and I am not going to build it from this spec as written.** The reason is one finding, and it is the exact failure this repository has already been through once and wrote down at length so it would not happen again.

---

## 1. The spec is written against a stylesheet this repository deleted

The spec's second line: "Every colour, font and spacing value comes from `styles.css` tokens."

**`styles.css` does not exist here.** It was removed on 4 September 2026 in commit `f2f2ca6`, "S1.6: retire the Claude Design export residue", along with eleven other files.

Every token the spec names that is not in `tokens.css` comes from that deleted file. Checked one by one:

| Token the spec uses | In `tokens.css`? | In the deleted `styles.css`? | Its value there |
| --- | --- | --- | --- |
| `--color-neutral-300` | no | yes | `#d7d3d3` |
| `--color-neutral-500` | no | yes | `#9b9797` |
| `--color-neutral-800` | no | yes | `#444141` |
| `--color-neutral-900` | no | yes | `#2d2b2b` |
| `--color-accent-700` | no | yes | `#ae1800` |
| `--space-1, -2, -3, -4, -6, -8` | no | yes | 4, 8, 12, 16, 24, 32px |

The spacing set is the giveaway. The spec says "The token scale defines `--space-1, -2, -3, -4, -6, -8` only. There is no `--space-5`, `-7`, `-9` or `-10`." That is exactly the set in the deleted file, gaps included. This spec was written against the abandoned export, not against the live site.

**`--color-text` in that file was `#201e1d` and `--color-accent` was `#ec3013`, a red.** The live site is `#3f3d3b` ink and `#ec6917` orange. Building from `styles.css` tokens would reintroduce the palette that ran on `forecast-risk.html` in Production for weeks before anyone noticed.

### Why this is the specific thing the repository warns about

`docs/marketing-site.md` records that the twelve export files were removed and that **the dead CSS was not the reason**. The reason was `readme.md`, which "instructed a future developer in the imperative and in the house voice to link `styles.css` from every page and take every colour from its variables." The note ends: "the dangerous residue of an abandoned approach is its documentation, not its code."

This spec is that document, arriving again in a new form. That is not a criticism of the design session, which cannot see this repository. It is the reason the note exists, and the note did its job.

**What is needed:** the spec re-expressed against `tokens.css`, or a decision to add the neutral ramp and the spacing scale to `tokens.css` as new approved tokens with real values. Either is fine. Building against names that resolve to nothing is not: undefined custom properties fail silently, so the page would render with browser defaults and look like a design decision.

## 2. The page has no filename, so it cannot be created

The spec never says what the file is called. It is a fourth page linking to `forecast-risk.html`, so it does not replace anything. Nothing in the repository can be created without the name.

Nor does the spec say how a reader reaches it. The header currently links to `forecast-risk.html`. If this page becomes the entry point, that link changes and `forecast-risk.html` becomes something you arrive at from here.

## 3. A fourth page fails three controls, and two of those failures are correct

- `test_the_page_list_is_pinned` pins the marketing pages at exactly three. A fourth fails it **by design**: the repository's note says "A new page must fail the control, and that is the point. Do not widen it to let a new page through: a new page is exactly when a second palette appears." Given finding 1, that control is about to do precisely the job it was built for.
- `test_no_page_carries_a_raw_colour_value` would fail on `#ec6917`, `#ffffff` and `rgba(255,255,255,0.45)`, all of which the spec writes as literals.
- `MarketingSiteTypeScale` would fail on every raw `font-size`.

The right order is: put the page on `tokens.css`, then add it to `EXPECTED_PAGES`. Not the reverse.

## 4. Smaller conflicts

**The orange is described as foreign.** The spec says `#ec6917` "is not in the Modernist palette" and marks the Assay path only. On this site it is `--color-accent`, the one accent, and `CLAUDE.md` section 9 says it is spent as a mark or a field. The spec's usage is consistent with that; only the framing is inverted.

**The type steps match.** 12 / 15 / 19 / 25 / 31 / 40 / 56 are exactly the seven steps now in `tokens.css`. Use `var(--text-label)` through `var(--text-poster)` and the control passes.

**The header strapline change is in the settled list.** "AI Forecast Diagnostic", not "AI Demand Forecasting", and the spec says it is made "wherever the live header is served from". That is `index.html`, which I own. It is a one-word copy change to a live page. I have not made it, because it is not part of this page and the last time a settled item changed live copy it went through James first.

**Contrast.** Two exceptions are recorded and accepted: white on orange at 3.18:1 for 12px kickers and 15px node copy, and the 92.5% numeral at 2.85:1. Both are below the normal floors. They are recorded as deliberate and I will not "fix" them, but they should be visible to James as an accessibility decision on a client-facing page rather than a detail inside a spec.

**The M5 figures.** 92.5 per cent, two thirds, one half, and the *International Journal of Forecasting* citation are presented as fact on a commercial page. They are signed off verbatim, so they are not mine to change. I cannot verify them: outbound network is blocked in this environment. Worth one person checking the source before it is public.

**`Forecast Flow.dc.html`** is named as the reference implementation and is not in this repository, same as the two mocks in `designdecisions.md`.

## 5. What I need to build it

1. A filename, and whether the header link moves to it.
2. Either the spec re-expressed in `tokens.css` names, or approval to add a neutral ramp and spacing scale to `tokens.css` with values chosen against the live palette rather than the deleted one. My recommendation is the second: the page genuinely needs greys the site does not have, and inventing them inline would be the same mistake in a different place.
3. Confirmation that `--color-accent-700`, the red on the failure outcome, should become a real token. It is the only red on the site and `#ae1800` came from the abandoned palette.

Everything else in the spec is buildable as written, and the structure, copy and type are unusually complete.

## What this session cannot verify

No access to the live site, any preview, or a real device. Outbound network is blocked, which is also why the M5 figures cannot be checked from here.
