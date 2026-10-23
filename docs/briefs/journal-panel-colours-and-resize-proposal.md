# Journal: panel colours and a Month resize handle (proposal)

Status: proposal for the product owner. No code has changed. 23 October 2026.
Branch: `journal-panel-design` (from `main` at 315eb6c). CLAUDE.md 9c to 9e stay in force until a ruling amends 9e.

## 1. Where the colours come from

Read from the Spud Notes repository (`5ktvrg9gfy-creator/spud-notes`, HEAD 3e93293), `looks.py` `PAPER_COLOURS` and its CLAUDE.md sticky section. Nothing here is invented.

| Peel | Body | Header | Fold |
|---|---|---|---|
| Yellow | #FCF0B8 | #F6E294 | #ECD47A |
| Green | #E0F0DC | #CDE6C8 | #B9D9B3 |
| Pink | #FBE0E7 | #F5CCD8 | #ECB6C6 |

**Spud Notes' own light and dark rule is that there is no dark value.** `looks.py` says each paper's colours "are the same in every look: a sticky is paper, so its text is always dark on it". Text is #2F2D2B, headings #1A1918, icons #4A4744 in Light, Dark and Yellow paper alike. So a Peel in the journal's dark theme is the same pale fill with dark text, and every light-on-dark journal colour fails on it (ink 1.1:1, strong 1.0:1, muted 2.4:1, icon 1.4:1; measured below).

### Recommendation

Follow Spud Notes: **one fill per Peel, the same in both themes, with dark text variables that are also the same in both themes.** The dark theme then shows three pale sheets on a dark page, which is what a sticky note is. Dark variants of the fills would be values Spud Notes does not have, which the brief rules out. Cost if wrong: the dark theme is brighter than the other two panels. Recorded as Q1.

## 2. New palette variables

Declared in all three theme blocks (light, dark under the media query, `[data-theme="dark"]`). The values are identical in the two themes by design, so the existing "dark blocks match" test still holds. Raw colour stays inside the theme blocks.

Per Peel (`yellow`, `green`, `pink`; hex shown as yellow / green / pink):

| Variable | Value | Job |
|---|---|---|
| `--notes-peel-<name>` | #FCF0B8 / #E0F0DC / #FBE0E7 | panel fill |
| `--notes-peel-<name>-hover` | #F6E294 / #CDE6C8 / #F5CCD8 | row hover (Spud header colour) |
| `--notes-peel-<name>-selected` | #ECD47A / #B9D9B3 / #ECB6C6 | drop target (Spud fold colour) |
| `--notes-peel-<name>-field` | #FEF9E3 / #F3F9F1 / #FDF3F5 | input fields (body mixed 60% toward white) |

Shared by the three Peels, so the tests read one set:

| Variable | Value | Job |
|---|---|---|
| `--notes-peel-ink` | #2F2D2B | entry text, calendar lines |
| `--notes-peel-strong` | #1A1918 | headings, counts, bullets |
| `--notes-peel-muted` | #66615F | hints, times, "N moved" |
| `--notes-peel-icon` | #4A4744 | icons, icon buttons |
| `--notes-peel-bad` | #A52A1F | bin on hover and focus, errors |
| `--notes-peel-focus` | #1A1918 | focus outline (see 3) |
| `--notes-peel-line` | the Peel's fold colour | hairlines inside a Peel (3 variables, one per Peel) |

Quick notes and Month keep `--notes-panel` and the existing variables. Twenty-one variables in all: 12 per Peel (four each), 6 shared (ink, strong, muted, icon, bad, focus) and 3 lines (one per Peel). `--notes-scrim` is unchanged.

## 3. Contrast, measured (WCAG relative luminance, computed from the declared values)

Text target 4.5:1, icons and focus 3:1.

On each Peel body (yellow / green / pink):

| Colour | Ratio | Result |
|---|---|---|
| ink #2F2D2B | 11.95 / 11.54 / 11.05 | pass |
| strong #1A1918 | 15.29 / 14.77 / 14.14 | pass |
| muted #66615F | 5.32 / 5.14 / 4.92 | pass |
| icon #4A4744 | 8.04 / 7.76 / 7.43 | pass (3:1) |
| bad #A52A1F | 6.20 / 5.99 / 5.73 | pass |
| good #356B46 | 5.47 / 5.28 / 5.06 | pass |
| warn #9A5A12 | 4.76 / 4.59 / **4.40** | **fails on pink** |
| accent #EC6917 (focus outline, marks) | **2.77 / 2.68 / 2.56** | **fails 3:1 on all three** |

Existing colours that fail, and the fix:

