"""The private journal page at /journal (CLAUDE.md section 9e).

Ruled by the product owner on 22 October 2026. The journal follows the notes look
of sections 9c and 9d: the same palette variables in the same three theme blocks,
the same type size variables, 8px and 6px corners, 1px borders, a 2px accent
focus outline, no shadows, no uppercase, light and dark. This file reads
`journal/index.html` the way `test_notes_page.py` reads the notes page, and holds
the rules that are the journal's own: the five panels and where they sit, 44px
touch targets, the icon set, the install tags and what the page does when it is
left, signed out or asked to move something.

The rules of an entry live in `journal/core.js` and are held by the Node tests in
`notes-tests/journal-core.test.js` and `journal-api.test.js`, which
`test_notes_page.py` already runs as part of the Node suite. The behaviour of the
page itself is held by `docs/evidence/journal/browser-check-journal.mjs`.
"""

import json
import re
import struct
import unittest
from pathlib import Path

from test_marketing_site_tokens import (
    EXPECTED_PAGES,
    declared_custom_properties,
    marketing_pages,
    used_custom_properties,
    without_comments,
)
from test_notes_page import (
    COLOUR_FUNCTION,
    DARK_ATTRIBUTE_HEADER,
    DARK_MEDIA_HEADER,
    DASHES,
    HEX,
    LIGHT_HEADER,
    NOTES_PAGE,
    NOTES_SIZES,
    RGBA,
    THEME_VALUE,
    block_after,
    contrast,
    declarations,
    function_body,
)

REPOSITORY = Path(__file__).parents[2]
JOURNAL = REPOSITORY / "journal"
JOURNAL_PAGE = JOURNAL / "index.html"
THEME_META = re.compile(r'<meta name="theme-color" content="#[0-9a-fA-F]{6}" media="[^"]+">')


def media_blocks(text: str, header: str) -> str:
    """Every `header { ... }` block in the text, braces matched, joined."""
    found, position = [], 0
    while True:
        at = text.find(header, position)
        if at == -1:
            return "\n".join(found)
        body = block_after(text[at:], header)
        found.append(body)
        position = at + len(header) + len(body)


def timer_calls(text: str) -> list[str]:
    """The text of every setTimeout and setInterval call, parentheses matched."""
    calls = []
    for match in re.finditer(r"\b(?:setTimeout|setInterval)\(", text):
        depth, end = 1, match.end()
        while depth and end < len(text):
            depth += {"(": 1, ")": -1}.get(text[end], 0)
            end += 1
        calls.append(text[match.start() : end])
    return calls


class JournalPageIsOutsideTheSiteRules(unittest.TestCase):
    def test_the_page_is_not_a_root_marketing_page(self) -> None:
        self.assertNotIn(JOURNAL_PAGE, marketing_pages())
        self.assertEqual(
            tuple(page.name for page in marketing_pages()),
            EXPECTED_PAGES,
            "A root page was added. The journal lives in journal/ so the pinned page list stays at five.",
        )

    def test_no_dash_in_anything_a_user_reads(self) -> None:
        files = [JOURNAL_PAGE, JOURNAL / "core.js", JOURNAL / "manifest.webmanifest"]
        files += [REPOSITORY / "api" / "_lib" / name for name in ("journal-api.js", "journal-store.js", "journal-live.js")]
        files += [REPOSITORY / "api" / "journal.js"]
        self.assertEqual(len(files), 7)
        for file in files:
            self.assertEqual(DASHES.findall(file.read_text(encoding="utf-8")), [], file.name)


