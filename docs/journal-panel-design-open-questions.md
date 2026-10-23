# Journal panel colours and resize handle: open questions

Waiting: 4. Nothing is built until Q1 is answered.

## Q1. In the dark theme, are the Peels the same pale fill with dark text?

- Blocks: the whole colour half. Spud Notes has one value per Peel for every look (`looks.PAPER_COLOURS`, "the same in every look"), so there is no dark value to lift.
- Recommended default: yes. Same fills, same dark text variables, both themes.
- Cost if wrong: if a darker Peel is wanted, those are new values Spud Notes does not have, and I would need them from you or Design. About an hour to swap the values and rerun the contrast tests.

## Q2. Is "21 new palette variables" what you want, rather than fewer?

- Blocks: the variable list and the 9e amendment.
- Recommended default: yes, named in 9e like `--notes-selected` and `--notes-scrim` were. A shorter list would need hover and selected to be derived in CSS, which would put raw colour maths outside the theme blocks and fail the raw colour rule.
- Cost if wrong: re-cutting the list, small.

## Q3. Resize limits: 240px minimum, and a maximum that leaves 280px for each other column?

- Blocks: the handle's limits and its tests.
- Recommended default: as proposed in section 4 (440px at a 1000px window).
- Cost if wrong: a constant change and a test value.

## Q4. May the focus outline be ink on Peels and on the handle, and may plain panels follow later?

- Blocks: the focus pairs. The accent outline is 2.6 to 2.8:1 on every Peel, 2.73:1 on the plain panel, and under 3:1 on the page ground. 9c to 9e say the outline is a 2px accent, so this departs from them on Peels only.
- Recommended default: ink (`--notes-peel-focus`, #1A1918) on Peels and on the handle in this change. Raise the plain panels and notes as a separate decision, because it changes pages this brief does not touch.
- Cost if wrong: Peels keep an outline below 3:1, or the plain panels differ from the Peels until the later decision.
