# Journal: design brief for /journal

Design for the planning session's build brief. Not built. Not merged. Builds on `CLAUDE.md` sections 9c and 9d: same palette variables, type size variables, 8px and 6px corners, 1px borders, 2px accent focus outline, no shadows, no uppercase, light and dark. The 9b note box ruling does not apply: the journal has no monospace anywhere. Follows the Bullet Journal method (Ryder Carroll): rapid logging, monthly log, daily log, migration.

Choices the owner did not decide are in `docs/journal-open-questions.md`, each with the default used here. Every contrast ratio below is computed from the declared values in `notes/index.html`, not estimated.

---

## 0. The model in four lines

* An **entry** has a type (task, event, note), a state, and text with optional bold and strike-through.
* States: **open**, **done** (tasks only), **migrated** (moved forward, right arrow), **scheduled** (moved to a date, left arrow), **dropped** (tasks only, struck, kept).
* A **list** is Today, Tomorrow, Migrate, or the log for any other date. A **calendar line** is one line of free text per date, shown in Month.
* Moving an entry never deletes it. The original stays in place, greyed, with its arrow. A copy lands at the bottom of the target list, just above the add bar.

---

## 1. Panel layout

Five panels, always in this order: Month, Today, Tomorrow, Migrate, Quick notes. Each panel is a card: `--notes-panel` fill, 1px `--notes-line` border, 8px corners, no shadow, on a `--notes-ground` page. Header is the same 65px bar as notes (`--notes-header-height`).

| Window | Width | Layout |
|---|---|---|
| Wide desktop | 1400px and up | Five columns in one row, filling the window. Each panel scrolls inside itself. |
| Typical desktop window, iPad landscape | 1000 to 1399px | Three columns, two rows, filling the window. Month is the left column and spans both rows. Today and Tomorrow sit on the top row, Migrate and Quick notes on the bottom row. |
| Small window, iPad portrait | 761 to 999px | Two columns. Month is the left column, sticky below the header and as tall as the window, scrolling inside itself. The right column stacks Today, Tomorrow, Migrate and Quick notes, and the page scrolls. |
| Phone | 760px and below | One panel at a time with a bar of five tabs fixed to the bottom: Month, Today, Tomorrow, Migrate, Quick. Opens on Today. |

Detail that decides the build:

* **Typical desktop window means 1280 by 800.** Three columns of about 400px, rows of about 340px. Today shows about nine rows before it scrolls.
* **The add bar (section 2) is fixed to the bottom of each panel** and the list scrolls above it, so James never scrolls to find where to type.
* **Tabs on phone are text only**, 44px tall, equal width, 1px top border, selected tab on `--notes-selected` with `--notes-strong` text. The word "Quick" is the tab, the panel heading says "Quick notes".
* **The last tab used is remembered on the device** in `localStorage` inside try and catch, as the theme is. It is a convenience only. Without it the phone opens on Today.
* **Window size and position are the browser's job.** Edge and Chrome remember an installed app's size and place per window, and iPadOS manages its own. The page can do nothing about the sticky note problem beyond opening in one stable window. Tell James this once, in the hand over, so he does not expect a setting that does not exist.
* **Month always opens at the current month with today near the top** of its scroll, so the first thing seen is today and the next few days.

---

## 2. How an entry looks, and how James picks the type

An entry is one row: a bullet cell, the text, a state word where needed, and the move controls (section 3). Minimum row height is 36px with a mouse and 44px on a touch screen, chosen by `@media (pointer: coarse)`. Text is `--notes-size-15`, wraps, never truncates in a daily list.

| State | Bullet | Text | Extra | Bullet button does |
|---|---|---|---|---|
| Task, open | Dot | `--notes-ink` | none | Marks it done |
| Task, done | Cross | `--notes-muted`, struck through | none | Marks it open again |
| Event | Circle | `--notes-ink` | none | Nothing |
| Note | Dash | `--notes-ink` | none | Nothing |
| Migrated | Right arrow | `--notes-muted` | 12px muted words after the text: "to Tomorrow", "to Migrate", "to Today" | Nothing. Undo is the message bar for ten seconds. |
| Scheduled | Left arrow | `--notes-muted` | 12px muted words: "to 28 Oct" | Nothing |
| Dropped | Dot | `--notes-muted`, struck through | 12px muted word: "Dropped" | Nothing |

Rules for these:

