# Journal tweaks: the bin, spell check and drag and drop, 23 October 2026

Branch `journal-tweaks`, cut from `main` at `de2f58d` (the notes revisions handoff merge). **Not merged.** Journal only; notes is not changed. Questions: `docs/journal-tweaks-open-questions.md` (four waiting).

## Records first

The product owner ran the notes revisions Production check (merge `92b85a0`) and every step passed. Recorded in `PROJECT_HANDOFF.md` and `docs/evidence/notes-revisions-evidence.md` on this branch. Reported by the product owner, not run by the build session. `notes-revisions` was confirmed merged to `main` before starting.

## What was built

1. **A bin on each entry.** The notes bin shape, quiet, turning `--notes-bad` on hover and on focus, 44px under a touch pointer (the existing icon button rule), named "Delete entry: " and the entry text. One click makes a new revision marked removed, with no question. The message bar says "Entry deleted." with Undo for ten seconds, which makes the entry again as a new one (a removed entry keeps its id). Deleting by clearing an entry's text now goes through the same function. The bin is on open and ticked entries (Q4). The journal's sprite holds twelve icons now, the bin being the twelfth.
2. **Spell check, UK English.** `spellcheck="true"` and `lang="en-GB"` on entry text, the new entry line, calendar lines and Quick notes. Notes is unchanged: its note box is still `spellcheck="false"` and carries no language tag.
3. **Drag and drop, mouse only.** With a mouse an entry is dragged onto Today, Tomorrow, Migrate or a date line from today on in Month. The drop calls the same function as the move buttons (`moveEntry`), with "migrated" for a panel and "scheduled" for a date line, as the Date picker does, so the revision files, the arrow on the original and the message with Undo are the same. The panel or date line under the pointer takes the `--notes-selected` fill, with what is muted on it set to the strong text, and no new colour. Dropping on the list the entry is already in does nothing and marks nothing. A drag starts anywhere on the row except in the text while it is being edited, so selecting words still works. Only a marker travels with the drag, never the entry's text.
4. **The move buttons are for the keyboard.** They no longer show on mouse hover and a mouse has no More button; they show when an entry has focus after Tab (Q1, Q2). In a wide panel they sit left of the bin so the bin is never under them. A finger keeps More and the buttons unchanged, and nothing is draggable.
5. **CLAUDE.md** section 9e records the three rulings, product owner 23 October 2026, and the test names.

## Tests

