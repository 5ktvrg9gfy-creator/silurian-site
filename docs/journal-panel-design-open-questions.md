# Journal panel colours and resize handle: open questions

Waiting: 0. All four answered by the product owner on 23 October 2026 (yes to each, as recommended). Built on branch `journal-peels`.

## Q1. In the dark theme, are the Peels the same pale fill with dark text?

**Answered 23 October 2026: yes.**

- Blocks: the whole colour half. Spud Notes has one value per Peel for every look (`looks.PAPER_COLOURS`, "the same in every look"), so there is no dark value to lift.
- Recommended default: yes. Same fills, same dark text variables, both themes.
- Cost if wrong: if a darker Peel is wanted, those are new values Spud Notes does not have, and I would need them from you or Design. About an hour to swap the values and rerun the contrast tests.

## Q2. Is "21 new palette variables" what you want, rather than fewer?

**Answered 23 October 2026: yes.**

- Blocks: the variable list and the 9e amendment.
- Recommended default: yes, named in 9e like `--notes-selected` and `--notes-scrim` were. A shorter list would need hover and selected to be derived in CSS, which would put raw colour maths outside the theme blocks and fail the raw colour rule.
- Cost if wrong: re-cutting the list, small.

## Q3. Resize limits: 240px minimum, and a maximum that leaves 280px for each other column?

**Answered 23 October 2026: yes.** **A correction, kept on the record:** the proposal gave the maximum as "the window minus 560px", 440px at a 1000px window. That ignored the 12px padding and two 12px gaps, and would have left the other columns 256px wide, under the 280px the answer approved. The build uses the room the columns really have, so the maximum is 392px at 1000px and 616px at 1280px, and the other columns keep 280px or more. Found by working the sum for the browser check, before anything shipped.

- Blocks: the handle's limits and its tests.
- Recommended default: as proposed in section 4 (440px at a 1000px window).
- Cost if wrong: a constant change and a test value.

## Q4. May the focus outline be ink on Peels and on the handle, and may plain panels follow later?

**Answered 23 October 2026: yes.** The plain panels, the page ground and the notes page keep the accent outline, which is under 3:1 there too (2.73:1 on the plain panel). That is a separate decision and is not in this change.

- Blocks: the focus pairs. The accent outline is 2.6 to 2.8:1 on every Peel, 2.73:1 on the plain panel, and under 3:1 on the page ground. 9c to 9e say the outline is a 2px accent, so this departs from them on Peels only.
- Recommended default: ink (`--notes-peel-focus`, #1A1918) on Peels and on the handle in this change. Raise the plain panels and notes as a separate decision, because it changes pages this brief does not touch.
- Cost if wrong: Peels keep an outline below 3:1, or the plain panels differ from the Peels until the later decision.

## Q5. A greyed entry on a Peel goes to ink while it is hovered (new, raised by the build)

- Blocks: nothing. Built to the proposal ("muted goes to ink where a Peel is hovered").
- What it means: on a hovered row of Today, Tomorrow or Migrate, a done, dropped or moved entry reads in the ink colour instead of grey until the pointer leaves, because muted is under 4.5:1 on the hover fill of the pink Peel (4.22:1) and the other two are close (4.6 to 4.7). It goes back to grey the moment the pointer moves off.
- Recommended default: keep it.
- Cost if wrong: a Peel-only exception to that rule, or a darker muted colour for every Peel, which would be a twenty-second variable.

## Q6. Text with no colour of its own inherited the page's colour inside a Peel (found by the browser check)

- What it was: the contrast tests read declared variables, and they passed. The browser check measured the drawn text and found strip text at 1.25:1 on the yellow Peel in the dark theme, because text with no colour of its own inherits the colour the body computed (light in dark), not the variable a Peel points elsewhere. Fixed by giving a Peel its own `color`. Held by `test_each_peel_points_the_pages_variables_at_its_own_and_only_its_own` and by the browser check, which measures every text and icon as drawn.
- Needs from you: nothing. Recorded so the next change to a Peel starts from it.