* **Grey is a colour, never opacity.** Opacity would move the contrast off the computed pairs. Muted on `--notes-panel` is 5.23:1 light and 5.91:1 dark. Muted on `--notes-hover` is 5.01:1 and 4.81:1. All above 4.5:1.
* **State is told twice**, shape and words. A done task is a cross and a strike. A dropped task has a strike and the word "Dropped", because a strike alone looks the same as done once the cross is ignored. Remove all colour and every state still reads.
* **The bullet is the button for tasks only.** It is 32px square with a mouse and 44px on touch, `aria-label` "Mark done" or "Mark not done", `aria-pressed` set. Event, note, migrated, scheduled and dropped bullets are plain images with the state in the row's screen reader text.
* **Click the text to edit in place.** Enter saves and stays in the list. Escape puts the old text back. Clearing the text and leaving the row deletes the entry, with the message bar "Entry deleted." and Undo. There is no delete button. That keeps deletion off the move controls, where a mis-tap costs the most.
* **A done task stays where it is.** It does not sink or hide. Sorting is a second decision (Q4).

### Picking task, event or note when typing

Each list has one **add bar** at the bottom: an input on the first row, then a row of controls.

* **Row one, input.** Placeholder says the current type in words: "Add a task", "Add an event", "Add a note". Enter adds the entry and keeps the cursor in the input so a run of entries goes in without lifting hands. `enterkeyhint="enter"`.
* **Row two, type buttons.** Three buttons, dot, circle and dash, each 36px with a mouse and 44px on touch, with `aria-label` "Task", "Event", "Note" and `aria-pressed`. The chosen one sits on `--notes-selected` with a `--notes-strong` bullet. Task is the default. **The type is remembered per list until the page reloads**, so a run of notes stays notes.
* **Keyboard on a PC:** `Alt+1` task, `Alt+2` event, `Alt+3` note, while the add input has focus. They work from the first character typed to the last.
* **Typed prefix, for people who think in symbols:** on an empty add input, `. ` and a space makes it a task, `o ` an event, `- ` a note. The prefix is eaten. **Backspace straight after it puts the characters back**, so a line that really starts with "o" is never lost. The placeholder updates so the change is visible.
* **Calendar lines in Month default to Event** and have no type buttons. They are plain text, bold and strike-through allowed.

---

## 3. Where the migration actions sit

Every entry can move, whatever its type, so long as it is open or a note or event. A migrated, scheduled, dropped or done entry shows no move controls.

Four actions, in this order: **Today**, **Tomorrow**, **Migrate**, **Date**.

| Action | Result on the original | Where the copy lands |
|---|---|---|
| Today | Right arrow, "to Today" | Bottom of Today |
| Tomorrow | Right arrow, "to Tomorrow" | Bottom of Tomorrow |
| Migrate | Right arrow, "to Migrate" | Bottom of the Migrate list |
| Date | Left arrow, "to 28 Oct" | Bottom of the log for that date |

The arrow follows the method and the owner's words: right arrow for moved forward, left arrow for scheduled. Moving **to Today** from Today itself, or to Tomorrow from Tomorrow, is not offered. The row hides the action that points where it already is.

### Mouse and keyboard

* On hover and on keyboard focus anywhere in the row, the four actions appear right aligned as text buttons: 28px tall, `--notes-size-13`, 1px `--notes-line` border, 6px corners, 12px side padding. They replace the "to ..." words only while shown and never move the text.
* Focus order: bullet, text, then the four actions. No hidden shortcut keys, so nothing to learn and nothing to clash with the browser.
* Below 1000px with a mouse, the same four buttons show on hover. A mouse and a touch screen on one device (Windows touch laptops) get the touch layout when the pointer is coarse and the hover layout when it is fine.

### Touch, 44px targets

* A **More button** sits at the end of every movable row, 44px by 44px, the `More` icon, `aria-label` "Move this entry", `aria-expanded`. It is visible all the time on coarse pointers.
* Tapping it **opens a second line inside the row**, pushing the list down. No popover, no sheet, no shadow, no scrim. The line holds four buttons, each 44px tall, `--notes-size-14`, flex wrapping so they sit four across in a wide panel and two by two in a narrow one.
* Tapping an action moves the entry and closes the line. Tapping More again closes it without moving anything. Only one row is open at a time.

### Date

