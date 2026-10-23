# Journal Peels and Month resize handle: evidence (23 October 2026)

Branch `journal-peels`, from `main` at `315eb6c`, with `journal-panel-design` (`a733f6e`, the approved proposal) merged in. Not merged to `main`. Journal only: `notes/` and `api/` are unchanged.

## What was built

- **Peels.** Today yellow, Tomorrow green, Migrate pink, in Spud Notes' own colours (`looks.py` `PAPER_COLOURS`), the same fill and dark text in both themes (Q1). Twenty-one palette variables, declared once and equal in all three theme blocks. Inside a Peel the page's own variables point at the Peel's, and a Peel sets its own `color`.
- **Fixes the proposal listed**, each held by a test: ink focus outline on Peels (colour only), no warn colour on a Peel, muted goes to ink while a Peel row is hovered or the Peel is a drop target, the bin stays icon coloured on a Peel that is a drop target, a field has an icon coloured edge.
- **Month resize handle**, 1000px and up: drag, arrow keys (16px, Shift 64px), Home, End, Enter or double click to reset, 240px minimum, maximum the smaller of half the room and the room minus 560px (392px at a 1000px window, 616px at 1280px), kept in `localStorage` under `silurian-journal-month-width` in try and catch, trimmed and never rewritten when the window is small, 44px under a coarse pointer.
- **A correction to the proposal, on the record:** its maximum ignored the padding and gaps (440px at 1000px, which left the other columns 256px, under the approved 280px). The build uses the real room. See Q3 in `docs/journal-panel-design-open-questions.md`.
- **Found by the browser check, not by the declared-variable tests (Q6):** text with no colour of its own inherited the body's colour inside a Peel, 1.25:1 in the dark theme. Fixed with `color` on the Peel.

## Runs

| Run | Result |
|---|---|
| `python -m unittest discover -s tests` in `forecast-app/` | 418 pass (398 before: 20 added in `JournalPeelsAndTheMonthHandle`, the palette test renamed) |
| `npm test` | 233 pass, unchanged |
| `node docs/evidence/journal/browser-check-journal.mjs` | 308 of 308 pass (243 before: sections 18 and 19 added, two old expectations updated for Peels) |
| `node docs/evidence/journal/browser-check-journal-lag.mjs` | 23 of 23 pass |
| `python docs/evidence/journal/breakages-peels.py` | 23 of 23 deliberate breaks caught, output in `breakages-peels-run.txt` |

The browser check measures every text, icon and mark as drawn on each Peel, light and dark, 4.5:1 for text and 3:1 for icons: 37 colours on Today alone, over 100 in all, so the check saw something. It also runs the handle with a mouse (drag, limits, storage written only on release, reload), the keyboard (every key), a double click, a shrinking window (trimmed to 392px, storage still 616), 999px and 390px (no handle), blocked storage, and a coarse pointer (44px). Screenshots: `shots/peels-light.png`, `peels-dark.png`, `handle-dragged.png`, `handle-focused.png`, `handle-dark.png`. The older light and dark screenshots changed because the page now has Peels.

## Not run

- `npm run test:vercel` (needs the network; the `api/` code is unchanged).
- Dragging the handle with a finger (no touch drag was run; only the 44px target was measured under a coarse pointer).
- Any check on the Vercel Preview or on a real iPad.

## Preview steps for the product owner

Light and dark (switch with the moon or sun button), at a window 1000px or wider:
1. Today is yellow, Tomorrow green, Migrate pink. Quick notes and Month are the plain panel colour. In dark mode the three Peels are still pale with dark writing.
2. Hover an entry on each Peel: a slightly darker shade of that Peel. A done or moved entry reads dark while hovered, grey otherwise.
3. Drag an entry onto each Peel: it takes a stronger shade of its own colour while you are over it.
4. Tab through Today: the focus outline is dark, not orange. In Quick notes it is still orange.
5. The "Add a task" line is lighter than its Peel with a dark edge.

Month handle, mouse:
6. A thin line sits between Month and Today. Hover: it thickens. Press and drag: it turns orange and Month follows, Today and Migrate stay equal.
7. Drag far left: Month stops at 240px. Far right: it stops with Today and Migrate each still wide enough to read.
8. Reload: the width is kept. Double click the line: back to a third.
9. Narrow the window to 1000px with a wide Month: it shrinks on the screen. Widen it again: your width comes back.
10. Below 1000px there is no handle.

Keyboard: Tab until the line shows a dark outline. Left and Right change the width, Shift takes bigger steps, Home and End go to the limits, Enter resets.