* **Static, `forecast-app/tests/test_journal_page.py`:** `test_each_entry_has_a_bin_that_deletes_at_once_with_an_undo`, `test_spell_check_is_on_for_entries_calendar_lines_and_quick_notes_in_uk_english` (including that notes stays as it is), `test_a_drag_does_what_the_move_button_does_to_each_target_and_nothing_to_the_same_list`, `test_a_drop_target_takes_the_selected_fill_and_no_new_colour` and `test_a_mouse_drags_so_the_moves_are_not_offered_on_hover_and_they_show_on_keyboard_focus`. Changed: the icon count test (eleven to twelve, with the bin's shape), the undo of a delete test (now on `deleteEntry`), and the old "a move row goes to the right in a wide panel for a mouse only" test, replaced by the keyboard one.
* **Browser, `docs/evidence/journal/browser-check-journal.mjs`:** a new section 7b. Spell check attributes on the four places and absent in notes; the bin (named, quiet then red on hover and on focus, one click, "Entry deleted." and Undo, the removed revision on the server, Undo making one entry, the message going after ten seconds); a drag by hand with the fill checked over each target (Tomorrow, the panel it is in, a date before today, a date line); drops on Tomorrow, Migrate, Today and a date line each making exactly one copy, with the same messages as the buttons; a drop on its own list writing nothing; hover showing no buttons while keyboard focus does; a click into the text putting them away; a double click selecting a word and not starting a drag; and a 375px touch context in which More, the buttons and a tap on Tomorrow work as before, nothing is draggable and the bin is 44px. Existing moving checks now move by keyboard where they used a mouse and More.
* **Under the 60 second stand-in, `browser-check-journal-lag.mjs`:** the moves in it are now drags (to Tomorrow, to Migrate, to a date line), the Date picker by keyboard, and two more drags each with the first answer lost once. Each makes exactly one copy.
* **Deliberate breakages, the new rules only** (`breakages-tweaks.py`).

## What ran

* `npm test`: **233 before, 233 after, all pass** (no Node test changed; the storage is untouched).
* `forecast-app` suite: **394 before, 398 after, all pass.**
* `npm run test:vercel`: ran, passes.
* `browser-check-journal.mjs`: **243 of 243** (214 before). Screenshots regenerated at every width in both themes, and two new ones (`focus-1920-light`, `drag-over-a-date-1920-light`) replace the two hover ones.
* `browser-check-journal-lag.mjs`: **23 of 23** (21 before), in `lag-browser-tweaks-after.txt`.
* **Deliberate breakages: 19 of 19 caught** (`breakages-tweaks-run.txt`): a confirm before delete, a changed or missing message, an unnamed bin, no Undo, spell check off or not UK English in each of the three places, spell check turned on in notes, a drop on the list the entry is in, a drop that does not use the buttons' move, a date line using the wrong move, a date before today, a finger dragging, a drag that picks the row up from text being edited, another fill, the entry's text in the drag, buttons on hover, keyboard focus never showing them, and a mouse getting More.
* **While building**, three checks of my own failed and were fixed: the move buttons in a wide panel covered the bin when keyboard focus showed them (they now sit left of it); the drag tests asserted the fill before the browser had sent its drag events; and a double click aimed at the middle of a short entry's wide text box selected nothing.
* Not run: the Preview, Edge, Safari, a real iPad, and a real mouse on a real PC. A scripted browser mouse drives the drag events. **What it cannot show:** how a drag feels, whether Edge's own drag image looks right, and whether a touchscreen laptop behaves as Q1 says.

## Preview steps for the product owner

**On the PC (Edge, mouse and keyboard):**
1. **The bin.** Make a task. Hover its bin: it turns red. Click it: the entry goes at once, with "Entry deleted." and Undo. Press Undo within ten seconds: it comes back. Delete another and leave it: the message goes after ten seconds and the entry stays gone after a reload.
2. **Spell check.** Type "recieve" in a new entry, in a calendar line and in Quick notes: each is underlined red, and right-click offers UK spellings ("colour", not "color"). Open Notes: it is not underlined there.
3. **Drag.** Drag a task by its dot from Today onto the Tomorrow panel: the panel turns the beige selected colour while you hold over it, then the task is in Tomorrow, "1 moved" shows in Today, and the message says "Moved to Tomorrow." with Undo. Do the same onto Migrate, and from Tomorrow back onto Today. Drag one onto a date line in Month, two weeks on: the line turns beige and the message names the day with Undo and Open day. Drag one onto a date before today: nothing happens. Drag one onto the panel it is already in: nothing happens.
4. **Text still selects.** Click into an entry's text, then drag across the words: they are selected and nothing moves.
5. **No buttons over the text.** Hover an entry: no move buttons appear. Press Tab until an entry has focus: Tomorrow, Migrate and Date appear, and each works with Enter.

**On the iPad (touch):**
6. **Unchanged.** Each entry has the More button and a bin. Tap More: Tomorrow, Migrate and Date appear and work as before. Entries do not drag. Tap a bin: it deletes with the message and Undo. Spell check underlines a misspelling in an entry and in Quick notes.
7. **If anything disappears, doubles or moves to the wrong place.** Do not retry. Note the time, what you did and what you saw, and report it.

## Preview of `567fc36`: passed, 23 October 2026

Reported by the product owner, not run by the build session. Every step passed on the PC in Edge and on the iPad: the bin with Undo; UK spell check in the journal and not in notes; a drag to Tomorrow, Migrate and a date line with the drop fill and the matching message; nothing on a past date or on the same panel; word selection while editing; no buttons on hover and buttons on Tab; the iPad unchanged. Q1 to Q4 accepted as built. Approved to merge by pull request pinned to the reviewed head.

## Production check list for the product owner

1. Open https://www.silurianconsulting.co.uk/journal on the PC in Edge, signed in. Your entries are all there. (The installed app updates itself; if it looks unchanged, close and reopen it.)
2. Make a task, hover its bin (red), click it: it goes with "Entry deleted." and Undo. Undo brings it back.
3. Type "recieve" in an entry, a calendar line and Quick notes: underlined, with UK spellings offered. Open Notes: no underline there.
4. Drag a task by its dot onto Tomorrow, then Migrate, then a date line two weeks on: the target turns beige and the message matches the button's, with Undo. Dragging onto a past date or onto the panel it is in does nothing.
5. Hover an entry: no move buttons. Tab to an entry: they appear and work with Enter.
6. On the iPad: More and the buttons work as before, nothing drags, the bin deletes with Undo.
7. If anything disappears, doubles or moves to the wrong place, do not retry. Note the time and report it.

## Production result (23 October 2026)

The product owner ran the Production check list above against merge `28a745cbb9d38b55f867caf8045595ced8b57d43` and every step passed. Reported by the product owner, not run by the build session.