* **Date** opens the month picker (section 4) inside the same expanded line, in a small mode: month name with 44px arrows, then the dates as a list.
* **Dates are rows, not a grid.** A seven column grid on a 320px phone gives 41px wide cells, short of 44px. A list of rows is 44px tall and the full width. Each row says weekday and date, "Fri 23 Oct". Dates before today are not offered. The list is as tall as six rows and scrolls inside itself.
* Today's and tomorrow's rows carry the same words as in Month: "Today", "Tomorrow".
* The picker defaults to the month in view in Month. A scheduled entry for the 3rd of next month is two taps on the arrow away.

### After a move

A message bar (the one notes version 4 uses) says what happened and offers Undo: "Moved to Tomorrow." "Scheduled for 28 Oct." Undo puts the original back to its old state and removes the copy, as long as the copy has not been edited or ticked. If it has, Undo is not offered and the message bar says so in a line, so nothing is lost by undoing something that has moved on.

---

## 4. Month, the month picker, today and tomorrow

### The panel

* **Header:** previous month (44px, `Chevron left`), the month and year as a button, next month (44px, `Chevron right`). A "This month" text button appears at the right only when another month is showing, and returns to the current month with today in view.
* **Body:** one row per date, 36px mouse and 44px touch. Left to right: the date number, a weekday letter, then the calendar line, an editable single line of text. Entries logged for that date show as a count chip at the right edge ("2"), in the notes chip shape, so a date with a plan is visible at a glance.
* **Calendar lines are free text.** They are where James writes the things that happen on that date. They are not entries and have no bullet, state or move controls (Q1).

### The picker

* The month name is a button. It opens an **inline month list in the panel body**: four columns by three rows, 44px cells, month names, with year arrows in the header. Choosing a month closes it and shows that month. Escape closes it without a change.
* **Native month input is not used.** It cannot take the palette on either Edge or Safari and adds a system popover the page cannot theme.

### Marking today and tomorrow

State is told twice, fill and word. Neither is colour alone.

* **Today:** row on `--notes-selected`, the word "Today" at `--notes-size-12` weight 600 after the date. Text on it is `--notes-strong` or `--notes-ink` only, **never muted**, as 9d requires. Pairs on `--notes-selected`: strong 12.91:1 light and 10.25:1 dark, ink 10.08:1 and 8.64:1, icon 6.78:1 and 7.03:1.
* **Tomorrow:** row on `--notes-hover`, the word "Tomorrow" in `--notes-ink`. Ink on hover is 11.25:1 light and 10.33:1 dark.
* Nothing else in Month is filled. Weekends are not marked.
* The marks move at midnight: the page checks the date every minute and on becoming visible, so a window left open overnight is right in the morning.

### Clicking a date

* **Clicking the date number or weekday opens that day's log in the Month panel.** The calendar is replaced by that date's list, with the add bar. The header becomes `Chevron left` and "Back to October" at the left and the date at the right. **Back is that button, Escape, and the browser or system Back on a phone.** There is no sixth panel and nothing to close.
* **Clicking the calendar line edits it.** It never opens the log. The two targets are distinct: the date number is a button, the line is an input.
* **For today and tomorrow, the date opens nothing.** It moves focus to the add input in the Today or Tomorrow panel, and on a phone switches to that tab. There is only ever one editable copy of a list on screen.
* Any other date, past or future, opens fully editable. A past date is not read only.
* Returning to Month restores the scroll position and the month that was showing.

---

## 5. The morning strip: Bring forward or Drop

* **A block at the top of Today**, above the list, only when there is something to deal with. If there is not, nothing renders and no space is held.
* **It looks like a block, not a row:** `--notes-field` fill, 1px `--notes-line` border, 6px corners, 12px padding.
* **Heading, in `--notes-size-14` weight 600:** "From yesterday, 4 open tasks" for one earlier day, or "From Friday 16 October, 3 open tasks" when it is not yesterday. One earlier day at a time, the most recent that has open tasks (Q2). Heading says whose problem it is: these are the tasks he left open.
* **Each task is one row:** bullet, text, then two buttons.
  * **Bring forward**: the primary button, accent fill, `--notes-on-accent` text (5.52:1).
  * **Drop**: the plain bordered button.
  * Mouse: 32px tall, side by side at the right. Touch, or in a panel under 320px wide: 44px tall, the two buttons on their own line under the text, equal width.
* **One more control, "Bring all forward"**, shown only when more than one task is waiting, at the foot of the block. There is no "Drop all". Dropping many at once is the one move that cannot be seen to be right.
* **Bring forward** puts a copy at the bottom of Today and gives the original a right arrow, "to Today". **Drop** strikes the original and marks it "Dropped". Both are kept (section 2). Both show the message bar with Undo.
* **Nothing moves by itself.** If James never opens the app, nothing changes. The strip is simply there on the next open, with the date in the heading.
* When the last task is handled the block disappears. The message bar says "All handled." once.
* Tomorrow is not mirrored this way. Only Today has a strip.

