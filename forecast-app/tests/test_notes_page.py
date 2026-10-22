"""The private notes page at the repository root.

The notes page is the first server-side code the marketing site has had. Its
own tests are Node tests in `notes-tests/`, because the code under test is Node.
This file does two jobs, so that `python -m unittest discover -s tests` still
means the whole repository. The Node suite needs `npm ci` at the repository root
first:

1. It runs the Node suite and fails, rather than skips, when it cannot. A control
   that did not run has not passed (CLAUDE.md section 13).
2. It holds the notes page to its own look, the Spud Notes look in light and
   dark (CLAUDE.md section 9c). The page sits in `notes/index.html`,
   deliberately not at the root, so the root page scans in
   `test_marketing_site_tokens.py` and `test_marketing_site_analytics.py` do not
   pick it up, and the site's token, type size and radius rules do not apply to
   it. This is the place its palette, type, shape, contrast and icons are read.
"""

import re
import shutil
import subprocess
import unittest
from pathlib import Path

REPOSITORY = Path(__file__).parents[2]

# The site's own scans are reused, not copied: a second copy of a rule is how
# the two drift apart.
from test_marketing_site_tokens import (
    EXPECTED_PAGES,
    declared_custom_properties,
    marketing_pages,
    used_custom_properties,
    without_comments,
)


NOTES_PAGE = REPOSITORY / "notes" / "index.html"
DASHES = re.compile(r"[\u2013\u2014]|&mdash;|&ndash;|&#8212;|&#8211;|\\u201[34]", re.IGNORECASE)


class NotesNodeSuite(unittest.TestCase):
    def test_the_node_suite_passes(self) -> None:
        npm = shutil.which("npm")
        self.assertIsNotNone(
            npm, "npm is not installed, so the notes tests did not run. Install Node 22."
        )
        self.assertTrue(
            (REPOSITORY / "node_modules" / "@vercel" / "blob").is_dir(),
            "Run `npm ci` at the repository root first. Without it the notes tests did not run.",
        )
        result = subprocess.run(
            [npm, "test", "--silent"],
            cwd=REPOSITORY,
            capture_output=True,
            text=True,
            timeout=300,
        )
        passed = re.search(r"^# pass (\d+)$", result.stdout, re.MULTILINE)
        failed = re.search(r"^# fail (\d+)$", result.stdout, re.MULTILINE)
        self.assertIsNotNone(passed, "The Node run reported no totals, so it did not run.\n" + result.stdout[-2000:])
        self.assertGreaterEqual(int(passed.group(1)), 30, "Far fewer notes tests ran than were written.")
        self.assertEqual(int(failed.group(1)), 0, result.stdout[-4000:])
        self.assertEqual(result.returncode, 0, result.stdout[-4000:] + result.stderr[-2000:])

HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
COLOUR_FUNCTION = re.compile(r"\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(")
RGBA = re.compile(r"rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)")
THEME_VALUE = re.compile(r"^(?:#[0-9a-fA-F]{6}|rgba\(\d+, \d+, \d+, [\d.]+\))$")
DECLARATION = re.compile(r"(--[\w-]+|color-scheme)\s*:\s*([^;]+);")
NOTES_SIZES = {"12px", "13px", "14px", "15px", "18px", "30px"}
THEMES = ("light", "dark")

# The three theme blocks, found by their selector.
LIGHT_HEADER = ":root {"
DARK_MEDIA_HEADER = ':root:not([data-theme="light"]) {'
DARK_ATTRIBUTE_HEADER = ':root[data-theme="dark"] {'


def block_after(text: str, header: str) -> str:
    """The body of the first `header { ... }` block, braces matched."""
    start = text.index(header) + len(header)
    depth = 1
    for position in range(start, len(text)):
        if text[position] == "{":
            depth += 1
        elif text[position] == "}":
            depth -= 1
            if depth == 0:
                return text[start:position]
    raise AssertionError("unbalanced braces after " + header)


def declarations(body: str) -> dict[str, str]:
    return {name: value.strip() for name, value in DECLARATION.findall(body)}


def luminance(colour: str) -> float:
    digits = colour.lstrip("#")
    red, green, blue = (int(digits[i : i + 2], 16) / 255 for i in (0, 2, 4))
    def linear(channel: float) -> float:
        return channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4
    return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)


