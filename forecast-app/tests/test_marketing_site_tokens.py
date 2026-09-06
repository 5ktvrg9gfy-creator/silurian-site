"""Fail the build when a marketing-site page carries a raw colour value.

WHY A MARKETING SITE CONTROL LIVES IN THE ASSAY SUITE
-----------------------------------------------------
This file tests the static marketing site at the repository root, not the
Assay application around it. That is deliberate and was decided knowingly.

`forecast-app/tests/` is the only suite anything invokes. A separate suite at
the root would be architecturally correct and would never run, and a control
that does not fire is worse than one filed in the wrong drawer. The
cross-product status check below has no other home in any case, because it
spans both products at once.

So this file is a known compromise, recorded rather than quiet. Do not delete
it as misplaced. If the marketing site ever gains its own invoked suite, move
it there and delete this note with it.

Ownership moved on 6 September 2026. This file belongs to the marketing-site
session, not to the Assay session it sits beside. It reached that point the
hard way: removing the homepage's inline mark made the page and this control
disagree, and the two halves of one atomic change sat on opposite sides of a
session boundary, so whichever landed first left main red. The directory is
still Assay's. This file is not.

WHAT IT PINS, AND WHAT IT DOES NOT
----------------------------------
Colours only. Every colour on the three marketing pages comes from
`tokens.css` and nowhere else, so a second palette cannot appear the way the
Claude Design export's palette appeared on `forecast-risk.html` and ran in
Production for weeks before anyone saw it.

Font sizes and weights are deliberately NOT pinned. `index.html` alone uses
24 distinct raw font sizes with no scale behind them, so a test would be
asserting a list rather than a rule, and every legitimate edit would fail it.
A control people learn to ignore is worse than no control, so this one stops
at colour and says so.

The scan is textual, which is what makes it cover canvas literals: a colour
written into `ctx.strokeStyle` is a raw colour in the file like any other.
"""

import re
import unittest
from pathlib import Path


REPOSITORY = Path(__file__).parents[2]

# The token file is excluded BY NAME, never by pattern. It is the one file
# that is supposed to hold raw colour values; a pattern such as "*.css" would
# silently exempt any stylesheet added later.
TOKEN_FILE_NAME = "tokens.css"

# The marketing pages, pinned. A fourth page failing this assertion is the
# intended behaviour and not a nuisance: see test_the_page_list_is_pinned.
EXPECTED_PAGES = ("forecast-risk.html", "index.html", "privacy.html")

# There is no exclusion, and there was one until 6 September 2026. index.html
# carried the mark inline, six raw fills that an SVG loaded through <img>
# cannot read from a page's custom properties, so the scan stripped
# fill="#..." from that page and pinned the count at exactly six. The hero
# stone was removed as a repeat of the header mark, the page now carries no
# fill attribute at all, and the exclusion was deleted rather than set to
# zero: nothing is stripped before the scan runs, so an inline fill on any
# page is now caught by the raw-colour assertion directly. That is stricter
# than the rule it replaces. The mark's six values live in logo-stone.svg and
# in assets/hero-stone.svg, and neither is a page this control reads.

# Status colours, defined in two places on purpose. See the note in
# tokens.css: the two products deploy separately and cannot share a file
# today, so the duplicate is recorded and held equal by test rather than
# created quietly.
ASSAY_PAGE = REPOSITORY / "forecast-app" / "static" / "index.html"
STATUS_PAIRS = (
    ("--color-status-good", "--good"),
    ("--color-status-warn", "--warn"),
    ("--color-status-bad", "--bad"),
)

# Every form a colour can take. A hex scan is not a colour scan: the same
# value hides as rgb(), inside a color-mix(), or as a quoted canvas literal,
# and correcting this site's accent meant changing two rgba() forms that a
# hex scan had already reported clean.
COLOUR_FORMS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("hex literal", re.compile(r"#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b")),
    ("rgb() or rgba() literal", re.compile(r"\brgba?\(\s*[\d.]")),
    ("hsl() or hsla() literal", re.compile(r"\bhsla?\(\s*[\d.]")),
    (
        "color-mix() over a raw value rather than a token",
        re.compile(r"color-mix\([^)]*?(?:#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.])"),
    ),
    (
        "canvas colour written as a literal instead of read from a token",
        re.compile(
            r"\b(?:fillStyle|strokeStyle|shadowColor)\s*=\s*['\"][^'\"]+['\"]"
        ),
    ),
)