class JournalPageFollowsTheNotesLook(unittest.TestCase):
    """Sections 9c and 9d, held for the journal's copy of the page."""

    def setUp(self) -> None:
        self.page = JOURNAL_PAGE.read_text(encoding="utf-8")
        self.text = without_comments(self.page)
        self.style = self.text.split("<style>", 1)[1].split("</style>", 1)[0]
        self.light = declarations(block_after(self.style, LIGHT_HEADER))
        self.dark_media = declarations(block_after(self.style, DARK_MEDIA_HEADER))
        self.dark_attribute = declarations(block_after(self.style, DARK_ATTRIBUTE_HEADER))
        notes = NOTES_PAGE.read_text(encoding="utf-8")
        notes_style = without_comments(notes).split("<style>", 1)[1].split("</style>", 1)[0]
        self.notes_light = declarations(block_after(notes_style, LIGHT_HEADER))
        self.notes_dark = declarations(block_after(notes_style, DARK_MEDIA_HEADER))
        self.notes_dark_attribute = declarations(block_after(notes_style, DARK_ATTRIBUTE_HEADER))

    def without_theme_blocks(self, text: str) -> str:
        for header in (LIGHT_HEADER, DARK_MEDIA_HEADER, DARK_ATTRIBUTE_HEADER):
            text = text.replace(header + block_after(text, header) + "}", "")
        return text

    # ---- palette ----

    def test_the_journal_declares_exactly_the_notes_palette_and_adds_none(self) -> None:
        self.assertEqual(self.light, self.notes_light, "A light value or variable differs from the notes page.")
        self.assertEqual(self.dark_media, self.notes_dark, "A dark value or variable differs from the notes page.")
        self.assertEqual(self.dark_attribute, self.notes_dark_attribute)
        self.assertEqual(self.dark_media, self.dark_attribute, "The two dark blocks differ.")
        self.assertGreaterEqual(len([k for k in self.light if k.startswith("--")]), 24, "The light block was not read.")

    def test_raw_colours_only_inside_the_three_theme_blocks_and_the_two_theme_tags(self) -> None:
        tags = THEME_META.findall(self.text)
        self.assertEqual(len(tags), 2, "One theme-color tag for light and one for dark.")
        outside = self.without_theme_blocks(self.text)
        for tag in tags:
            outside = outside.replace(tag, "")
        self.assertEqual(HEX.findall(outside.replace("&#", "")), [], "A raw hex colour sits outside the theme blocks.")
        self.assertEqual(COLOUR_FUNCTION.findall(outside), [], "A colour function sits outside the theme blocks.")
        self.assertEqual(RGBA.findall(outside), [])
        inside = "".join(block_after(self.style, h) for h in (LIGHT_HEADER, DARK_MEDIA_HEADER, DARK_ATTRIBUTE_HEADER))
        self.assertEqual(len(RGBA.findall(inside)), 3, "The scrim is the only rgba value, once in each theme block.")

    def test_the_theme_tags_carry_the_page_ground_in_each_theme(self) -> None:
        light = re.search(r'<meta name="theme-color" content="(#[0-9a-fA-F]{6})" media="\(prefers-color-scheme: light\)">', self.text)
        dark = re.search(r'<meta name="theme-color" content="(#[0-9a-fA-F]{6})" media="\(prefers-color-scheme: dark\)">', self.text)
        self.assertIsNotNone(light)
        self.assertIsNotNone(dark)
        self.assertEqual(light.group(1), self.light["--notes-ground"])
        self.assertEqual(dark.group(1), self.dark_media["--notes-ground"])
        manifest = json.loads((JOURNAL / "manifest.webmanifest").read_text(encoding="utf-8"))
        self.assertEqual(manifest["theme_color"], self.light["--notes-ground"])
        self.assertEqual(manifest["background_color"], self.light["--notes-ground"])
        # The script that follows a theme switch reads the colour from the variable.
        self.assertIn('getPropertyValue("--notes-ground")', self.text)

    def test_px_font_sizes_only_inside_root(self) -> None:
        outside = self.without_theme_blocks(self.style)
        sizes = re.findall(r"font-size:\s*([^;]+);", outside)
        self.assertGreaterEqual(len(sizes), 15, "Too few font-size declarations were read.")
        for size in sizes:
            self.assertRegex(size, r"^var\(--notes-size-(12|13|14|15|18|30)\)$", f"font-size {size}")
        self.assertEqual({v for k, v in self.light.items() if k.startswith("--notes-size-")}, NOTES_SIZES)
        self.assertNotRegex(self.without_theme_blocks(self.text), r"font:\s*[^;]*\d+px")

    def test_color_scheme_follows_the_device_and_the_choice(self) -> None:
        self.assertEqual(self.light["color-scheme"], "light dark")
        self.assertEqual(self.dark_media["color-scheme"], "dark")
        self.assertIn(':root[data-theme="light"] { color-scheme: light; }', self.style)

    def test_every_variable_it_reads_is_declared(self) -> None:
        declared, chain = declared_custom_properties(JOURNAL_PAGE)
        self.assertIn("/tokens.css", chain, "The page no longer loads tokens.css, which carries the Archivo font face.")
        used = used_custom_properties(self.text)
        self.assertGreaterEqual(len(used), 15, "Too few var() reads were found.")
        self.assertEqual(sorted(used - declared), [], "var() names nothing declares.")
        self.assertEqual(sorted(name for name in used if not name.startswith("--notes-")), [])
        self.assertEqual(sorted(used - set(self.light)), [], "Read but not declared in the light block.")

    # ---- contrast, from the declared values, for every pair the journal uses ----

    PAIRS = (
        # (foreground, ground, floor, what it is for)
        ("--notes-ink", "--notes-panel", 4.5, "entry text"),
        ("--notes-muted", "--notes-panel", 4.5, "done, moved, scheduled and dropped entries"),
        ("--notes-muted", "--notes-hover", 4.5, "a greyed entry while it is hovered"),
        ("--notes-muted", "--notes-field", 4.5, "the placeholder, the strip, the add line"),
        ("--notes-ink", "--notes-hover", 4.5, "the Tomorrow row"),
        ("--notes-ink", "--notes-field", 4.5, "the strip and the add line"),
        ("--notes-strong", "--notes-selected", 4.5, "the Today row and the chosen type button"),
        ("--notes-ink", "--notes-selected", 4.5, "text on the Today row"),
        ("--notes-icon", "--notes-selected", 3.0, "bullets on the selected fill"),
        ("--notes-on-accent", "--notes-accent", 4.5, "Bring forward"),
        ("--notes-ink", "--notes-ground", 4.5, "buttons"),
        ("--notes-bad", "--notes-ground", 4.5, "the sign in error"),
        ("--notes-icon", "--notes-panel", 3.0, "bullets and icons"),
    )

    def test_contrast_for_every_pair_the_journal_uses_in_both_themes(self) -> None:
        checked = 0
        for theme, values in (("light", self.light), ("dark", self.dark_media)):
            for foreground, ground, floor, what in self.PAIRS:
                ratio = contrast(values[foreground], values[ground])
                checked += 1
                self.assertGreaterEqual(ratio, floor, f"{theme}: {what}: {foreground} on {ground} is {ratio:.2f}:1, needs {floor}:1")
        self.assertEqual(checked, 2 * len(self.PAIRS), "A contrast pair was skipped.")

    def test_the_contrast_check_can_fail(self) -> None:
        self.assertAlmostEqual(contrast("#000000", "#ffffff"), 21.0, places=1)
        # The pair the notes page forbids: muted on the selected fill is below 4.5:1 in light and in dark.
        self.assertLess(contrast(self.light["--notes-muted"], self.light["--notes-selected"]), 4.5)
        self.assertLess(contrast(self.dark_media["--notes-muted"], self.dark_media["--notes-selected"]), 4.5)

    def test_muted_is_never_set_on_the_selected_fill(self) -> None:
        rules = re.findall(r"([^{}@]+)\{([^{}]*)\}", self.without_theme_blocks(self.style))
        selected = [(sel.strip(), body) for sel, body in rules if "--notes-selected" in body]
        self.assertGreaterEqual(len(selected), 4, "The selected rules were not found.")
        for selector, body in selected:
            self.assertNotIn("--notes-muted", body, f"{selector} puts muted text on the selected fill.")
        # Nor does anything that sits on the Today row, which is the selected fill.
        for selector, body in rules:
            if 'data-mark="today"' in selector:
                self.assertNotIn("--notes-muted", body, f"{selector.strip()} is on the Today row.")
        self.assertIn('.date-row[data-mark="today"] .date-open .wk { color: var(--notes-strong); }', self.style)

    # ---- type ----

    def test_no_uppercase_and_no_positive_tracking(self) -> None:
        self.assertNotRegex(self.style, r"text-transform")
        spacings = re.findall(r"letter-spacing:\s*([^;]+);", self.style)
        self.assertEqual(sorted(spacings), ["-0.01em", "-0.02em"])

    def test_archivo_only_on_the_wordmark_and_no_monospace_anywhere(self) -> None:
        rules = re.findall(r"([^{}]+)\{([^{}]*font-family:[^;}]*Archivo[^;}]*;[^{}]*)\}", self.style)
        self.assertEqual([selector.strip() for selector, _ in rules], [".wordmark"])
        body = re.search(r"\n  body \{([^}]*)\}", self.style).group(1)
        self.assertIn('font-family: "Segoe UI", system-ui, sans-serif;', body)
        self.assertNotIn("monospace", self.style, "The 9b note box ruling does not reach the journal.")
        self.assertEqual(len(re.findall(r"font-family:", self.style)), 2)

    # ---- shape ----

    def test_corners_are_six_or_eight_and_nothing_casts_a_shadow_or_moves(self) -> None:
        radii = re.findall(r"border-radius:\s*([^;]+);", self.style)
        self.assertGreaterEqual(len(radii), 15)
        self.assertEqual(sorted(set(radii)), ["6px", "8px"])
        self.assertNotRegex(self.style, r"shadow")
        self.assertNotRegex(self.style, r"transition|animation|@keyframes", "Nothing opens or closes by animation.")

    def test_borders_are_one_pixel_and_outlines_are_two(self) -> None:
        borders = re.findall(r"border(?:-(?:top|right|bottom|left))?\s*:\s*([^;]+);", self.style)
        self.assertGreaterEqual(len(borders), 15)
        for border in borders:
            self.assertTrue(border in ("0", "none") or border.startswith("1px solid "), f"border: {border}")
        self.assertNotRegex(self.style, r"border-(?:top|right|bottom|left)?-?width")
        self.assertEqual(set(re.findall(r"outline\s*:\s*([^;]+);", self.style)), {"2px solid var(--notes-accent)"})
        self.assertEqual(set(re.findall(r"outline-offset:\s*([^;]+);", self.style)), {"2px"})

    # ---- icons ----

    SYMBOLS = sorted(["j-task", "j-event", "j-note", "j-done", "j-migrated", "j-scheduled", "j-more", "j-chevron-right",
                      "i-chevron-left", "i-moon", "i-sun"])

    def test_exactly_eleven_icon_shapes_all_stroked_in_the_current_colour(self) -> None:
        symbols = re.findall(r"<symbol\b([^>]*)>", self.text)
        ids = sorted(re.search(r'id="([^"]+)"', attributes).group(1) for attributes in symbols)
        self.assertEqual(ids, self.SYMBOLS)
        for attributes in symbols:
            for required in ('viewBox="0 0 24 24"', 'fill="none"', 'stroke="currentColor"', 'stroke-linecap="round"', 'stroke-linejoin="round"'):
                self.assertIn(required, attributes)
        # Two dots are drawn as a short stroke, so they are wider than the 1.8 of the rest.
        widths = {re.search(r'id="([^"]+)"', a).group(1): re.search(r'stroke-width="([\d.]+)"', a).group(1) for a in symbols}
        self.assertEqual({k for k, v in widths.items() if v != "1.8"}, {"j-task", "j-more"})
        for k in ("j-task", "j-more"):
            self.assertRegex(self.text, rf'<symbol id="{k}"[^>]*>\s*<path d="M[\d ]+h\.01(?:M[\d ]+h\.01)*"/>')
        # Named in the markup (<use href="#j-more">) or in the script ("j-task").
        references = set(re.findall(r'["#]([ij]-[a-z]+(?:-[a-z]+)*)"', self.text))
        self.assertEqual(sorted(references), self.SYMBOLS, "Every shape is used and nothing else is.")
        for svg in re.findall(r"<svg\b[^>]*>", self.text):
            self.assertNotRegex(svg, r"stroke=\"(?!currentColor)")
        self.assertIn('viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"', function_body(self.text, "icon"))

    def test_the_shapes_are_the_ones_in_the_brief(self) -> None:
        paths = {
            "j-task": 'd="M12 12h.01"', "j-event": 'cx="12" cy="12" r="4"', "j-note": 'd="M8 12h8"', "j-done": 'd="M8 8l8 8M16 8l-8 8"',
            "j-migrated": 'd="M7 12h10M13 8l4 4-4 4"', "j-scheduled": 'd="M17 12H7M11 8l-4 4 4 4"',
            "j-more": 'd="M6 12h.01M12 12h.01M18 12h.01"', "j-chevron-right": 'd="M9 6l6 6-6 6"',
        }
        for name, shape in paths.items():
            symbol = re.search(rf'<symbol id="{name}".*?</symbol>', self.text, re.DOTALL).group(0)
            self.assertIn(shape, symbol, name)

    def test_every_control_the_script_makes_names_what_it_acts_on(self) -> None:
        for label in ('"Mark not done: "', '"Mark done: "', '"Move this entry: "', '"Bring forward: "', '"Drop: "',
                      '"Pick a date: "', '"Schedule for "', '"Previous month"', '"Next month"', '"Open the log for "',
                      '"Calendar line for "', '"Entry text"', '"New entry"', '"Bold"', '"Strike-through"'):
            self.assertIn(label, self.text)
        # Every icon-only button is made with an aria-label in the lines that follow it.
        for match in re.finditer(r'make\("button", "icon-button[^"]*"\)', self.text):
            following = self.text[match.end() : match.end() + 260]
            self.assertIn('setAttribute("aria-label"', following, match.group(0))
        for button in re.findall(r'<button type="button" class="icon-button[^>]*>', self.text):
            self.assertIn("aria-label=", button, button)
        # Each type button names itself and its shortcut.
        self.assertIn('"Alt+" + (["task", "event", "note"].indexOf(type) + 1)', self.text)

    # ---- touch targets ----

    def coarse(self) -> str:
        return media_blocks(self.style, "@media (pointer: coarse) {")

    def test_every_target_a_finger_lands_on_is_44px_under_a_coarse_pointer(self) -> None:
        coarse = self.coarse()
        self.assertGreater(len(coarse), 300, "The coarse pointer rules were not read.")
        for selector, declaration in (
            ("button, a.button-link", "min-height: 44px;"),
            ("button.icon-button", "width: 44px;"),
            (".editor-line, .quick-editor", "min-height: 44px;"),
            (".type-button, .fmt-button", "width: 44px;"),
            (".entry-main", "min-height: 44px;"),
            (".bullet", "width: 44px; height: 44px;"),
            (".entry-actions button", "min-height: 44px;"),
            (".pick-day", "min-height: 44px;"),
            (".strip-buttons button, .strip-foot", "min-height: 44px;"),
            (".line-text", "min-height: 44px;"),
            (".date-row", "min-height: 44px;"),
        ):
            self.assertRegex(coarse, re.escape(selector) + r"\s*\{[^}]*" + re.escape(declaration), f"{selector} {declaration}")
        self.assertIn(".tabbar button { flex: 1; min-height: 44px; padding: 0 4px; }", self.style)
        self.assertIn("min-height: 44px;", block_after(self.style, "\n  input[type=\"password\"] {"))

    # ---- the five panels and where they sit ----

    def test_five_panels_in_the_brief_s_order_and_names(self) -> None:
        order = re.findall(r'<section class="panel" id="panel-(\w+)"', self.text)
        self.assertEqual(order, ["month", "today", "tomorrow", "migrate", "quick"])
        for heading in ("Today", "Tomorrow", "Migrate", "Quick notes"):
            self.assertIn(f">{heading}</h2>", self.text)
        self.assertIn('<h2 class="sr-only" id="month-heading">Month</h2>', self.text)
        tabs = re.findall(r'<button type="button" role="tab" data-panel="(\w+)" aria-selected="(?:true|false)">(\w+)</button>', self.text)
        self.assertEqual(tabs, [("month", "Month"), ("today", "Today"), ("tomorrow", "Tomorrow"), ("migrate", "Migrate"), ("quick", "Quick")])

    def test_the_layout_at_each_width(self) -> None:
        self.assertNotIn("1400px", self.style, "There is no five column layout.")
        wide = self.style.split("@media (min-width: 1000px) {", 1)[1]
        self.assertIn('grid-template-columns: repeat(3, minmax(0, 1fr));', wide)
        self.assertIn('grid-template-areas: "month today migrate" "month tomorrow quick";', wide)
        self.assertIn("grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);", wide)
        middle = self.style.split("@media (min-width: 761px) and (max-width: 999px) {", 1)[1]
        self.assertIn('grid-template-areas: "month today" "month tomorrow" "month migrate" "month quick";', middle)
        self.assertIn("position: sticky;", middle)
        self.assertIn("height: calc(100dvh - var(--notes-header-height) - 24px);", middle)
        phone = self.style.split("@media (max-width: 760px) {", 1)[1]
        self.assertIn('.panel[data-active="true"] { display: flex; }', phone)
        self.assertIn(".panel { display: none;", phone)
        for width in re.findall(r"@media \(([^)]*width[^)]*)\)", self.style):
            self.assertIn(width, ("min-width: 1000px", "max-width: 760px", "max-width: 420px") + ("min-width: 761px",), width)
        self.assertEqual(len(re.findall(r"@media \(max-width: 760px\)", self.style)), 2, "The phone rules and the tab bar rule.")

    def test_today_and_tomorrow_are_marked_in_month_by_a_fill_and_a_word(self) -> None:
        # Told twice (design brief section 4): a fill, and the word, so removing colour leaves it readable.
        self.assertIn('.date-row[data-mark="today"] { background: var(--notes-selected); }', self.style)
        self.assertIn('.date-row[data-mark="tomorrow"] { background: var(--notes-hover); }', self.style)
        self.assertIn('make("span", "mark-word", mark === "today" ? "Today" : "Tomorrow")', self.text)
        self.assertIn('var mark = date === today ? "today" : date === tomorrow() ? "tomorrow" : "";', self.text)
        self.assertIn(".mark-word { flex: none; font-size: var(--notes-size-12); font-weight: 600; color: var(--notes-strong); }", self.style)
        self.assertNotRegex(self.style, r'\.date-row\[data-mark="(?:today|tomorrow)"\][^{]*\{[^}]*--notes-muted')

    def test_each_panel_draws_itself_and_is_skipped_when_it_is_not_there(self) -> None:
        # CLAUDE.md section 5: every new output is a self-contained panel. The browser check
        # takes the other four away and draws each alone; this holds the shape that allows it.
        render = function_body(self.text, "renderAll")
        for panel, draw in (("today", "renderToday"), ("tomorrow", "renderTomorrow"), ("migrate", "renderMigrate"), ("month", "renderMonth")):
            self.assertIn(f'if ($("panel-{panel}")) {{ {draw}(); }}', render)
        self.assertEqual(render.count("render"), 4, "renderAll draws four panels and nothing else.")
        for name in ("renderToday", "renderTomorrow", "renderMigrate"):
            body = function_body(self.text, name)
            for other in ("tomorrow", "migrate", "month", "quick") if name == "renderToday" else ("today", "month", "quick"):
                self.assertNotIn(f"panel-{other}", body, f"{name} knows about the {other} panel")
        self.assertIn('var panel = $("panel-" + key);', function_body(self.text, "showPanel"))

    def test_a_move_row_goes_to_the_right_in_a_wide_panel_for_a_mouse_only(self) -> None:
        self.assertIn("@container panel (min-width: 440px) {", self.style)
        container = self.style.split("@container panel (min-width: 440px) {", 1)[1]
        self.assertIn("@media (hover: hover) and (pointer: fine) {", container)
        self.assertIn("position: absolute;", container)
        self.assertIn(".entry .more { display: none; }", container)
        self.assertIn("container: panel / inline-size;", self.style)

    # ---- the header and the sign in ----

    def test_the_header_the_theme_switch_and_what_is_hidden_signed_out(self) -> None:
        self.assertIn('<img class="mark" src="/logo-stone.svg" alt="">', self.text)
        self.assertIn('<p class="wordmark">Journal</p>', self.text)
        self.assertIn('id="theme-switch" aria-label="Switch to dark mode"', self.text)
        self.assertIn('<a class="button-link quiet" id="notes-link" href="/notes">Notes</a>', self.text)
        self.assertIn('<button type="button" id="sign-out" hidden>Sign out</button>', self.text)
        self.assertIn('<div id="app" hidden>', self.text)
        self.assertIn('<nav class="tabbar" id="tabbar" aria-label="Panels" hidden>', self.text)
        self.assertIn('<div class="bar-right" id="bar-actions" hidden>', self.text)

    def test_sign_in_uses_the_notes_words(self) -> None:
        self.assertIn('"That password is incorrect."', self.text)
        self.assertIn('"Could not reach the server. Try again."', self.text)
        self.assertIn('"Could not reach the server. Reload to try again."', self.text)
        self.assertIn('request("/api/session").then(', self.text)

    # ---- the theme script ----

    def test_the_theme_script_wraps_storage_in_try_catch_and_runs_before_the_stylesheet(self) -> None:
        for script_id in ("theme-init", "theme-switch-script"):
            script = re.search(rf'<script id="{script_id}">(.*?)</script>', self.page, re.DOTALL).group(1)
            uses = list(re.finditer(r"localStorage", script))
            self.assertGreaterEqual(len(uses), 1, script_id)
            for use in uses:
                before, after = script[: use.start()], script[use.end() :]
                self.assertTrue(before.rfind("try {") > before.rfind("catch") and "catch" in after, f"{script_id}: a localStorage use is outside try/catch.")
        self.assertLess(self.page.index('<script id="theme-init">'), self.page.index('<link rel="stylesheet"'))
        self.assertLess(self.page.index('<script id="theme-init">'), self.page.index("<style>"))
        self.assertIn('"silurian-notes-theme"', self.page, "The theme choice is the one notes uses.")