def contrast(first: str, second: str) -> float:
    high, low = sorted((luminance(first), luminance(second)), reverse=True)
    return (high + 0.05) / (low + 0.05)


class NotesPageIsOutsideTheSiteRules(unittest.TestCase):
    def test_the_page_is_not_a_root_marketing_page(self) -> None:
        self.assertNotIn(NOTES_PAGE, marketing_pages())
        self.assertEqual(
            tuple(page.name for page in marketing_pages()),
            EXPECTED_PAGES,
            "A root page was added. The notes page lives in notes/ so the pinned page list stays at five.",
        )

    def test_no_dash_in_anything_a_user_reads(self) -> None:
        text = NOTES_PAGE.read_text(encoding="utf-8")
        self.assertEqual(DASHES.findall(text), [])
        api = REPOSITORY / "api" / "_lib" / "notes-api.js"
        self.assertEqual(DASHES.findall(api.read_text(encoding="utf-8")), [])


class NotesPageFollowsTheSpudNotesLook(unittest.TestCase):
    """CLAUDE.md section 9c. Ruled by the product owner on 19 October 2026."""

    def setUp(self) -> None:
        self.page = NOTES_PAGE.read_text(encoding="utf-8")
        self.text = without_comments(self.page)
        self.style = self.text.split("<style>", 1)[1].split("</style>", 1)[0]
        self.light = declarations(block_after(self.style, LIGHT_HEADER))
        self.dark_media = declarations(block_after(self.style, DARK_MEDIA_HEADER))
        self.dark_attribute = declarations(block_after(self.style, DARK_ATTRIBUTE_HEADER))
        self.theme_variables = {
            name: value for name, value in self.light.items() if name.startswith("--") and THEME_VALUE.fullmatch(value)
        }

    def without_theme_blocks(self, text: str) -> str:
        for header in (LIGHT_HEADER, DARK_MEDIA_HEADER, DARK_ATTRIBUTE_HEADER):
            text = text.replace(header + block_after(text, header) + "}", "")
        return text

    # ---- palette ----

    def test_raw_colours_only_inside_the_three_theme_blocks(self) -> None:
        self.assertGreaterEqual(len(self.theme_variables), 17, "The light block was not read.")
        outside = self.without_theme_blocks(self.text)
        self.assertEqual(HEX.findall(outside.replace("&#", "")), [], "A raw hex colour sits outside the theme blocks.")
        # rgba() and every other colour function: only inside the theme blocks.
        self.assertEqual(COLOUR_FUNCTION.findall(outside), [], "A colour function sits outside the theme blocks.")
        self.assertEqual(RGBA.findall(outside), [], "An rgba value sits outside the theme blocks.")
        inside = "".join(block_after(self.style, h) for h in (LIGHT_HEADER, DARK_MEDIA_HEADER, DARK_ATTRIBUTE_HEADER))
        self.assertEqual(len(RGBA.findall(inside)), 3, "The scrim is the only rgba value, once in each theme block.")

    def test_px_font_sizes_only_inside_root(self) -> None:
        outside = self.without_theme_blocks(self.style)
        sizes = re.findall(r"font-size:\s*([^;]+);", outside)
        self.assertGreaterEqual(len(sizes), 8, "Too few font-size declarations were read.")
        for size in sizes:
            self.assertRegex(size, r"^var\(--notes-size-(12|13|14|15|18|30)\)$", f"font-size {size}")
        self.assertEqual({v for k, v in self.light.items() if k.startswith("--notes-size-")}, NOTES_SIZES)
        self.assertNotRegex(self.without_theme_blocks(self.text), r"font:\s*[^;]*\d+px", "A font shorthand sets a px size.")

    def test_the_dark_blocks_match_and_cover_the_light_block(self) -> None:
        self.assertEqual(self.dark_media, self.dark_attribute, "The two dark blocks differ.")
        self.assertEqual(self.dark_media["color-scheme"], "dark")
        missing = sorted(set(self.theme_variables) - set(self.dark_media))
        self.assertEqual(missing, [], "Declared in the light block and not in dark: " + ", ".join(missing))
        extra = sorted(name for name in self.dark_media if name.startswith("--") and name not in self.theme_variables)
        self.assertEqual(extra, [], "Declared in dark and not in the light block: " + ", ".join(extra))
        for name, value in self.dark_media.items():
            if name.startswith("--"):
                self.assertRegex(value, THEME_VALUE, name)

    def test_color_scheme_follows_the_device_and_the_choice(self) -> None:
        self.assertEqual(self.light["color-scheme"], "light dark")
        self.assertIn(':root[data-theme="light"] { color-scheme: light; }', self.style)

    def test_every_variable_it_reads_is_declared(self) -> None:
        declared, chain = declared_custom_properties(NOTES_PAGE)
        self.assertIn("/tokens.css", chain, "The page no longer loads tokens.css, which carries the Archivo font face.")
        used = used_custom_properties(self.text)
        self.assertGreaterEqual(len(used), 15, "Too few var() reads were found.")
        self.assertEqual(sorted(used - declared), [], "var() names nothing declares.")
        # The page reads only its own variables.
        self.assertEqual(sorted(name for name in used if not name.startswith("--notes-")), [])
        self.assertEqual(sorted(used - set(self.light)), [], "Read but not declared in the light block.")

    def test_contrast_in_both_themes(self) -> None:
        pairs = 0
        for theme, values in (("light", self.light), ("dark", self.dark_media)):
            for foreground in ("--notes-ink", "--notes-strong", "--notes-muted", "--notes-bad"):
                for ground in ("--notes-ground", "--notes-panel", "--notes-hover"):
                    ratio = contrast(values[foreground], values[ground])
                    pairs += 1
                    self.assertGreaterEqual(
                        ratio, 4.5, f"{theme}: {foreground} {values[foreground]} on {ground} {values[ground]} is {ratio:.2f}:1"
                    )
            ratio = contrast(values["--notes-on-accent"], values["--notes-accent"])
            pairs += 1
            self.assertGreaterEqual(ratio, 4.5, f"{theme}: --notes-on-accent on --notes-accent is {ratio:.2f}:1")
        self.assertEqual(pairs, 26, "A contrast pair was skipped.")

    def test_contrast_on_the_selected_fill_in_both_themes(self) -> None:
        for theme, values in (("light", self.light), ("dark", self.dark_media)):
            for foreground, floor in (("--notes-strong", 4.5), ("--notes-ink", 4.5), ("--notes-icon", 3.0)):
                ratio = contrast(values[foreground], values["--notes-selected"])
                self.assertGreaterEqual(
                    ratio, floor, f"{theme}: {foreground} on --notes-selected is {ratio:.2f}:1, needs {floor}:1"
                )
        self.assertEqual(self.light["--notes-selected"], "#e4dccf")
        self.assertEqual(self.dark_media["--notes-selected"], "#3d3936")
        self.assertEqual(self.light["--notes-scrim"], "rgba(26, 25, 24, 0.4)")
        self.assertEqual(self.dark_media["--notes-scrim"], "rgba(0, 0, 0, 0.6)")

    def test_muted_is_never_set_on_the_selected_fill(self) -> None:
        rules = re.findall(r"([^{}@]+)\{([^{}]*)\}", self.without_theme_blocks(self.style))
        selected = [(selector.strip(), body) for selector, body in rules if "--notes-selected" in body or "aria-current" in selector]
        self.assertGreaterEqual(len(selected), 2, "The selected rules were not found.")
        for selector, body in selected:
            self.assertNotIn("--notes-muted", body, f"{selector} puts muted text on the selected fill.")
        # Nothing else a selected menu item contains is muted either.
        self.assertNotRegex(self.style, r"aria-current[^{}]*\{[^}]*muted")

    def test_the_contrast_check_can_fail(self) -> None:
        self.assertAlmostEqual(contrast("#000000", "#ffffff"), 21.0, places=1)
        self.assertLess(contrast("#77716e", "#ede8e1"), 4.5)

    def test_the_retired_grey_is_gone(self) -> None:
        self.assertNotIn("77716e", self.page.lower())

    # ---- type ----

    def test_no_uppercase_and_no_positive_tracking(self) -> None:
        self.assertNotRegex(self.style, r"text-transform")
        spacings = re.findall(r"letter-spacing:\s*([^;]+);", self.style)
        self.assertEqual(sorted(spacings), ["-0.01em", "-0.02em"], "Only the h1 and the wordmark are tightened.")

    def test_archivo_only_on_the_wordmark(self) -> None:
        rules = re.findall(r"([^{}]+)\{([^{}]*font-family:[^;}]*Archivo[^;}]*;[^{}]*)\}", self.style)
        self.assertEqual([selector.strip() for selector, _ in rules], [".wordmark"])
        self.assertIn("font-weight: 800", rules[0][1])
        body = re.search(r"\n  body \{([^}]*)\}", self.style).group(1)
        self.assertIn('font-family: "Segoe UI", system-ui, sans-serif;', body)

    def test_monospace_only_in_the_note_box(self) -> None:
        families = re.findall(r"font-family:\s*([^;]+);", self.style)
        monospace = [family for family in families if "monospace" in family]
        self.assertEqual(len(monospace), 1, "Only the note box may use monospace.")
        self.assertIn(".editor", self.style.split(monospace[0])[0].rsplit("{", 1)[0])

    # ---- shape ----

    def test_corners_are_six_or_eight_and_nothing_casts_a_shadow(self) -> None:
        radii = re.findall(r"border-radius:\s*([^;]+);", self.style)
        self.assertGreaterEqual(len(radii), 8, "Too few border-radius declarations were read.")
        self.assertEqual(sorted(set(radii)), ["6px", "8px"])
        self.assertNotRegex(self.style, r"shadow")

    def test_borders_are_one_pixel_and_outlines_are_two(self) -> None:
        borders = re.findall(r"border(?:-(?:top|right|bottom|left))?\s*:\s*([^;]+);", self.style)
        self.assertGreaterEqual(len(borders), 8, "Too few border declarations were read.")
        for border in borders:
            self.assertTrue(border in ("0", "none") or border.startswith("1px solid "), f"border: {border}")
        self.assertNotRegex(self.style, r"border-(?:top|right|bottom|left)?-?width")
        outlines = re.findall(r"outline\s*:\s*([^;]+);", self.style)
        self.assertEqual(set(outlines), {"2px solid var(--notes-accent)"})
        self.assertEqual(set(re.findall(r"outline-offset:\s*([^;]+);", self.style)), {"2px"})

    # ---- icons and controls ----

    def test_exactly_thirteen_icon_shapes_all_stroked_in_the_current_colour(self) -> None:
        symbols = re.findall(r"<symbol\b([^>]*)>", self.text)
        ids = sorted(re.search(r'id="([^"]+)"', attributes).group(1) for attributes in symbols)
        self.assertEqual(
            ids,
            sorted(["i-archive", "i-bin", "i-chevron-left", "i-journal", "i-menu", "i-moon", "i-note", "i-pencil",
                    "i-plus", "i-search", "i-sun", "i-tag", "i-unarchive"]),
        )
        for attributes in symbols:
            for required in ('viewBox="0 0 24 24"', 'fill="none"', 'stroke="currentColor"', 'stroke-width="1.8"',
                             'stroke-linecap="round"', 'stroke-linejoin="round"'):
                self.assertIn(required, attributes)
        # Used in the markup, or named in the script by icon("name").
        references = set(re.findall(r'<use href="#(i-[a-z-]+)"', self.text))
        for arguments in re.findall(r"\bicon\(([^()]*)\)", self.text):
            references |= {"i-" + name for name in re.findall(r'"([a-z-]+)"', arguments.replace(', "small"', ''))}
        self.assertEqual(sorted(references), ids, "Every shape is used and nothing else is.")
        for svg in re.findall(r"<svg\b([^>]*class=\"icon[^>]*)>", self.text):
            self.assertIn('stroke="currentColor"', svg)
            self.assertIn('aria-hidden="true"', svg)
        for svg in re.findall(r"<svg\b[^>]*>", self.text):
            self.assertNotRegex(svg, r"stroke=\"(?!currentColor)")
        # The script's own svg string is held to the same rule.
        self.assertIn('viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"', self.text.split("function icon(", 1)[1])

    def test_every_icon_button_in_the_script_names_what_it_acts_on(self) -> None:
        self.assertIn('remove.setAttribute("aria-label", "Delete note: " + item.title);', self.text)
        self.assertIn('remove.title = "Delete note";', self.text)
        self.assertIn('archive.setAttribute("aria-label", (item.archived ? "Unarchive note: " : "Archive note: ") + item.title);', self.text)
        self.assertIn('rename.setAttribute("aria-label", "Rename label: " + label.name);', self.text)
        self.assertIn('remove.setAttribute("aria-label", "Delete label: " + label.name);', self.text)
        # Every icon button the script makes carries one of those labels.
        made = re.findall(r'className = "icon-button [a-z-]+"', self.text)
        self.assertEqual(
            sorted(made),
            sorted(['className = "icon-button row-archive"', 'className = "icon-button row-delete"',
                    'className = "icon-button label-rename"', 'className = "icon-button label-delete"']),
        )
        self.assertEqual(len(re.findall(r'setAttribute\("aria-label", ', self.text)) - 3, len(made),
                         "Besides the three other aria-labels, one per icon button.")

    def test_buttons_do_not_change_case_or_appearance(self) -> None:
        self.assertIn("appearance: none;", block_after(self.style, "\n  button {"))
        self.assertIn("min-height: 44px;", block_after(self.style, "\n  button {"))

    def test_the_header_and_the_theme_switch(self) -> None:
        self.assertIn('<img class="mark" src="/logo-stone.svg" alt="">', self.text)
        self.assertIn("Silurian Notes</p>", self.text)
        self.assertNotIn("<span>Notes</span>", self.text)
        self.assertIn("aspect-ratio: 200 / 290;", self.style)
        self.assertIn('id="theme-switch" aria-label="Switch to dark mode"', self.text)
        self.assertNotIn("aria-pressed", self.text)
        self.assertLess(self.text.index('id="theme-switch"'), self.text.index('id="bar-actions"'))
        self.assertNotIn('id="bar-actions" hidden', self.text.split("<main>")[0].split('id="theme-switch"')[0])

    # ---- the theme script ----

    def test_the_theme_script_wraps_storage_in_try_catch_and_runs_before_the_stylesheet(self) -> None:
        for script_id in ("theme-init", "theme-switch-script"):
            script = re.search(rf'<script id="{script_id}">(.*?)</script>', self.page, re.DOTALL).group(1)
            uses = list(re.finditer(r"localStorage", script))
            self.assertGreaterEqual(len(uses), 1, script_id)
            for use in uses:
                before, after = script[: use.start()], script[use.end() :]
                inside_try = before.rfind("try {") > before.rfind("catch")
                self.assertTrue(inside_try and "catch" in after, f"{script_id}: a localStorage use is outside try/catch.")
        self.assertEqual(len(re.findall(r"localStorage", self.text)), 2, "No other code may touch storage.")
        self.assertLess(self.page.index('<script id="theme-init">'), self.page.index('<link rel="stylesheet"'))
        self.assertLess(self.page.index('<script id="theme-init">'), self.page.index("<style>"))
        self.assertIn('"silurian-notes-theme"', self.page)
        self.assertNotIn("localStorage", self.page.split('<script>\n(function () {\n  "use strict";\n\n  var MAX_BYTES')[1],
                         "The notes script must not read or write the theme choice.")