1. **Accent as the focus outline fails 3:1 on every Peel** (it is 2.73 on the plain panel already, so this is not new). Fix: on a Peel the outline is `--notes-peel-focus` (#1A1918, above 14:1), still 2px. Proposed for the plain panels too as a separate decision (Q4), not in this change.
2. **Warn fails on pink** (4.40). Fix: darken for Peels to #8F520F, or do not set warn text on a Peel. The journal shows warn nowhere on a panel today, so the proposal is no Peel warn variable, and a test that fails if warn is ever set on a Peel.
3. **Dark theme text colours** all fail on a Peel (section 1). Fix: the Peel text variables above, which a Peel panel uses in both themes.
4. **Hairlines** (`--notes-line`, 1.10 to 1.19) are decoration, not text, but they nearly vanish. Fix: the Peel's fold colour.

On hover (Spud header colour) and selected (Spud fold colour), yellow / green / pink:

| Colour | Hover | Selected |
|---|---|---|
| ink | 10.60 / 10.29 / 9.48 | 9.32 / 8.91 / 7.89 |
| strong | 13.56 / 13.17 / 12.13 | 11.93 / 11.40 / 10.09 |
| icon | 7.13 / 6.92 / 6.38 | 6.27 / 5.99 / 5.30 |
| muted | 4.72 / 4.58 / **4.22** | **4.15 / 3.96 / 3.51** |
| bad | 5.50 / 5.34 / 4.92 | 4.83 / 4.62 / **4.09** |

- **Muted fails on selected on every Peel and on pink hover.** This is the existing rule (muted is never set on the selected fill, 9d and 9e) applied to the new fills. Fix: the existing override, ink instead of muted while a Peel is a drop target or hovered. The test is extended to the Peel fills.
- **Bad fails on pink selected** (4.09). The bin is only red on its own hover or focus, and a row is not a drop target while the pointer is on its bin, so the pair does not occur, but a test should hold it. Fix if the test finds it: strong instead of bad on pink selected.

On the field fill (all three Peels): ink 12.6 to 13.0, strong 16.2 to 16.6, muted 5.6 to 5.8, icon 8.5 to 8.7, all pass. **The field is only 1.09 to 1.14 lighter than its body**, so a field needs its 1px border (`--notes-peel-line` darkened is not enough, so the border is `--notes-peel-icon`, 5.3 to 8.0 against the body) to read as a field. Proposed.

Tests to hold: every pair above, in both themes (identical values, so computed once per theme anyway), 4.5 for text, 3 for icons and focus, and a failing case proved to fail.

## 4. Month resize handle (1000px and up only)

- **Shape.** A 12px wide vertical strip on Month's right edge, inside the gap between columns, full panel height. Below 1000px it is not rendered.
- **Columns.** `grid-template-columns: <month> 1fr 1fr`, so the middle and right columns share the rest equally. `<month>` is a CSS variable set from the stored width.
- **Default.** One third of the window, as now (stored as "none", not a number, so the default keeps following the window).
- **Minimum 240px.** Month's date lines and count chip fit without cutting a date.
- **Maximum: the smaller of half the room the three columns have and that room minus 560px.** The room is the width of the panels area less its 12px padding and two 12px gaps. The other two columns never go under 280px each, which is about where entry rows start to cut text and where the 440px move-button rule is already decided (container query). At a 1000px window the room is 952px and the maximum is 392px; at 1280px it is 616px. **Corrected during the build, 23 October 2026:** this line first said "the window minus 560px" and "440px at 1000px", which ignored the padding and gaps and would have left the other columns 256px wide, under the 280px the same line promises. The promise is what was approved (Q3), so the arithmetic follows it.
- **If the window shrinks** under a stored width, the width is clamped on every layout and not rewritten in storage, so widening the window brings the choice back.
- **Remembered on this device only**, in `localStorage` under one key, in try/catch, with the page working if storage is blocked, like the theme. Not sent to the server, not cleared by Sign out (as the theme). The "nothing is kept but the theme choice and the last tab" statements in 3 and 9e gain "and Month's width".
- **Drag.** Pointer events with capture, mouse and finger (it only exists at 1000px and up, which includes large iPads in landscape). The width follows the pointer live and is saved on release. Nothing is saved while moving.
- **Keyboard.** The handle is a tab stop with `role="separator"`, `aria-orientation="vertical"`, `aria-label="Resize Month"`, `aria-valuemin`, `aria-valuemax` and `aria-valuenow` (px). Left and Right arrows move 16px (Shift 64px), Home goes to the minimum, End to the maximum. **Enter, or double-click, resets to the default.** Home and End are the "a key" for the extremes and Enter is the reset, so the reset is one obvious key.
- **Look.** No new colour, no shadow, no animation.
  - At rest: a 1px `--notes-line` rule down the middle of the strip (the existing seam colour).
  - Hover: the rule becomes 2px and `--notes-icon`.
  - Dragging: 2px `--notes-accent`, and the pointer is `col-resize` for the whole page for the drag. The accent is a mark, as 9 allows, and not a status.
  - Focus: the page's 2px accent outline, as everywhere else. The accent is below 3:1 on the page ground too (see Q4), so the proposal is `--notes-strong` for this one outline, which is the same fix as in 3.
  - Touch target: 44px under a coarse pointer, as 9e requires, drawn as an invisible widening of the strip and not a wider rule.
- **A drag that starts on the handle never starts an entry drag**, and text selection is switched off for the length of the drag.

## 5. What this needs ruled before building

See `docs/journal-panel-design-open-questions.md`. Building is about the size of the drag and drop tweak: the palette block and the CSS, the handle script, about twenty tests, a browser check and breakage proofs for the new rules only. CLAUDE.md 9e would be amended to allow the 21 variables by name, as 9d did for the notes pair.