def marketing_pages() -> tuple[Path, ...]:
    """Every HTML page at the repository root, from the filesystem.

    Read from disk rather than from `git ls-files` on purpose: the control
    fires as soon as a page exists, rather than waiting for someone to stage
    it. Failing earlier, and not depending on staging discipline, is the
    reason.

    Found by probing the fourth-page guard with an untracked file, which the
    git-based version reported OK. Note what that probe did and did not
    prove. It proved the guard was blind to an unstaged page. It did NOT
    prove that page could reach the public: Vercel's Git integration builds
    from the commit, so an untracked file is not deployed, and the guard
    would have failed in CI once the page was committed and before any
    deploy. The window was local, not public. A manual `vercel --prod` from a
    working directory does upload untracked files and would make it public,
    but that is not how this project is documented to deploy.
    """
    roots = sorted(path.name for path in REPOSITORY.glob("*.html"))
    return tuple(REPOSITORY / name for name in roots)


def raw_colours(text: str) -> list[tuple[str, str]]:
    """Return (form, matched text) for every raw colour value in text."""
    found: list[tuple[str, str]] = []
    for form, pattern in COLOUR_FORMS:
        for match in pattern.finditer(text):
            found.append((form, match.group(0)))
    return found


def declared_values(text: str, names: tuple[str, ...]) -> dict[str, list[str]]:
    """Every declaration of each named custom property, in source order."""
    return {
        name: [
            match.group(1).strip()
            for match in re.finditer(
                re.escape(name) + r"\s*:\s*([^;}\n]+)", text
            )
        ]
        for name in names
    }


class MarketingSiteTokens(unittest.TestCase):
    def test_no_page_carries_a_raw_colour_value(self) -> None:
        for page in marketing_pages():
            findings = raw_colours(page.read_text(encoding="utf-8"))
            self.assertEqual(
                findings,
                [],
                f"{page.name} carries a raw colour value. Every colour on the "
                f"marketing site comes from {TOKEN_FILE_NAME}; move the value "
                f"there and reference it with var(). Findings: {findings}",
            )

    def test_the_page_list_is_pinned(self) -> None:
        """A new page must fail this, and the failure is the point.

        Do not loosen this assertion to make a new page pass. A new page is
        exactly when a second palette appears: it is how forecast-risk.html
        came to run the Claude Design export's colours in Production for
        weeks. Bring the new page onto tokens.css, then add it here.
        """
        found = tuple(page.name for page in marketing_pages())
        self.assertEqual(
            found,
            EXPECTED_PAGES,
            "The set of marketing pages has changed. If a page was added, put "
            "it on tokens.css and add it to EXPECTED_PAGES. Do not widen this "
            "test to let an untokenised page through: a new page is exactly "
            "when a second palette appears, which is how forecast-risk.html "
            "ran the wrong palette in Production for weeks.",
        )

    def test_the_scan_actually_reads_the_pages(self) -> None:
        """A scan that finds nothing because it read nothing is not a pass."""
        pages = marketing_pages()
        self.assertEqual(len(pages), 3)
        total = 0
        for page in pages:
            text = page.read_text(encoding="utf-8")
            self.assertGreater(len(text), 500, f"{page.name} read as near-empty")
            total += len(text)
        self.assertGreater(total, 20_000)

    def test_the_token_file_is_excluded_by_name_and_not_by_pattern(self) -> None:
        token_file = REPOSITORY / TOKEN_FILE_NAME
        self.assertTrue(token_file.exists())
        # It must hold raw values: it is the one place they belong.
        self.assertNotEqual(raw_colours(token_file.read_text(encoding="utf-8")), [])
        # And it must never be reached by the page scan, which takes .html
        # files at the root by name, not stylesheets by pattern.
        self.assertNotIn(
            TOKEN_FILE_NAME, [page.name for page in marketing_pages()]
        )

    def test_an_inline_svg_fill_is_a_finding(self) -> None:
        """What the deleted exclusion used to permit must now fail.

        Until 6 September 2026 a fill="#..." on index.html was stripped from
        the text before the scan saw it, and only a change in their number
        failed the build. The hero stone that needed that exclusion is gone,
        so a fill attribute is now an ordinary raw colour on the page.
        """
        planted = '<polygon points="0,0 1,1" fill="#ec6917"/>'
        forms = {form for form, _ in raw_colours(planted)}
        self.assertIn("hex literal", forms)

    def test_every_form_of_raw_colour_is_caught(self) -> None:
        """Probe each form. A pattern that no longer fires is not coverage."""
        planted = {
            "hex literal": "a { color: #ec6917; }",
            "rgb() or rgba() literal": "a { color: rgba(236,105,23,.2); }",
            "hsl() or hsla() literal": "a { color: hsl(24, 84%, 51%); }",
            "color-mix() over a raw value rather than a token":
                "a { color: color-mix(in srgb, #ec6917 20%, transparent); }",
            "canvas colour written as a literal instead of read from a token":
                "ctx.strokeStyle='#ec6917';",
        }
        for form, sample in planted.items():
            with self.subTest(form=form):
                forms = {found for found, _ in raw_colours(sample)}
                self.assertIn(form, forms, f"{form} was not caught in {sample!r}")

    def test_a_tokenised_page_is_not_a_finding(self) -> None:
        """The forms must not fire on the shapes the site legitimately uses."""
        legal = (
            "a { color: var(--color-accent); }"
            "b { background: color-mix(in srgb, var(--color-text) 55%, transparent); }"
            "ctx.strokeStyle=token('--color-text');"
            "ctx.fillStyle=alpha(token('--color-accent'),.16);"
        )
        self.assertEqual(raw_colours(legal), [])