class NotesPageVersionFourMenuLabelsAndArchive(unittest.TestCase):
    """CLAUDE.md section 9d. Ruled by the product owner on 20 October 2026."""

    def setUp(self) -> None:
        self.page = NOTES_PAGE.read_text(encoding="utf-8")
        self.text = without_comments(self.page)
        self.style = self.text.split("<style>", 1)[1].split("</style>", 1)[0]
        self.body = self.text.split("<body>", 1)[1]

    def test_the_menu_is_a_nav_with_the_items_in_order_and_no_headings(self) -> None:
        nav = re.search(r'<nav class="menu" id="menu" aria-label="Notes menu" hidden>(.*?)</nav>', self.body, re.DOTALL).group(1)
        position, order = 0, []
        for marker in ('data-key="notes"', '<hr class="menu-rule">', 'id="menu-labels"', 'data-key="labels"',
                       '<hr class="menu-rule">', 'data-key="archive"'):
            position = nav.index(marker, position)
            order.append(position)
            position += 1
        self.assertEqual(order, sorted(order), "Notes, a rule, the labels, Edit labels, a rule, Archive.")
        for key in ("notes", "labels", "archive"):
            self.assertEqual(nav.count(f'data-key="{key}"'), 1, f"One {key} item.")
        # Journal (journal design brief, section 7): the last item, after Archive, a plain link.
        self.assertLess(nav.index('data-key="archive"'), nav.index('id="menu-journal"'))
        self.assertLess(nav.index('id="menu-journal"'), nav.index('<div class="menu-foot">'))
        self.assertEqual(nav.count('id="menu-journal"'), 1)
        self.assertIn('<a class="menu-item" href="/journal/" id="menu-journal">', nav)
        self.assertIn('<use href="#i-journal"></use></svg><span class="menu-text">Journal</span></a>', nav)
        self.assertNotIn('data-key="journal"', nav, "A plain link: the notes script routes only the items with a key.")
        self.assertEqual(nav.count('<hr class="menu-rule">'), 3, "Two rules in the list, one above the phone-only footer.")
        self.assertNotRegex(nav, r"<h[1-6]\b")
        self.assertIn('<div id="menu-labels"></div>', nav, "With no labels nothing sits between the rules but Edit labels.")
        for text in ("Notes", "Edit labels", "Archive"):
            self.assertIn(f'<span class="menu-text">{text}</span>', nav)
        self.assertIn('Dark mode', nav)
        self.assertIn('Light mode', nav)

    def test_the_menu_is_sized_and_placed_as_briefed(self) -> None:
        self.assertIn("width: 240px;", block_after(self.style, "\n  .menu {"))
        self.assertNotIn("960px", self.style, "The header no longer stops at 960px.")
        main = block_after(self.style, "\n  main {")
        self.assertIn("width: min(800px, 100%);", main)
        self.assertIn("padding: 24px 24px 48px;", main)
        phone = self.style.split("@media (max-width: 760px) {", 1)[1]
        self.assertIn("width: 280px;", phone)
        self.assertIn("max-width: 85vw;", phone)
        self.assertIn("background: var(--notes-scrim);", phone)
        self.assertEqual(len(re.findall(r"@media \(max-width: 760px\)", self.style)), 1)
        self.assertNotRegex(self.style, r"transition|animation", "The phone menu opens and closes at once.")

    def test_the_menu_button_and_new_note_button_at_phone_width(self) -> None:
        self.assertIn('id="menu-button" aria-label="Open menu" aria-expanded="false" aria-controls="menu"', self.body)
        self.assertIn('id="new-note" aria-label="New note"', self.body)
        self.assertIn("#new-note .btn-label { display: none; }", self.style)
        self.assertIn("body.signed-in #theme-switch, body.signed-in #sign-out { display: none; }", self.style)

    def test_chip_shape_and_limits(self) -> None:
        chip = block_after(self.style, "\n  .chip {")
        for declaration in ("max-width: 120px;", "height: 22px;", "padding: 0 8px;", "border-radius: 6px;",
                            "border: 1px solid var(--notes-line);", "background: var(--notes-panel);"):
            self.assertIn(declaration, chip)
        self.assertIn("gap: 6px;", block_after(self.style, "\n  .chips {"))
        self.assertIn("flex-wrap: nowrap;", block_after(self.style, "\n  .chips {"))
        self.assertIn("if (index >= 3) { el.classList.add(\"over-wide\"); }", self.text)
        self.assertIn("if (index >= 2) { el.classList.add(\"over-narrow\"); }", self.text)
        self.assertIn('aria-hidden", "true"', self.text)
        self.assertIn('"Labels: "', self.text)

    def test_every_empty_state_says_exactly_what_the_brief_says(self) -> None:
        for copy in (
            "No labels yet. Type a name above and press Create.",
            "No labels yet. Type a name to create one.",
            "No notes have the label ",
            ". Open a note and press Labels to add it.",
            " Archived notes with this label are under Archive.",
            "Nothing archived. Archive a note to take it out of your notes without deleting it.",
            "No notes yet. Press New note to write the first one.",
        ):
            self.assertIn(copy, self.text)
        self.assertIn("LABEL_EMPTY_BEFORE + (label ? label.name : \"\") + LABEL_EMPTY_AFTER", self.text)
        self.assertIn('"Note archived."', self.text)
        self.assertIn('"Note unarchived."', self.text)
        self.assertIn('"Delete the label " + label.name + "? "', self.text)
        for sentence in ("No notes carry it.", "It is on 1 note.", '"It is on " + count + " notes."', '" The notes stay."'):
            self.assertIn(sentence, self.text)
        self.assertIn('"There is already a label called " + name + "."', self.text)
        self.assertEqual(DASHES.findall(self.page), [])

    def test_the_addresses_are_in_the_page(self) -> None:
        # The list is asked for once, as every note (view=all), and Notes, Archive and a
        # label are cut from it on the page (notes speed). view=archive stays as the
        # fallback for the empty label sentence when nothing is in memory yet.
        for fragment in ('hash === "#labels"', 'hash === "#archive"', '"#l/" + view.id', 'hash === "#new"', "view=archive",
                         "view=all"):
            self.assertIn(fragment, self.text)
        self.assertRegex(self.text, r"#l\\/\(\[0-9a-f\]\{32\}\)\$")

    def test_the_new_files_are_not_public(self) -> None:
        # api/labels.js is a function, not a static file, so the allowlist is unchanged.
        allowlist = (REPOSITORY / "site-allowlist.txt").read_text(encoding="utf-8")
        self.assertNotIn("labels", allowlist)