---

## 6. Bold and strike-through

* **Two buttons, `B` and `S`**, set in the page's UI type, `B` in weight 700 and `S` with a strike. They are 36px with a mouse and 44px on touch, `aria-pressed`, labelled "Bold" and "Strike-through". They sit at the right of the add bar's second row, and in the Quick notes header.
* **They act on the text selected in whatever field has focus.** With nothing selected they switch the style on for the next characters typed, and the button shows pressed.
* **Keyboard, Windows:** `Ctrl+B` bold, `Ctrl+Shift+X` strike-through. On an iPad with a keyboard, `Cmd+B` and `Cmd+Shift+X`. `Ctrl+Shift+X` is the strike-through shortcut in Slack and Teams, so it is already in the fingers. The shortcuts are written in the buttons' `title` and `aria-keyshortcuts`.
* **No italics, no headings, no colours, no lists, no links.** Pasted text arrives as plain text.
* **Stored as text with `**bold**` and `~~strike~~` markers,** shown rendered. James never sees the asterisks while editing, and a pasted line with them is still a literal line to him once rendered. This is the one place the page parses user text, and it never builds markup from it: it makes text nodes inside `<strong>` and `<s>` only, so a note can never carry a script.
* A struck done task has the row strike from state and any inline strike from the text. They look alike. That is accepted: the bullet and the words in the state column separate them.

---

## 7. Installing: name, icon, window title, theme colour

| Item | Value |
|---|---|
| Name | Journal |
| Short name | Journal |
| Window title | Journal |
| Start address and scope | `/journal/` for both. A start address outside the scope fails the install test. |
| Display | `standalone` |
| Orientation | any |
| Theme colour and background | `#faf8f5` light, `#262422` dark |
| iPad | Add to Home Screen from Safari. Tags: `apple-mobile-web-app-capable` yes, `apple-mobile-web-app-title` Journal, `apple-mobile-web-app-status-bar-style` default. |

* **The theme colour is the page ground in both themes.** The title bar of the window then reads as the header and the page, one surface. A manifest holds one colour, so it carries the light value. The page sets two `meta name="theme-color"` tags with `media="(prefers-color-scheme: ...)"`, and the theme switch rewrites the tag when James overrides the device. The two hex values equal `--notes-ground` in each theme, and a test reads them against the variables so they cannot drift.
* **Those two hex values are the only raw colours outside the theme blocks**, and they sit in a `<meta>` attribute and the manifest, not in CSS. The existing raw colour test has to be told that in the journal's copy of it, by attribute name.
* **No service worker.** Chrome and Edge on Windows install from a manifest alone, and the notes rule is `no-store` for everything, so a worker would only cache what must not be cached. This is checked on the Preview, not assumed: if Edge does not offer Install, a worker that does nothing is the fix, recorded in the evidence. It means **no offline use**: with no network the window shows the browser's own error. Q6.
* **Manifest and icons must be public and ungated.** A browser fetches them without the sign-in cookie. They hold nothing private. They go in `site-allowlist.txt` and `PUBLIC_FILES`, are marked noindex like the page, and the pinned list of five marketing pages stays at five.
* **Icon.** A full bleed orange square with three journal bullets: dot, circle, dash, each with a line. Full bleed so the same file works as a maskable icon and as the iPad touch icon, which cannot have transparency. Everything sits inside the central 80 percent that masks keep. Ink `#1a1918` on `#ec6917` is 5.52:1.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ec6917"/>
  <circle cx="160" cy="176" r="22" fill="#1a1918"/>
  <circle cx="160" cy="256" r="18" fill="none" stroke="#1a1918" stroke-width="8"/>
  <path d="M142 336h36" fill="none" stroke="#1a1918" stroke-width="8" stroke-linecap="round"/>
  <path d="M224 176h128M224 256h128M224 336h128" fill="none" stroke="#1a1918" stroke-width="12" stroke-linecap="round"/>
