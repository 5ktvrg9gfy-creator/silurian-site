# Build response to the design handoff

From: the build session (Claude Code, marketing site repository)
To: the design session, via James
Date: 6 September 2026
Against: `designdecisions.md`, options 1A, 2B, 3C, 4A
Branch: `claude/silurian-marketing-site-wks2f7`, pull request 86, not merged

Everything below was measured in a browser against the repository, not read off the source. Where this document contradicts the handoff, the measurement is given so you can check it rather than take my word.

---

## 1. Executed as specified

| Item | Status |
| --- | --- |
| 1. Hero, headline at full content width | Done |
| 2. Services, eight items to three domains | Done |
| 3. Voice, second person and first person singular | Done |
| 5. Imagery, none | Done, recorded as a decision so nobody later reads the space as a gap |
| 4. Type scale | Six steps defined in `tokens.css`. Applied to `#about` only. See question 3 |

Rendered values at 1440, taken from computed style:

| Element | Specified | Rendered |
| --- | --- | --- |
| `h1` | 40px, 1.06, -0.03em, 800, no max-width | 40px, 42.4px, -1.2px, 800, uncapped |
| Subline | 19px, 800, 1.4, 34em, margin-top 20px | 19px, 800, 26.6px, 646px, 20px |
| Lower grid | 4fr / 7fr, gap 56, rule 2px, padding-top 40, margin-top 56 | 363.6 / 636.4, 56px, 2px, 40px, 56px |
| Numeral | 19px, 800, 1.35, accent | 19px, 800, 25.65px, `rgb(236,105,23)` |
| Domain title | 25px, 800, 1.2, -0.02em | 25px, 800, 30px, -0.5px |
| Detail line | 15px, 400, 1.5, muted | 15px, 400, 22.5px, `rgb(102,97,95)` |

The subline needed a correction you should know about: `<strong>` renders at 700, not the 800 the handoff specifies. Nothing but a computed style would have shown it. The weight is now set explicitly.

## 2. Two numbers in the handoff are wrong, and both are visible

The handoff opens by warning that a stale copy is the danger. That is exactly what happened, in a different form: **the size inventory read fixed `font-size` values and skipped every `clamp()`.** The headline is a `clamp()`, so it was never in the list.

**The headline is not 42px live. It is 57.6px at 1440px**, tapering to 33.2px at 390px. The rule is `clamp(36px, 4vw, 58px)`.

So this line in the handoff is false:

> **The headline size does not change.** It is 42px live; 40px is the scale step it snaps to. [...] The gain is the full width, not a larger size.

The gain is the full width. The **cost** is a 30 percent reduction at desktop. That is a large, visible change and James is being shown it before merge for that reason.

Everything else in item 1 holds, and the derivation was good: the headline needs **957.9px** on one line at 40px, against your predicted 958px, with 1056px available. That is as close as measurement gets.

**The same error affects the closing line.** "Tell me what needs to land, and by when." is 56px at 1440 (`clamp(34px, 4.2vw, 56px)`). The scale maps it to the 31px title step. That is a second 45 percent shrink, on the page's one accent field. **I have not applied it.** See question 2.

**The meta description diagnosis is also wrong.** The handoff says "either the file is not UTF-8 or the charset declaration is being missed". Neither. The file is valid UTF-8 and declares `<meta charset="utf-8">`. The stored bytes are `c3 a2 e2 82 ac e2 80 9d`, a double-encoded em dash: someone read UTF-8 as latin-1 and saved again. There are **39 such sequences in `index.html`**; the other 38 sit in CSS comments where nothing renders them, which is why only this one was visible. Fixed with a comma, which also satisfies the house dash rule.

Cardiff against Pontypridd: **closed by James on 6 September 2026.** Cardiff, Wales is his general location and is deliberate; the footer keeps Pontypridd as the registered office. Not a defect, do not raise it again.

## 3. Departures from the handoff, all deliberate

1. **Horizontal padding stays at the site's 72px, not the specified 64px.** The mock is a standalone artboard with its own container. On the real page the gutter is `--edge: clamp(20px, 5vw, 72px)` on `.wrap`, shared by the header, the contact band and the footer. Setting 64px on the section alone would misalign the headline against the wordmark directly above it. Content width is 1056px rather than your 1072px, and the headline still fits on one line with 98px to spare. **Top 72px and bottom 80px are as specified.**
2. **Detail lines are sentence case.** The handoff has "Operating model change, Site and network reconfiguration" and "Tech transfer, New Market Entry" with mid-sentence capitals. I read those as artefacts of a list being pasted into prose and lowered them. If they were deliberate, say so and they go back.
3. **The lower-left paragraph keeps its existing colour**, `color-mix(in srgb, var(--color-text) 78%, transparent)`, rather than moving to `--color-text-muted`. Your token table maps secondary text to the muted token, but it names the detail lines specifically, not the paragraph. See question 5.
4. **The headline's hard line breaks are removed.** It carried `<span class="line">` blocks, which force two lines regardless of width. A headline cannot set on one line while carrying them.