def function_body(text: str, name: str) -> str:
    """The body of `function name(...) { ... }` in the page script, braces matched."""
    start = text.index("function " + name + "(")
    return block_after(text[start:], text[start : text.index("{", start)] + "{")


class NotesPageSpeedKeepsMemoryOnly(unittest.TestCase):
    """What the page remembers to feel fast is held in memory and nowhere else,
    and is dropped on sign out, on a 401 and when the page is left (notes speed).
    The behaviour is held by `browser-check-speed.mjs`, which searches the page's
    heap for a note's text; these are the static halves of the same promise."""

    text = NOTES_PAGE.read_text(encoding="utf-8")

    def test_memory_is_dropped_on_sign_out_on_a_401_and_when_the_page_is_left(self) -> None:
        for name in ("clearContent", "goToLogin"):
            self.assertIn("forgetMemory();", function_body(self.text, name), f"{name} must drop the page's memory")
        # Sign out and leaving the page both go through clearContent.
        self.assertIn("clearContent();", function_body(self.text, "signOut") + self.text[self.text.index('"pagehide"') : self.text.index('"pagehide"') + 200])
        body = function_body(self.text, "forgetMemory")
        for fragment in ("mem = { all: null, opened: {} };", "inFlight = {};", "changesInFlight = 0;", "memoryGeneration += 1;"):
            self.assertIn(fragment, body)

    def test_nothing_is_written_to_the_device_but_the_theme_choice(self) -> None:
        for api in ("sessionStorage", "indexedDB", "caches.", "serviceWorker", "document.cookie", "openDatabase"):
            self.assertNotIn(api, self.text, f"the page must not keep notes with {api}")
        stores = re.findall(r"localStorage\.(?:setItem|getItem|removeItem)\(([^,)]+)", self.text)
        self.assertTrue(stores, "the theme choice is read and written")
        self.assertEqual(set(stores), {'"silurian-notes-theme"', "KEY"}, "localStorage holds the theme choice and nothing else")

    def test_the_page_asks_for_the_whole_list_once_instead_of_one_list_per_view(self) -> None:
        list_requests = re.findall(r'"/api/notes[^"]*"', self.text)
        self.assertIn('"/api/notes?view=all"', list_requests)
        self.assertNotIn('"/api/notes?view=notes"', list_requests)
        self.assertNotRegex(self.text, r'view=label')

    def test_a_refused_background_change_puts_the_screen_back(self) -> None:
        # Both the row and the open note put the note back in memory on a refusal,
        # and the labels go back to what the server confirmed.
        self.assertIn("remember(item);\n        refused(result.error);", self.text)
        self.assertIn("note.labels = note.serverLabels.slice();", function_body(self.text, "saveLabels"))
        self.assertIn("repaintFromMemory();\n        showFlash(error, null);", self.text)


if __name__ == "__main__":
    unittest.main()
