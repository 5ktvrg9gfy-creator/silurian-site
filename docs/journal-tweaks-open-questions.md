# Journal tweaks: open questions

Each: what it blocks, the default built, and the cost if wrong. Brief: journal tweaks of 23 October 2026 (the bin, spell check, drag and drop). **None waiting. Q1 to Q4 were answered on 23 October 2026: all four defaults accepted.**

**Q1. A mouse has no More button, so a mouse user with no keyboard moves an entry by dragging only.**
Blocks: nothing. The brief says the move buttons no longer appear on hover and appear on keyboard focus.
Default built: for a device whose main pointer is a mouse, the More button is hidden at every panel width and the four buttons show on keyboard focus only. A finger keeps More unchanged. A laptop with a touchscreen reports a mouse as its main pointer and so drags.
Cost if wrong: someone who cannot drag and does not use a keyboard has no way to move an entry. Bringing More back for a mouse would be one CSS rule.

**Q2. "Keyboard focus" means after the Tab key.**
Blocks: nothing. A text box that has focus counts as focus whether it was clicked or tabbed to, so showing the buttons on focus alone would show them whenever a mouse user clicked into an entry, which is the covering the brief wants gone.
Default built: the page notes whether it was last worked by Tab or by a click, and shows the buttons on focus only after Tab. Typing does not change it, and moving the mouse over the buttons does not hide them. If the mouse is used while an entry has keyboard focus, the next click puts the buttons away, and the buttons sit left of the bin so the bin is never under them.
Cost if wrong: a keyboard user who moves to the mouse sees the buttons stay until they click. Switching to "show on any focus" is one rule and brings the covering back.

**Q3. Undo of a delete puts the entry at the bottom of its list, not where it was.**
Blocks: nothing. The brief says the message offers Undo as for moves.
Default built: as it has always been for deleting by clearing the text: Undo makes the entry again as a new one, because a removed entry keeps its id, and it is made now, so it sorts last. Its text, type and ticked state come back.
Cost if wrong: an entry deleted from the middle comes back at the bottom. Restoring the place is possible, since each entry knows when it was made, and is a small change.

**Q4. Only an open or ticked entry has a bin. A moved or dropped entry does not.**
Blocks: nothing. "Each entry gets a bin" could be read as every row.
Default built: the bin is on the entries that can be edited and removed by the rules (open and ticked, any type). A dropped task stays struck in the list with no bin, as it has no edit; an entry in the "N moved" line is a record of where it went and has none.
Cost if wrong: a dropped task cannot be deleted from the list. It would need the rules to allow removing a dropped entry.