## 4. Better than predicted, one result worth having

The handoff expects the headline to wrap "below roughly 1000px of content width" and warns about a two-word last line reintroducing the orphan.

Measured at seventeen widths, **it holds one line down to 800px**, because the display step tapers as the viewport narrows: 40px at 1120px and above, 30px at 800px and below. At 768px it breaks into two balanced lines, "Independent programme and / project management." **The orphan does not appear at any width.** The taper is doing the work you expected a measure cap to do, which is why option 5B costs nothing here.

---

## Questions

Format is the house one: what it blocks, my recommended default, cost if wrong.

### Q1. Does the 40px display step still hold, now that the real baseline is 57.6px and not 42px?

- **Blocks:** the merge. James is looking at it now.
- **Recommended default:** hold 40px. One line at full width was the point of option 1A, and 57.6px cannot achieve it: the headline would need 1379px against 1056px available. The largest size that still sets on one line is about 44px, which needs 1053.7px and leaves 2px of slack, so it is not a real option.
- **Cost if wrong:** one value in `tokens.css`. The headline returns to two lines and item 1 is effectively withdrawn.

### Q2. The closing line: apply the 31px title step, leave it at 56px, or give it its own step?

- **Blocks:** finishing item 4 on `index.html`.
- **Recommended default:** do not apply 31px. The closing line is the accent field's only piece of type and reads as display, not as a section head. Either leave it on its current clamp, or add a second display step and say so, rather than folding a 56px display line into a 31px title step because both were called "heads" in the inventory.
- **Cost if wrong:** the page's one deliberate loud moment goes quiet, and it will be noticed after merge rather than before.

### Q3. The two open scale mappings, 11 to 12 and 16 to 15. What are they?

- **Blocks:** rolling the scale onto the rest of `index.html`, `forecast-risk.html` and `privacy.html`. A third of the scale being undecided is why only `#about` consumes it today.
- **Recommended default:** keep 11px for the uppercase micro-labels, since caps read larger than their nominal size and the handoff itself raises this. Leave `privacy.html` body at 16px, or put it on the 19px lead step: it is the one page with sustained reading and dropping it is the only change in the whole scale that costs legibility.
- **Cost if wrong:** two sizes, cheap to change, but they must be settled before the rollout rather than during it, or the scale ships with exceptions already in it.

### Q4. Confirm the 72px gutter over the specified 64px.

- **Blocks:** nothing today, it is already built at 72px.
- **Recommended default:** keep 72px, for the alignment reason in departure 1.
- **Cost if wrong:** one value, but changing it moves the header, contact band and footer with it, so it is a site-wide decision and not a section one.

### Q5. Which colour is the lower-left paragraph?

- **Blocks:** nothing, it is built with the existing treatment.
- **Recommended default:** leave it. It is body copy in its own column rather than a detail line beneath a title, and the two currently read as different levels, which is correct.
- **Cost if wrong:** one declaration.

### Q6. Are the domain detail lines final?

Your open question 1 says they were drafted and only confirmed as plausible, and that James supplied five separate lines that may want breaking out as sub-items rather than comma runs.

- **Blocks:** nothing, they are shipped as written.
- **Recommended default:** ship, then revisit in James's own words. The structure question, comma run against sub-items, is worth answering at the same time, since sub-items change the list's rhythm and the 44px numeral column's balance.
- **Cost if wrong:** copy only, no layout change, unless you go to sub-items.

### Q7. Do you want the type scale enforced by a test?

Colours are enforced: a raw colour on any of the three pages fails the build. **Type is not.** Nothing stops a new raw `font-size` appearing tomorrow, and the tokens hold by use only.

- **Blocks:** nothing yet. It matters after the rollout.
- **Recommended default:** yes, once Q3 is settled and the rollout is complete, and not before. A control that fires on the two thirds of the site not yet migrated would be ignored, and the repository's rule is that a control people learn to ignore is worse than no control.
- **Cost if wrong:** the scale drifts the way the colours did, quietly, and the next person finds sixteen sizes again.

### Q8. Where does a portrait go, if James ever supplies one?

Item 5 names two placements, beside the paragraph in the lower grid or above the call to action, and rules out the hero.

- **Blocks:** nothing. Asked now because the lower band's 4fr column has visible space beneath the paragraph at desktop, and that is the obvious slot.
- **Recommended default:** the lower grid, under the paragraph, at the paragraph's column width. It fills real space, it keeps the hero decision intact, and it puts the face next to the sentence about experience.
- **Cost if wrong:** a layout change, so worth deciding before anyone books a photographer.

---

## What the build session cannot do

No access to the live site, any Vercel preview, or a real device: outbound network is blocked by policy in this environment. Every render above is headless Chromium against the branch. The repository's own record notes that headless Chromium reproduces layout and colour faithfully and **does not reproduce platform control styling at all**, so anything involving a button, select or input is unproven until someone opens it on a phone. Nothing in this change involves a control, so that gap is narrow here.

The suite is 210 tests and passes. There is no CI: the checks on the pull request are Vercel deployments only and do not run it.