# The font face, checked because it is the one declaration on this site that
# fails silently. A root-relative src plus font-display: swap means a broken
# path paints a fallback rather than raising anything: the page still renders,
# still looks deliberate, and only an eye that knows Archivo catches it. That
# is not hypothetical here. It happened to this project's design mocks and was
# found by looking, not by any tool.
FONT_FACE_PATTERN = re.compile(r"@font-face\s*\{[^}]*\}", re.DOTALL)
FONT_SRC_PATTERN = re.compile(r"""src:\s*url\(\s*["']?([^"')]+)["']?\s*\)""")


def font_sources(text: str) -> list[str]:
    """Every url() inside an @font-face block, in source order."""
    found: list[str] = []
    for block in FONT_FACE_PATTERN.findall(text):
        found.extend(FONT_SRC_PATTERN.findall(block))
    return found


class SelfHostedFontLoads(unittest.TestCase):
    """The declared font file must exist at the path the site asks for.

    This does not prove the browser loaded it, which needs a browser. It
    proves the failure that actually occurred: a path that no longer points
    at a file. Everything downstream of that is invisible by design.
    """

    def setUp(self) -> None:
        self.tokens = (REPOSITORY / TOKEN_FILE_NAME).read_text(encoding="utf-8")

    def test_the_token_file_declares_exactly_one_font_source(self) -> None:
        sources = font_sources(self.tokens)
        self.assertEqual(
            len(sources),
            1,
            f"Expected one @font-face src in {TOKEN_FILE_NAME}, found {sources}. "
            "A second source is either a format fallback worth recording or a "
            "second face nobody decided on.",
        )

    def test_the_font_url_is_root_relative(self) -> None:
        source = font_sources(self.tokens)[0]
        self.assertTrue(
            source.startswith("/"),
            f"The font src {source!r} is not root relative. A URL inside a "
            f"linked stylesheet resolves against the stylesheet, not the page, "
            f"so a relative form breaks the moment {TOKEN_FILE_NAME} moves, "
            "and breaks quietly because font-display: swap paints a fallback.",
        )
        self.assertFalse(
            source.startswith("//") or "://" in source,
            f"The font src {source!r} points off this origin. Archivo is self "
            "hosted on purpose: no page may send a visitor to a third party "
            "before it renders.",
        )

    def test_the_font_file_exists_where_the_stylesheet_asks_for_it(self) -> None:
        source = font_sources(self.tokens)[0]
        target = REPOSITORY / source.lstrip("/")
        self.assertTrue(
            target.is_file(),
            f"{TOKEN_FILE_NAME} asks for {source}, which is not a file in this "
            "repository. The site would paint a fallback face and look "
            "deliberate while doing it.",
        )
        self.assertGreater(
            target.stat().st_size,
            10_000,
            f"{source} exists but is too small to be a variable font file.",
        )

    def test_a_broken_path_is_caught(self) -> None:
        """Probe it. A check that cannot fail is decoration."""
        broken = self.tokens.replace(
            "/assets/fonts/", "/assets/fonts-moved/"
        )
        self.assertNotEqual(broken, self.tokens, "probe planted nothing")
        source = font_sources(broken)[0]
        self.assertFalse((REPOSITORY / source.lstrip("/")).is_file())

    def test_a_relative_path_is_caught(self) -> None:
        """The form that fails only after the file moves, probed now."""
        relative = self.tokens.replace(
            'url("/assets/fonts/', 'url("assets/fonts/'
        )
        self.assertNotEqual(relative, self.tokens, "probe planted nothing")
        self.assertFalse(font_sources(relative)[0].startswith("/"))

    def test_a_third_party_source_is_caught(self) -> None:
        """Archivo came off Google Fonts once. It does not go back quietly."""
        remote = self.tokens.replace(
            'url("/assets/fonts/Archivo-Variable.ttf")',
            'url("https://fonts.gstatic.com/s/archivo/v19/Archivo.ttf")',
        )
        self.assertNotEqual(remote, self.tokens, "probe planted nothing")
        self.assertIn("://", font_sources(remote)[0])


