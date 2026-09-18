# Build response 8

From: the build session
To: the design session, via the product owner
Date: 16 September 2026
Subject: change "masthead product label", specified 16 September 2026

The diagnosis is right and was checked rather than taken on trust. Two of the
three routes in the change cannot be built as written. What follows is what was
built, what was not, and the four things in the change that need a decision.

---

## 1. The diagnosis, measured

All three causes were measured on the shipped page at 1440px before anything
was changed.

- **"Vertically centred against a two-line lockup, aligns to nothing."**
  Correct. The wordmark's text sat 12 to 32px from the top of the bar and the
  label sat 23.4 to 39.4px. Its baseline was 12px below the wordmark's and
  12px above the strapline's, so it aligned to neither.
- **"Same visual weight as the wordmark, similar size, similar ink."** Half
  correct, and the half that is right is the one that mattered. The ink was
  identical, `rgb(63, 61, 59)` on both, which is `--color-text`. The sizes
  were not similar: 18px/800 against 15px/600.
- **"Case and tracking match neither line beside it."** Correct. Wordmark
  sentence case at -0.36px tracking, strapline uppercase at +0.96px, label
  sentence case at normal tracking. Three treatments.

## 2. What was built

The alternative route, with the deviations in section 4.

- The lockup is a grid, not a row of flex items. The wordmark and the label
  are in the same grid row, so **the browser does the baseline alignment and
  no offset is typed in by hand**. Measured at every width from 320 to 1440:
  the two baselines are identical, delta 0.00px, at every width where both are
  on one line.
- The pipe glyph is gone. In its place is a 1px rule spanning the lockup,
  `var(--space-4)` either side, of which the row's own column gap supplies 14
  of the 16.
- The label is `--color-text-muted`, the same ink as the strapline, so it
  subordinates to the wordmark. It keeps 15px/600 and sentence case, which is
  the change's own option B, so no copy moved.
- Below 522px the label drops to its own row and the rule goes with it.

Verified by stepping every width from 320 to 1440, 1121 in total, on four
checks each: baseline delta, the rule spanning the lockup, the rule never
showing on a stacked bar, and horizontal overflow. Zero violations. The suite
is 278 tests and passes.

## 3. What was not built, and why

**The preferred route is refused, pending the product owner.** It deletes
"Project & Programme Delivery" from the header. That line is in the header
because the product owner asked for it on 16 September 2026, and he ruled the
same day that it stays on the homepage and that the other three pages carry
the name alone. `CLAUDE.md` section 2 says to report a contradiction rather
than choose the convenient source, so it is reported here and not resolved by
this session.

**Two things about the preferred route are worth having in the record beyond
the conflict.**

- **"AI Forecast Diagnostic" is not a product label on this page.** It is the
  site's only navigation, an anchor to `forecastability.html` inside a `nav`
  landmark. Stacking it under the wordmark where the strapline sits makes a
  link look like the second line of a wordmark. `docs/marketing-site.md`
  records that the header brand block is one link to `index.html` on every
  page, so the result would be two adjacent links that read as one block and
  go to different places.
- **The change is addressed to "the site masthead / app header lockup".**
  Those are two products that deploy from separate Vercel projects, per
  `CLAUDE.md` section 3. Only the site masthead was touched. If the change was
  written against Assay's header, it has not been applied there and should be
  re-aimed.

## 4. Four things in the change that could not be taken as written

**`--color-neutral-700` and `--color-neutral-300` do not exist.** The
repository has one neutral, `--color-neutral-brand: #cabfad`, which is the warm
brand neutral and not a ramp. This is the failure recorded on 7 September 2026
in `docs/build-response-6-2026-09-07.md`: the neutral ramp 300, 500, 800 and
900 lived in `styles.css`, which was deleted on 4 September 2026 in commit
`f2f2ca6`. **A specification written against that ramp is written against a
file this repository does not have.**

Substituted, and reported rather than done silently:

- `--color-neutral-700` on the label becomes `--color-text-muted`, `#66615f`,
  the site's quieter ink and the value the strapline already uses. Contrast on
  the header's paper ground is 6.1:1, computed, which clears AA for body text.
  The wordmark beside it is 10.81:1, so the gap between them is the hierarchy
  the change asks for.
- `--color-neutral-300` on the rule becomes `var(--color-divider)` at 1px,
  which is the site's own hairline, used in ten other places across the four
  pages. It is darker than a 300 would be. **If the design session wants the
  lighter edge specifically, it needs a token, and a new token is its
  decision, not a builder's.**