</svg>
```

Export it at 192, 512 and 512 maskable for the manifest, 180 for the iPad, and a 32 for the tab. Five files, listed in the allowlist.

* **The manifest, for the build to start from:**

```json
{
  "name": "Journal",
  "short_name": "Journal",
  "description": "A private bullet journal.",
  "start_url": "/journal/",
  "scope": "/journal/",
  "display": "standalone",
  "background_color": "#faf8f5",
  "theme_color": "#faf8f5",
  "icons": [
    { "src": "/journal/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/journal/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/journal/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

* **In the notes menu**, Journal is the last item, after Archive, same row shape, with the new `Journal` icon. It is a plain link to `/journal/`. In the journal header, "Notes" is a plain link back to `/notes`. Inside the installed window that link leaves the scope, and Edge and Chrome show their small address strip with a back arrow when it does. Expected, and worth one look on the Preview.

### Header

Wordmark "Journal" on the left (Archivo, as notes). On the right: "Notes" link, theme switch icon button (44px), "Sign out" text button. At 320px these measure about 266px of 288px, so they fit without a menu. Minimal navigation: that is the whole of it. The theme choice is the one notes uses, held on the device only, not cleared by sign out.

---

## 8. Sign-in, and empty states

### Sign-in inside the window

* The page asks `GET /api/session` first. A 401 shows the same sign-in form notes shows, with the heading "Journal": one password field, one button, same endpoint, same copy. The cookie is the notes cookie, so **signing in to either signs in to both** for 30 days, on that device and browser profile.
* **Edge and Chrome on Windows:** the installed window shares the browser's cookies. If he is already signed in to notes, the app opens straight in.
* **iPad home screen app:** iPadOS keeps its storage apart from Safari, so he signs in once inside the app. Same field, same button.
* Wrong password: "That password is incorrect." Server not reachable: "Could not reach the server. Try again." Both exactly as notes words them.
* **Sign out** is notes' `DELETE /api/session`: the page empties itself, and Back and refresh show only sign-in. The notes limit holds and the owner has accepted it: a copy of the cookie taken before sign out lives until it expires. If a device is lost, change `SILURIAN_NOTES_PASSWORD` and redeploy, which signs out the journal as well.
* Signed out, nothing is drawn behind the form. No panels, no dates, no counts.

### Empty states

Each says what is shown, what is not, and what to do next. Sentence case, no dashes.

| Where | Copy |
|---|---|
| Today, no entries | "Nothing logged for Thursday 22 October yet. Type a task, an event or a note below." |
| Tomorrow, no entries | "Nothing planned for Friday 23 October yet. Add a task or event below, or move one here from another list." |
| Any other date's log | "Nothing logged for Monday 2 November. Type a task, an event or a note below." |
| Migrate, no tasks | "No tasks waiting this month. Add one below, or choose Migrate on any entry to park it here." |
| Month, nothing on any line or log | "Nothing on the calendar for November yet. Click a date to add a line, or open a date to log it." |
| Quick notes, empty | "Type anything here. It has no date and stays until you delete it." |
| Strip, nothing open | Not drawn. |

* A calendar line with no text shows nothing until focus, then the placeholder "Add to 23 October". Thirty one placeholders on screen is noise.
* Count chips never show "0".

### Messages

* Save failed: "Could not save that change. Nothing was changed. Try again." (notes' own words)
* Could not load: "Could not load your journal. Check your connection and reload."
* Changed on another device: "This changed on another device. Your text is still on screen. Reload to see the latest, then add it again."
* Entry deleted: "Entry deleted." with Undo.

---

## 9. Icons and colour variables

### Colour variables

**None are added.** Every pair is an existing variable on an existing ground. Computed from the declared values:

| Text on fill | Light | Dark | Used for |
|---|---|---|---|
| `--notes-ink` on `--notes-panel` | 11.76 | 12.68 | Entry text |
| `--notes-muted` on `--notes-panel` | 5.23 | 5.91 | Done, migrated, scheduled, dropped |
| `--notes-muted` on `--notes-hover` | 5.01 | 4.81 | Greyed row while hovered |
| `--notes-muted` on `--notes-field` | 6.10 | 5.44 | Strip and add bar |
| `--notes-ink` on `--notes-hover` | 11.25 | 10.33 | "Tomorrow" row |
| `--notes-strong` on `--notes-selected` | 12.91 | 10.25 | "Today" row, chosen type button |
| `--notes-ink` on `--notes-selected` | 10.08 | 8.64 | Today row text |
| `--notes-icon` on `--notes-selected` | 6.78 | 7.03 | Bullets on the selected fill (3:1 needed) |
| `--notes-on-accent` on `--notes-accent` | 5.52 | 5.52 | Bring forward |
| `--notes-muted` on `--notes-selected` | 4.49 | 4.02 | **Never used.** Below 4.5:1, which is why 9d forbids it. |

Two things for the build to know. **Greyed text in Month must never sit on the Today row.** And the accent focus outline, 2px, is 2.73:1 against `--notes-panel` in light mode, below the 3:1 for a non-text mark. It is notes' own existing outline and passes in dark at 5.28:1. Not changed here: it is a 9c decision, so it goes to the owner as Q7 rather than being quietly altered for one page.

### Icons

The journal page carries its own sprite, in the notes format: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, round caps and joins. **Eleven symbols, nine new.** Two dots use a wider stroke on the symbol or path, because a dot drawn at 1.8 would be a speck: that is the only departure from the format, and it is still a stroke in the current colour.

```html
<symbol id="j-task" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12h.01"/></symbol>
<symbol id="j-event" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/></symbol>
<symbol id="j-note" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12h8"/></symbol>
<symbol id="j-done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8l8 8M16 8l-8 8"/></symbol>
<symbol id="j-migrated" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12h10M13 8l4 4-4 4"/></symbol>
<symbol id="j-scheduled" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 12H7M11 8l-4 4 4 4"/></symbol>
<symbol id="j-more" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h.01M12 12h.01M18 12h.01"/></symbol>
<symbol id="j-chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></symbol>
<symbol id="i-journal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6"/></symbol>
```

Reused unchanged from notes: `i-plus`, `i-chevron-left`, `i-moon`, `i-sun`. The dropped bullet is the task dot, so it needs no symbol. `i-journal` is also added to the notes page, which takes the notes count from twelve to thirteen.

The Month tabs and panel headings are text only. No icon is needed for any panel.

---

## 10. What the design needs from storage and the API

Detail for the planning session. Not designed here.

* **Same sign-in, same private Blob store, a `journal/` prefix.** The notes list reads only `notes/`, so a journal entry cannot appear in it. Notes version 4 already holds the labels file outside `notes/` for the same reason.
* **Three kinds of file:** one per date holding that day's calendar line and entries, one per month holding the Migrate list, and one for Quick notes. Each carries an `updatedAt` as its version.
* **Month needs one aggregate read.** One request returns a month's calendar lines and entry counts, read server side behind the cookie check, as search already does. Thirty one browser calls to draw a calendar is not acceptable.
* **Conflicts need a different answer from notes.** Notes refuses a stale save and keeps the unsaved text. That is right for a note edited rarely on two devices. The journal is open on a PC and an iPad all day and the same lists are touched on both, so a refusal would fire constantly. Recommended: the page sends the change as an operation on an entry by id (add, edit, state, move), with the version it started from, and the server applies it to the newest file and answers with the result. A stale version is accepted for these operations because they cannot overwrite each other. Quick notes, which is one block of text, keeps the notes rule of refuse and keep the text (Q5).
* **A move is two writes.** Write the copy first, then mark the original. A failure between them leaves a duplicate, never a lost task.
* **Dates are the viewer's local date, sent by the page.** The server never decides what "today" is. The zone is Europe/London for the owner, and the page says so in its date requests so a travelling iPad does not change what yesterday was.
* One new route file, `api/journal.js`, makes six functions. Q19 in the notes questions says five is unproved on Vercel, so six should be checked on the Preview, not assumed.

---

## 11. Held by, and not in scope

New tests, named by the job:

* every journal colour pair above, computed both themes, with a case that fails when a pair is changed
* muted never set on `--notes-selected` in the journal page
* the journal page declares no variable the notes page does not, and no raw colour outside the theme blocks and the two theme meta values
* the two theme meta values equal `--notes-ground` in each theme
* every icon button names what it acts on, and the journal sprite is exactly eleven symbols, all stroked in the current colour
* touch targets: the bullet, More, type buttons, B, S, tabs, month arrows and date rows are 44px under `pointer: coarse`
* each panel renders alone
* no dash of any form in the page, manifest or copy
* the manifest, icons and page are public and noindex as specified, and `api/journal.js` answers 401 with no cookie
* the notes menu has Journal last, and the notes sprite is thirteen

Not in scope: reminders, recurring tasks, collections and indexes, future log beyond the month in view, search, labels, notes bin, an offline mode, drag to reorder, sharing, export, anything on the marketing pages or in Assay. Moving a month's open tasks to the next month (Q3) is the method's own monthly migration and is a question, not part of this build.