class StatusColoursMatchAssay(unittest.TestCase):
    """Hold the one accepted duplicate in the band equal by mechanism.

    The three status values exist twice, in tokens.css and in Assay's own
    :root block, because the two products deploy through separate Vercel
    projects and cannot share a file today without a build step. The comment
    in tokens.css records why the duplicate exists. This test stops the two
    definitions drifting apart, and fails if either side moves.
    """

    def setUp(self) -> None:
        self.tokens = (REPOSITORY / TOKEN_FILE_NAME).read_text(encoding="utf-8")
        self.assay = ASSAY_PAGE.read_text(encoding="utf-8")

    def test_both_files_declare_all_three_status_colours_exactly_once(self) -> None:
        site = declared_values(self.tokens, tuple(a for a, _ in STATUS_PAIRS))
        assay = declared_values(self.assay, tuple(b for _, b in STATUS_PAIRS))
        for name, values in {**site, **assay}.items():
            self.assertEqual(
                len(values),
                1,
                f"{name} is declared {len(values)} times, expected exactly one. "
                "The comparison below is only meaningful while each side has "
                "a single declaration.",
            )

    def test_status_colours_match_assay(self) -> None:
        for site_name, assay_name in STATUS_PAIRS:
            with self.subTest(token=site_name):
                site = declared_values(self.tokens, (site_name,))[site_name]
                assay = declared_values(self.assay, (assay_name,))[assay_name]
                self.assertEqual(
                    site[0].lower(),
                    assay[0].lower(),
                    f"{site_name} in {TOKEN_FILE_NAME} and {assay_name} in "
                    f"{ASSAY_PAGE.relative_to(REPOSITORY)} have diverged. These "
                    "three values are shared by both products by decision: "
                    "change both sides or neither.",
                )

    def test_a_change_on_either_side_is_caught(self) -> None:
        """Probe the comparison from both directions."""
        for site_name, assay_name in STATUS_PAIRS[:1]:
            moved_site = self.tokens.replace(
                f"{site_name}: #356b46", f"{site_name}: #356b47"
            )
            self.assertNotEqual(moved_site, self.tokens, "probe planted nothing")
            self.assertNotEqual(
                declared_values(moved_site, (site_name,))[site_name][0].lower(),
                declared_values(self.assay, (assay_name,))[assay_name][0].lower(),
            )
            moved_assay = self.assay.replace(
                f"{assay_name}:#356b46", f"{assay_name}:#356b47"
            )
            self.assertNotEqual(moved_assay, self.assay, "probe planted nothing")
            self.assertNotEqual(
                declared_values(self.tokens, (site_name,))[site_name][0].lower(),
                declared_values(moved_assay, (assay_name,))[assay_name][0].lower(),
            )


if __name__ == "__main__":
    unittest.main()