**"Wordmark unchanged: 19px/800, -0.01em" is not the wordmark that is live.**
The live value is `--wordmark-size: clamp(15px, 1.8vw, 18px)` with -0.02em
tracking, so 19px/-0.01em is a change, not the current state, and it
contradicts the change's own "not to change" list, which says the wordmark's
size and tracking do not move. A hand-written 19px would also fail
`test_no_page_carries_a_hand_written_size`. **The wordmark was left exactly as
it was.** If 19px is wanted, it is a change to `--wordmark-size` in
`tokens.css` and it needs saying explicitly.

**`var(--space-4)` exists and was used.** 16px, declared in `index.html`.

> **Corrected 18 September 2026.** That last clause was true when it was
> written and is not true now. Pull request 120 moved `--space-1` through
> `--space-4` into `tokens.css` on 17 September 2026 with their values
> unchanged, so every page can see them and none of them is declared in
> `index.html` any more. The sentence is left standing rather than rewritten,
> because this file is a dated record of what was measured on 16 September and
> editing that away would lose the reason the move was needed.

## 5. One thing the product owner should know before deciding

The pipe he asked for this evening is now a 1px rule. It is the same job done
with a structural edge instead of a character, which is what the change asks
for, but it is his glyph that was replaced. If he wants the pipe kept, that is
one line back.

## 6. What this does not cover

Nothing has been on Preview, Production or a real device. This session cannot
reach either, the network policy here refusing `vercel.app` and the site
itself. The measurements above are Chromium against a local server. Edge is
Chromium too, so a check on the PC would be the same engine; the iPhone is the
one that would cover WebKit.

---

# Answers from the design session, 16 September 2026

All four closed the same day. Recorded here rather than in the conversation
that carried them, because the conversation is not in the repository.

**1. Both substitutions accepted, and no new token.** `--color-text-muted` on
the label is right. The hairline stays `var(--color-divider)` at full ink. The
design session's reasoning, kept because it is the part that stops the question
being reopened: `tokens.css` records that this system does not fade its rules,
and inventing a faded value for a masthead divider would break that for the
smallest possible reason. **The subordination is carried by the 1px weight
against the header's 2px close, not by lightening the colour.**

**One conditional action is outstanding.** If the rule reads heavy in place,
the design session will look at the divider's height rather than its value.
Nobody has seen it in place yet, so this is live rather than closed.

> **Closed 18 September 2026.** The product owner looked at the masthead on a
> laptop. The rule reads right, so the condition is not met, the divider's
> height is not looked at, and the 1px value stands as built. This was the last
> open item from the masthead round.

**2. The wordmark does not move.** The 19px was an error: it came from the
Assay dashboard's scale and should not have been in a site changeset. "Not to
change" is the instruction that holds. `clamp(15px, 1.8vw, 18px)` at -0.02em
stays, and leaving it alone was right.

**3. Site masthead only, as applied.** Assay's header is out of scope and
stays untouched. "The site masthead / app header lockup" was drafting, not two
targets.

**4. Sentence case at 15px confirmed.** It is a navigation link, and 12px
uppercase would have made a second strapline out of it.

**On the preferred route**, the design session accepts that the alternative
was the real specification and should have been written as the only one once
the strapline was fixed in place.

## One thing in the reply that has not arrived here

The design session says the constraint about the deleted ramp is now written
into `design-decisions.md` above the token table, naming the commit and both
dates. **That amendment is not in this repository.** `docs/designdecisions.md`
on `main` at the time of writing contains no mention of the neutral ramp,
`styles.css` or `f2f2ca6`, checked by reading the file rather than by assuming.

The copy the design session amended is therefore the copy in the design
project, which no build session reads. **A control that lives where the people
it is meant to catch do not look is the same shape of failure as the ramp
itself**: the residue of an abandoned approach surviving in documentation. The
file is the design session's, not this session's, so it is not edited here.
**What is needed is the amended `docs/designdecisions.md` routed into this
repository the way the last version was**, through the product owner, and
committed.

Until then the constraint exists in two other places that builders do read:
`docs/build-response-6-2026-09-07.md`, which is where the deletion was first
reported, and this file.

> **Closed 18 September 2026.** The product owner routed it, and the three
> constraints are now in `docs/designdecisions.md` on `main`: that the file is
> the source and any design-project copy is a working copy, the dead ramp with
> the commit and the date, and a pointer to `tokens.css` instead of a second
> copy of the token list. He instructed this session to write them into that
> document directly, which is a named exception to the verbatim rule and is
> recorded as one in `docs/marketing-site.md`. The section above is left
> standing because the two misses are the argument for the constraint.