class JournalPageKeepsItsPromises(unittest.TestCase):
    """What the journal does when it is left, signed out, or asked to move something."""

    page = JOURNAL_PAGE.read_text(encoding="utf-8")
    text = without_comments(page)
    script = text.split('<script type="module">', 1)[1]

    # ---- one implementation ----

    def test_the_page_applies_changes_with_the_shared_rules_and_does_not_work_out_revisions(self) -> None:
        self.assertIn('import * as core from "/journal/core.js";', self.script)
        self.assertIn("core.applyOp(", self.script)
        self.assertIn("core.stripFrom(", self.script)
        self.assertIn("core.monthsFor(", self.script)
        # A revision is never worked out here: not added to, and not set.
        self.assertNotRegex(self.script, r"\.rev\s*(?:\+\+|\+=|=[^=])")
        for line in self.script.splitlines():
            if re.search(r"\brev\b", line):
                self.assertNotRegex(line, r"\+\s*\d|\+\+|-\s*\d", f"A revision is worked out in the page: {line.strip()}")
        self.assertNotRegex(self.script, r"\b(?:state|type)\s*=\s*[\"'](?:done|migrated|scheduled|dropped)[\"']")

    def test_dates_are_londons_and_the_server_never_decides_what_today_is(self) -> None:
        self.assertIn('timeZone: "Europe/London"', self.script)
        api = (REPOSITORY / "api" / "_lib" / "journal-api.js").read_text(encoding="utf-8")
        self.assertIn("params.get(\"today\")", api, "Today comes from the page.")
        self.assertNotRegex(without_comments(api), r"new Date\(\)\.to|getDate\(")

    # ---- nothing moves by itself ----

    def test_nothing_is_moved_migrated_or_dropped_by_a_timer_or_by_loading(self) -> None:
        calls = timer_calls(self.script)
        self.assertGreaterEqual(len(calls), 6, "The timers were not found.")
        for call in calls:
            for name in ("submit(", "pump(", "moveEntry(", "bringForward(", "dropTasks(", "runUndo(", "offerUndo("):
                self.assertNotIn(name, call, f"A timer calls {name}: {call[:90]}")
        # The only things a timer may call: save the quick notes, hide the message, ask again, check the date.
        allowed = {"saveQuick", "hideFlash", "refresh", "wait", "resolve"}
        for call in calls:
            names = set(re.findall(r"\b([a-zA-Z]+)\(", call)) - {"setTimeout", "setInterval", "function"}
            self.assertLessEqual(names - allowed - {"londonDate", "visibilityState"}, set(), call[:120])
        # Changes are sent from click, key and blur handlers, and from Undo.
        starts = [m.start() for m in re.finditer(r"\bsubmit\(", self.script)]
        self.assertGreaterEqual(len(starts), 10)
        refresh = function_body(self.script, "refresh")
        self.assertNotIn("submit(", refresh)
        self.assertNotIn('method: "POST"', refresh)
        self.assertNotIn("method: 'POST'", refresh)
        for name in ("loadHome", "applyHome", "start", "renderStrip", "renderAll", "stripGroup"):
            body = function_body(self.script, name)
            if name == "stripGroup":
                # The strip builds buttons. Only a click on one of them moves anything.
                self.assertEqual(body.count("addEventListener(\"click\""), 3)
            else:
                self.assertNotIn("submit(", body, name)
        self.assertNotIn("crons", (REPOSITORY / "vercel.json").read_text(encoding="utf-8"))

    def test_the_strip_offers_bring_all_forward_and_never_a_drop_all(self) -> None:
        self.assertIn('make("button", "strip-foot", "Bring all forward")', self.script)
        self.assertEqual(self.script.count("strip-foot"), 1, "One button of that kind, made once and shown when there are several.")
        self.assertNotRegex(self.text, r"Drop all|Drop everything")
        self.assertIn("if (group.tasks.length > 1) {", function_body(self.script, "stripGroup"))
        self.assertIn('"Bring forward"', self.script)
        self.assertIn('make("button", "", "Drop")', function_body(self.script, "stripGroup"))

    # ---- sign out, leaving, and memory ----

    def test_memory_is_dropped_on_sign_out_on_a_401_and_when_the_page_is_left(self) -> None:
        body = function_body(self.script, "clearContent")
        for fragment in ("generation += 1;", "confirmed = {};", "stripMonths = [];", "pending = [];", "shown = {};",
                         "sending = false;", "dayView = null;", "quickEditor.textContent = \"\";", "clearInterval(pollTimer);",
                         "clearTimeout(quick.timer);", '$("password").value = "";', "hideFlash();"):
            self.assertIn(fragment, body)
        self.assertIn("clearContent();", function_body(self.script, "goToLogin"), "A 401 and sign out both go through goToLogin.")
        self.assertIn('response.status === 401 && path !== "/api/login") { goToLogin(); }', self.script)
        pagehide = re.search(r'addEventListener\("pagehide",\s*function\s*\(\)\s*\{(.*?)\n  \}\);', self.script, re.DOTALL).group(1)
        self.assertIn("clearContent();", pagehide)
        self.assertIn('showOnly("Loading.");', pagehide)
        self.assertIn("goToLogin();", function_body(self.script, "signOut"))
        self.assertIn('method: "DELETE"', function_body(self.script, "signOut"))
        self.assertIn("drained()", function_body(self.script, "signOut"), "Sign out waits for what is on its way.")
        self.assertIn("function showOnly(", self.script)

    def test_nothing_is_painted_before_the_session_is_confirmed(self) -> None:
        self.assertIn('<div id="app" hidden>', self.text)
        self.assertIn('<p id="boot" class="lead">Loading.</p>', self.text)
        tail = self.script.rsplit('request("/api/session")', 1)[1]
        self.assertIn("start();", tail)
        self.assertIn("goToLogin();", tail)
        start = function_body(self.script, "start")
        self.assertLess(start.index("loadHome()"), start.index('show("app")'), "The panels are shown only after the first load.")
        self.assertIn("if (!signedIn) { return; }", function_body(self.script, "renderAll"))

    def test_the_device_holds_the_theme_and_the_last_tab_and_nothing_else(self) -> None:
        for api in ("sessionStorage", "indexedDB", "caches.", "serviceWorker", "document.cookie", "openDatabase", "navigator.storage"):
            self.assertNotIn(api, self.text, f"the page must not keep entries with {api}")
        stores = re.findall(r"localStorage\.(?:setItem|getItem|removeItem)\(([^,)]+)", self.text)
        self.assertEqual(set(stores), {'"silurian-notes-theme"', "KEY", "TAB_KEY"}, "localStorage holds the theme and the last tab")
        self.assertIn('var TAB_KEY = "silurian-journal-tab";', self.script)
        for use in re.finditer(r"localStorage", self.script):
            before = self.script[: use.start()]
            self.assertTrue(before.rfind("try {") > before.rfind("catch"), "the tab is read and written inside try and catch")

    def test_no_service_worker_and_the_files_that_install_it_are_public(self) -> None:
        self.assertEqual(sorted(p.name for p in JOURNAL.iterdir()),
                         sorted(["apple-touch-icon.png", "core.js", "icon-192.png", "icon-32.png", "icon-512-maskable.png",
                                 "icon-512.png", "index.html", "manifest.webmanifest"]))
        self.assertFalse(list(JOURNAL.glob("*sw*.js")) or list(JOURNAL.glob("*worker*")))
        self.assertNotIn("serviceWorker", self.text)
        allowlist = (REPOSITORY / "site-allowlist.txt").read_text(encoding="utf-8").splitlines()
        self.assertIn("journal/", allowlist)

    # ---- install ----

    def test_install_tags_and_the_manifest(self) -> None:
        self.assertIn("<title>Journal</title>", self.text)
        self.assertIn('<link rel="manifest" href="/journal/manifest.webmanifest">', self.text)
        self.assertIn('<meta name="apple-mobile-web-app-capable" content="yes">', self.text)
        self.assertIn('<meta name="apple-mobile-web-app-title" content="Journal">', self.text)
        self.assertIn('<meta name="apple-mobile-web-app-status-bar-style" content="default">', self.text)
        self.assertIn('<link rel="apple-touch-icon" href="/journal/apple-touch-icon.png">', self.text)
        self.assertIn('<meta name="robots" content="noindex, nofollow">', self.text)
        manifest = json.loads((JOURNAL / "manifest.webmanifest").read_text(encoding="utf-8"))
        self.assertEqual(
            {k: manifest[k] for k in ("name", "short_name", "start_url", "scope", "display")},
            {"name": "Journal", "short_name": "Journal", "start_url": "/journal/", "scope": "/journal/", "display": "standalone"},
        )
        self.assertTrue(manifest["start_url"].startswith(manifest["scope"]))
        sizes = {}
        for icon in manifest["icons"]:
            data = (REPOSITORY / icon["src"].lstrip("/")).read_bytes()
            self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n", icon["src"])
            width, height = struct.unpack(">II", data[16:24])
            self.assertEqual(f"{width}x{height}", icon["sizes"], icon["src"])
            sizes[icon["src"]] = (width, icon.get("purpose", "any"))
        self.assertEqual(sizes, {"/journal/icon-192.png": (192, "any"), "/journal/icon-512.png": (512, "any"), "/journal/icon-512-maskable.png": (512, "maskable")})
        for name, size in (("apple-touch-icon.png", 180), ("icon-32.png", 32)):
            data = (JOURNAL / name).read_bytes()
            self.assertEqual(struct.unpack(">II", data[16:24]), (size, size), name)

    # ---- keys, copy and messages ----

    def test_the_shortcuts_the_brief_names(self) -> None:
        for fragment in ('{ Digit1: "task", Digit2: "event", Digit3: "note" }', 'event.altKey', 'key === "b"', 'key === "x"',
                         'format("bold", editor)', 'format("strikeThrough", editor)', 'Control+B Meta+B', 'Control+Shift+X Meta+Shift+X',
                         '"Strike-through (Ctrl+Shift+X)"', '"Bold (Ctrl+B)"', '{ ". ": "task", "o ": "event", "- ": "note" }'):
            self.assertIn(fragment, self.script)
        self.assertIn('event.key === "Backspace" && state.prefixBackup !== null', self.script, "Backspace gives a typed prefix back.")
        self.assertIn('type === "formatItalic" || type === "formatUnderline"', self.script, "Bold and strike-through only.")

    def test_every_empty_state_and_message_says_exactly_what_the_brief_says(self) -> None:
        for copy in (
            '"Nothing logged for " + longDate(today) + " yet. Type a task, an event or a note below."',
            '"Nothing planned for " + longDate(tomorrow()) + " yet. Add a task or event below, or move one here from another list."',
            '"Nothing logged for " + longDate(date) + ". Type a task, an event or a note below."',
            '"No tasks waiting this month. Add one below, or choose Migrate on any entry to park it here."',
            '" yet. Click a date to add a line, or open a date to log it."',
            '"Nothing on the calendar for "',
            'data-placeholder="Type anything here. It has no date and stays until you delete it."',
            '"Entry deleted."', '"All handled."', '"Brought forward."', '"Dropped."', '"Moved to "', '"Scheduled for "',
            '"Could not save that change. Nothing was changed. Try again."',
            '"Could not load your journal. Check your connection and reload."',
            '"Add to "', '"Back to "',
        ):
            self.assertIn(copy, self.text)
        core = (JOURNAL / "core.js").read_text(encoding="utf-8")
        self.assertIn('stale: "This changed on another device. Your text is still on screen. Reload to see the latest, then add it again."', core)
        self.assertIn('undo: "That entry has changed since it moved, so it was not moved back."', core)
        self.assertIn(">This month</button>", self.text)
        self.assertEqual(DASHES.findall(self.page), [])

    def test_a_clash_keeps_the_typed_text_and_offers_reload_never_replaces_it(self) -> None:
        refused = function_body(self.script, "refused")
        self.assertIn("onFail(kind)", refused)
        self.assertIn('label: "Reload"', refused)
        for name in ("restoreEditing",):
            self.assertIn("drawMarks(editor, typed, false);", function_body(self.script, name))
        self.assertIn("if (quick.dirty || quick.saving || document.activeElement === quickEditor) { return; }", function_body(self.script, "takeQuick"),
                      "A refresh never replaces quick notes that are being typed or not yet saved.")
        self.assertIn("if (readEditor(editor) === \"\") { drawMarks(editor, text, false); }", self.script, "A refused add gives the text back to the add line.")

    def test_a_message_with_an_undo_lasts_ten_seconds_and_a_clash_stays_until_dismissed(self) -> None:
        self.assertIn("var UNDO_MS = 10000;", self.script)
        self.assertIn("if (autoHide) { flashTimer = setTimeout(hideFlash, UNDO_MS); }", self.script)
        self.assertIn("showFlash(text, { label: \"Undo\", run: function () { return runUndo(ops); } }, true);", self.script)
        self.assertNotIn("true);", re.search(r"showFlash\(core\.MESSAGES\.stale.*", self.script).group(0))


if __name__ == "__main__":
    unittest.main()
