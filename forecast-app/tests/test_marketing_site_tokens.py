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
from typing import NamedTuple


REPOSITORY = Path(__file__).parents[2]

# The token file is excluded BY NAME, never by pattern. It is the one file
# that is supposed to hold raw colour values; a pattern such as "*.css" would
# silently exempt any stylesheet added later.
TOKEN_FILE_NAME = "tokens.css"

# The marketing pages, pinned. A fourth page failing this assertion is the
# intended behaviour and not a nuisance: see test_the_page_list_is_pinned.
EXPECTED_PAGES = (
    "delivery.html",
    "forecast-risk.html",
    "forecastability.html",
    "index.html",
    "privacy.html",
)

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
        self.assertEqual(len(pages), len(EXPECTED_PAGES))
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


# Type. Every size on the three pages comes from a token, the same way every
# colour does. There is no allowance file and there will not be one: an
# allowance file is where a scale goes to die, and this repository already
# holds that a control people learn to ignore is worse than no control.
#
# The scan reads the font shorthand as well as the longhand. That is not
# thoroughness for its own sake: the header link carried 15.5px inside
# "font: 600 15.5px/1.5 var(--font-body)" and a font-size scan reported the
# page clean. It is the same shape of miss as reading a hex and calling it a
# colour scan.
#
# What a legal value looks like: a var() reference, or one of the CSS-wide
# keywords, which carry no size of their own.
SIZE_KEYWORDS = frozenset({"inherit", "initial", "unset", "revert", "revert-layer"})
FONT_SIZE_DECL = re.compile(r"font-size\s*:\s*([^;}\"\']+)")
FONT_SHORTHAND = re.compile(r"(?<![-\w])font\s*:\s*([^;}\"\']+)")
VAR_REFERENCE = re.compile(r"var\(\s*--[A-Za-z0-9-]+\s*\)")
# A number carrying a length or percentage unit. Bare numbers are left alone
# because an unitless 1.4 in a shorthand is a line height, not a size.
# A var() pointing at nothing. This is the defect class the site could not
# catch until 17 September 2026, and the reason it needs a test rather than a
# note is the failure mode: an undefined custom property makes the whole
# declaration invalid at computed-value time. Not a console error, not a
# fallback to something sensible, and nothing in the diff to see. The
# declaration simply does not happen and the page renders as though it was
# never written. --space-1 through --space-4 sat in index.html and nowhere
# else for two weeks, so any other page naming var(--space-4) would have got
# silence. It never bit, which is luck rather than a control.
#
# Comments are stripped before the declaration scan so prose naming a token
# cannot be mistaken for declaring one.
CSS_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
CUSTOM_PROPERTY_DECL = re.compile(r"(--[A-Za-z0-9_-]+)\s*:")
# The character after the name says whether a fallback follows.
VAR_USE = re.compile(r"var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])")
STYLESHEET_LINK = re.compile(
    r"""<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']"""
)
# The other door. A canvas cannot use var(), so forecast-risk.html reads its
# chart colours by naming them as strings and asking getComputedStyle for the
# value. Rename one of those tokens and getPropertyValue returns an empty
# string: the chart paints with nothing, silently, exactly as an undefined
# var() does. Same defect, same silence, and a var() scan cannot see it.
SCRIPT_BLOCK = re.compile(r"<script[^>]*>(.*?)</script>", re.DOTALL)
SCRIPTED_PROPERTY = re.compile(r"""['"](--[A-Za-z0-9_-]+)['"]""")


def without_comments(text: str) -> str:
    return HTML_COMMENT.sub(" ", CSS_COMMENT.sub(" ", text))


def declared_custom_properties(page: Path) -> tuple[set[str], list[str]]:
    """Every custom property the page could see, and the chain it came from.

    The chain is read out of the page's own <link> tags rather than assumed to
    be tokens.css, because the point of this control is to follow what the
    page actually loads.
    """
    text = page.read_text(encoding="utf-8")
    chain = [page.name]
    declared = set(CUSTOM_PROPERTY_DECL.findall(without_comments(text)))
    for href in STYLESHEET_LINK.findall(text):
        if "://" in href:
            continue  # off-origin, and no page here loads one
        sheet = REPOSITORY / href.lstrip("/")
        if sheet.is_file():
            chain.append(href)
            declared |= set(
                CUSTOM_PROPERTY_DECL.findall(
                    without_comments(sheet.read_text(encoding="utf-8"))
                )
            )
    return declared, chain


def used_custom_properties(text: str) -> set[str]:
    """Every var() reference with no fallback.

    A var() carrying a fallback is not a finding: an undeclared name there
    resolves to the fallback, which is the defined behaviour rather than a
    silent failure. No page uses that form today; the exclusion is probed
    below so it is not untested logic.
    """
    return {
        name
        for name, following in VAR_USE.findall(text)
        if following == ")"
    }


def scripted_custom_properties(text: str) -> set[str]:
    """Every custom property named as a string literal inside a <script>."""
    found: set[str] = set()
    for block in SCRIPT_BLOCK.findall(text):
        found |= set(SCRIPTED_PROPERTY.findall(block))
    return found


class MarketingSiteVariablesResolve(unittest.TestCase):
    """No page may name a custom property nothing in its chain declares.

    Three limits, stated rather than left to be discovered.

    It is a static scan, so a declaration inside a media query counts as
    declared even though it only applies at some widths. Catching that needs
    a browser and the failure it would catch is a different one.

    It reads both doors since 17 September 2026. `var()` in CSS and inline
    styles, and custom properties named as string literals inside a <script>,
    which is how `forecast-risk.html` paints its chart because a canvas cannot
    use var(). Both are held against the same declared set.

    It does not strip JavaScript comments, so a commented-out token read still
    counts as a read. That produces a loud failure rather than a silent one,
    which is the right way round for a control to be wrong, and stripping
    comments from JavaScript reliably is more machinery than the risk earns.

    It proves a name is declared somewhere in the chain, not that the value is
    sensible. A token declared as garbage still passes.
    """

    def test_no_page_uses_an_undeclared_var(self) -> None:
        for page in marketing_pages():
            declared, chain = declared_custom_properties(page)
            used = used_custom_properties(page.read_text(encoding="utf-8"))
            missing = sorted(used - declared)
            self.assertEqual(
                missing,
                [],
                f"{page.name} uses {missing} and nothing in its chain "
                f"({', '.join(chain)}) declares them. An undefined custom "
                "property makes the whole declaration invalid at "
                "computed-value time: it fails silently, with no console "
                "error, and the page renders as though the line was never "
                "written.",
            )

    def test_no_page_reads_an_undeclared_token_from_script(self) -> None:
        """The door a var() scan cannot see.

        forecast-risk.html names seven tokens as strings to paint its chart.
        getPropertyValue on a name nothing declares returns an empty string,
        so the chart draws with nothing and reports no error.
        """
        for page in marketing_pages():
            declared, chain = declared_custom_properties(page)
            read = scripted_custom_properties(page.read_text(encoding="utf-8"))
            missing = sorted(read - declared)
            self.assertEqual(
                missing,
                [],
                f"{page.name} reads {missing} from script and nothing in its "
                f"chain ({', '.join(chain)}) declares them. "
                "getPropertyValue returns an empty string for a name that does "
                "not exist, so whatever it paints is painted with nothing and "
                "no error is raised.",
            )

    def test_the_script_scan_finds_the_chart_tokens(self) -> None:
        """Anti-vacuous: the seven are real and the scan sees them."""
        chart = REPOSITORY / "forecast-risk.html"
        read = scripted_custom_properties(chart.read_text(encoding="utf-8"))
        self.assertEqual(len(read), 7, f"Expected seven, found {sorted(read)}")
        self.assertIn("--color-chart-series", read)

    def test_a_renamed_chart_token_is_caught(self) -> None:
        """Probe the comparison, on the shape a rename actually takes."""
        declared = {"--color-chart-grid", "--color-text"}
        read = {"--color-chart-grid", "--color-chart-series"}
        self.assertEqual(sorted(read - declared), ["--color-chart-series"])

    def test_a_planted_undeclared_var_is_caught(self) -> None:
        """The shape the story was written about."""
        planted = ".a { padding: var(--space-4); }"
        self.assertEqual(used_custom_properties(planted), {"--space-4"})
        self.assertNotIn("--space-4", set())

    def test_a_var_with_a_fallback_is_not_a_finding(self) -> None:
        """Probe the exclusion, so it is not untested logic."""
        self.assertEqual(used_custom_properties(".a { gap: var(--nope, 8px); }"), set())
        self.assertEqual(used_custom_properties(".a { gap: var(--yes); }"), {"--yes"})

    def test_a_token_named_only_in_a_comment_does_not_count_as_declared(self) -> None:
        """Prose about a token is not a declaration of it."""
        self.assertEqual(
            set(CUSTOM_PROPERTY_DECL.findall(without_comments("/* --ghost: 4px; */"))),
            set(),
        )
        self.assertEqual(
            set(CUSTOM_PROPERTY_DECL.findall(without_comments(":root{--real:4px}"))),
            {"--real"},
        )

    def test_every_page_reaches_the_token_file_through_its_own_link(self) -> None:
        """The chain is followed, not assumed."""
        for page in marketing_pages():
            _, chain = declared_custom_properties(page)
            self.assertIn(
                TOKEN_FILE_NAME,
                chain,
                f"{page.name} does not link {TOKEN_FILE_NAME}, so every token "
                "it names resolves to nothing.",
            )

    def test_the_scan_finds_the_variables_the_site_actually_uses(self) -> None:
        """A scan that passes because it read nothing is not a pass."""
        total = set()
        for page in marketing_pages():
            total |= used_custom_properties(page.read_text(encoding="utf-8"))
        self.assertGreater(len(total), 15, f"Only found {sorted(total)}")


# One loudest element per page. See the note beside the steps in tokens.css.
POSTER_USE = re.compile(r"var\(\s*--text-poster\s*\)")
SIZED_NUMBER = re.compile(r"\d*\.?\d+\s*(?:px|pt|pc|em|rem|ex|ch|cap|vw|vh|vmin|vmax|%)\b")


def raw_type_sizes(text: str) -> list[tuple[str, str]]:
    """Return (where, value) for every size on a page not read from a token."""
    found: list[tuple[str, str]] = []
    for value in FONT_SIZE_DECL.findall(text):
        stripped = value.strip()
        if stripped.lower() in SIZE_KEYWORDS:
            continue
        if VAR_REFERENCE.fullmatch(stripped):
            continue
        found.append(("font-size", stripped))
    for value in FONT_SHORTHAND.findall(text):
        stripped = value.strip()
        if stripped.lower() in SIZE_KEYWORDS:
            continue
        # Remove what the tokens supply, then look at what is left by hand.
        remainder = VAR_REFERENCE.sub(" ", stripped)
        if SIZED_NUMBER.search(remainder):
            found.append(("font shorthand", stripped))
    return found


class MarketingSiteTypeScale(unittest.TestCase):
    """Every size comes from tokens.css, as every colour does.

    Enforced only once the rollout was complete, which the design session set
    as the condition: a control firing on two thirds of a migration is one
    people learn to step around. The wordmark is not an exception to this. It
    sits outside the scale in its own token, --wordmark-size, so the rule
    stays absolute and there is nothing to permit.
    """

    def test_no_page_carries_a_hand_written_size(self) -> None:
        for page in marketing_pages():
            findings = raw_type_sizes(page.read_text(encoding="utf-8"))
            self.assertEqual(
                findings,
                [],
                f"{page.name} sets type at a hand-written size. Every size on "
                f"the marketing site comes from a step in {TOKEN_FILE_NAME}. If "
                "no step fits, that is a decision for the design session, not "
                "a value typed into a page. Findings: " + str(findings),
            )

    def test_a_page_spends_poster_at_most_once(self) -> None:
        """One loudest moment per page, and poster is what marks it.

        Settled by the design session on 7 September 2026. Not once per site,
        which makes the step unusable as soon as a fourth page exists and
        turns a scale step into one element's private size. Not once per
        closing panel, which welds a size to a component: the homepage's
        loudest element is its closing line, forecastability.html's was the
        92.5% numeral, and both were correct under the same rule. That
        numeral was removed on 26 September 2026 with the M5 figure, and
        forecastability.html now spends none.

        What this counts is declarations, not rendered elements. One
        declaration matching several elements would pass, and on index.html
        that is the right answer rather than a gap: the closing line is one
        heading set in two spans, which is one loud moment. A page may spend
        none, as privacy.html does. Two elements competing for poster is a
        copy problem and no test can see it.
        """
        for page in marketing_pages():
            uses = len(POSTER_USE.findall(page.read_text(encoding="utf-8")))
            self.assertLessEqual(
                uses,
                1,
                f"{page.name} spends the poster step {uses} times. A page gets "
                "one loudest element. If two are competing for it, the page "
                "has two climaxes and the copy is what needs fixing.",
            )

    def test_the_poster_count_catches_a_second_use(self) -> None:
        """Probe it, on the shape that would actually appear."""
        planted = (
            "h1 { font-size: var(--text-poster); }"
            ".close h2 { font-size: var(--text-poster); }"
        )
        self.assertEqual(len(POSTER_USE.findall(planted)), 2)

    def test_the_token_file_defines_every_step(self) -> None:
        tokens = (REPOSITORY / TOKEN_FILE_NAME).read_text(encoding="utf-8")
        for step in (
            "--text-poster", "--text-display", "--text-title", "--text-subhead",
            "--text-lead", "--text-body", "--text-label", "--wordmark-size",
        ):
            with self.subTest(step=step):
                self.assertIn(f"{step}:", tokens)

    def test_a_planted_longhand_size_is_caught(self) -> None:
        planted = "h1 { font-size: 42px; }"
        self.assertEqual(raw_type_sizes(planted), [("font-size", "42px")])

    def test_a_size_hidden_in_the_font_shorthand_is_caught(self) -> None:
        """The miss that made this scan read the shorthand at all."""
        planted = "a { font: 600 15.5px/1.5 var(--font-body); }"
        self.assertEqual(
            raw_type_sizes(planted), [("font shorthand", "600 15.5px/1.5 var(--font-body)")]
        )

    def test_the_token_forms_are_not_findings(self) -> None:
        legal = (
            "h1 { font-size: var(--text-display); }"
            "p { font-size: var(--text-body); }"
            "button { font: inherit; }"
            "b { font: 800 var(--text-lead)/1.4 var(--font-heading); }"
        )
        self.assertEqual(raw_type_sizes(legal), [])

    def test_the_scan_reads_the_pages_and_not_nothing(self) -> None:
        total = sum(
            len(FONT_SIZE_DECL.findall(page.read_text(encoding="utf-8")))
            for page in marketing_pages()
        )
        self.assertGreater(
            total, 20, "The pages declare fewer sizes than the site has roles."
        )


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


# ---------------------------------------------------------------------------
# Zero radius on the marketing site.
# ---------------------------------------------------------------------------
# CLAUDE.md section 9 has said "zero radius everywhere" since the design
# system was written down, and section 9a records that on this site nothing
# ever enforced it: the test named against the rule only ever read the Assay
# page. This is the scan that was missing, and it is the site's first, so it
# was written expecting to find something.
#
# It found nothing beyond the approved badges. That result is reported
# rather than assumed: see test_the_scan_finds_all_three_approved_badges,
# which fails if the scan stops finding them, because a radius scan that
# reads nothing reports nothing and passes.
#
# ALLOWED BY SELECTOR, NEVER BY VALUE. The badges are the documented
# exception, ruled by the product owner on 16 September 2026. A scan that
# waved through 50% because 50% is what a badge uses would wave through the
# next element somebody rounds, which is the whole reason the rule exists.
#
# Four selectors, six elements. The homepage rule and the delivery page rule
# each dress both an email badge and a LinkedIn badge, so the rendered count is
# two on each of those and one each on the other two pages. CLAUDE.md 9a counts
# rules rather than elements. Recorded here because the two counts disagree and
# the next reader should not have to rediscover which is meant.
#
# delivery.html joined on 18 September 2026, when the product owner ruled that
# the delivery page reuses the homepage's closing field. It was three selectors
# and four elements before that.
APPROVED_ROUND_SELECTORS: frozenset = frozenset({
    ("index.html", ".close .contact-badge"),
    ("delivery.html", ".close .contact-badge"),
    ("forecast-risk.html", ".close .contact-badge"),
    ("forecastability.html", ".mail-badge"),
})

STYLE_BLOCK = re.compile(r"<style[^>]*>(.*?)</style>", re.DOTALL)
# A rule is a prelude and a body with no braces in either. Applied to nested
# CSS this matches the INNER rule and skips the @media wrapper, because the
# wrapper's body contains braces. That is the behaviour wanted: a radius
# inside a media query is attributed to the selector that carries it.
CSS_RULE = re.compile(r"([^{}]+)\{([^{}]*)\}", re.DOTALL)
INLINE_STYLE = re.compile(
    r"""<([a-zA-Z][\w-]*)[^>]*\sstyle=["']([^"']*)["']"""
)
# Longhands and vendor prefixes included. A scan for "border-radius" alone
# misses border-top-left-radius, which rounds one corner just as visibly.
RADIUS_DECL = re.compile(
    r"(?<![-\w])"
    r"((?:-(?:webkit|moz|ms|o)-)?border(?:-(?:top|bottom)-(?:left|right))?-radius)"
    r"\s*:\s*([^;}]+)",
    re.IGNORECASE,
)
# The script door, the same one the token scan above had to close. Nothing on
# the site sets a radius from JavaScript today, so any hit at all is a
# finding rather than a value to classify.
SCRIPTED_RADIUS = re.compile(
    r"[Bb]order[A-Za-z]*Radius"
    r"|['\"]border(?:-(?:top|bottom)-(?:left|right))?-radius['\"]"
)
CUSTOM_PROPERTY_VALUE = re.compile(r"(--[A-Za-z0-9_-]+)\s*:\s*([^;}]+)")
VAR_CALL = re.compile(r"var\(\s*(--[A-Za-z0-9_-]+)\s*\)")
ZERO_COMPONENT = re.compile(r"^0(?:[a-z]+|%)?$", re.IGNORECASE)


class RadiusDeclaration(NamedTuple):
    page: str
    origin: str
    selector: str
    prop: str
    written: str
    resolved: str

    def describe(self) -> str:
        through = (
            f" resolving to {self.resolved}"
            if self.resolved != self.written
            else ""
        )
        return (
            f"{self.page}: {self.selector} {{ {self.prop}: {self.written} }}"
            f"{through}, in {self.origin}"
        )


def css_sources(page: Path) -> list:
    """Every stylesheet the page can see, with where each came from.

    The chain is read out of the page's own <link> tags, the same way the
    custom property scan above reads it, rather than assuming tokens.css.
    """
    text = without_comments(page.read_text(encoding="utf-8"))
    sources = [(page.name, "\n".join(STYLE_BLOCK.findall(text)))]
    for href in STYLESHEET_LINK.findall(text):
        if "://" in href:
            continue  # off-origin, and no page here loads one
        sheet = REPOSITORY / href.lstrip("/")
        if sheet.is_file():
            sources.append((href, without_comments(sheet.read_text(encoding="utf-8"))))
    return sources


def css_rules(css: str) -> list:
    """(selector, body) for every rule, whitespace in the selector collapsed."""
    return [
        (" ".join(selector.split()), body)
        for selector, body in CSS_RULE.findall(css)
    ]


def declared_custom_property_values(page: Path) -> dict:
    """Every custom property the page can see, name to the set of its values.

    A set rather than a value because a name declared twice with different
    values cannot be resolved to one thing. Those are left unresolved on
    purpose, so they fail the zero test loudly instead of being guessed at.
    """
    values: dict = {}
    for _, css in css_sources(page):
        for name, value in CUSTOM_PROPERTY_VALUE.findall(css):
            values.setdefault(name, set()).add(value.strip())
    return values


def resolve_value(value: str, properties: dict) -> str:
    """Substitute var(--name) with its declared value, a few levels deep.

    index.html writes `border-radius: var(--radius-md)` and declares
    --radius-md as 0px, so the rendered radius is zero and the declaration is
    not a finding. A scan reading the literal text would have called that a
    fourth rounded element and sent the product owner after a defect that is
    not there.

    A name with no declaration, with more than one distinct declaration, or
    written with a fallback is left exactly as it stands. It then fails the
    zero test with the unresolved text in the message, which is the right way
    round: a radius nobody can resolve is a finding, not a pass.
    """
    for _ in range(4):
        replaced = False

        def swap(match):
            nonlocal replaced
            candidates = properties.get(match.group(1), set())
            if len(candidates) != 1:
                return match.group(0)
            replaced = True
            return next(iter(candidates))

        value = VAR_CALL.sub(swap, value)
        if not replaced:
            break
    return value.strip()


def is_zero_radius(value: str) -> bool:
    """True only when every component of the value is a zero length.

    `0`, `0px`, `0 0 0 0` and `0px / 0px` are zero. `50%` is not. Anything
    this cannot read as a list of zeroes, calc() included, is reported rather
    than waved through.
    """
    parts = value.replace("/", " ").split()
    return bool(parts) and all(ZERO_COMPONENT.match(part) for part in parts)


def radius_declarations(page: Path) -> list:
    """Every radius this page declares, from its chain and from its markup."""
    properties = declared_custom_property_values(page)
    found = []
    for origin, css in css_sources(page):
        for selector, body in css_rules(css):
            for prop, written in RADIUS_DECL.findall(body):
                found.append(RadiusDeclaration(
                    page.name, origin, selector, prop,
                    written.strip(), resolve_value(written, properties),
                ))
    # An inline style has no selector, so it can never be on the approved
    # list. That is correct rather than awkward: the exception is three named
    # rules, and a radius written onto an element is exactly the accidental
    # pill this control exists to catch.
    markup = without_comments(page.read_text(encoding="utf-8"))
    for tag, style in INLINE_STYLE.findall(markup):
        for prop, written in RADIUS_DECL.findall(style):
            found.append(RadiusDeclaration(
                page.name, page.name, f"inline style on <{tag}>", prop,
                written.strip(), resolve_value(written, properties),
            ))
    return found


def non_zero_radius_selectors(page: Path) -> set:
    return {
        (declaration.page, declaration.selector)
        for declaration in radius_declarations(page)
        if not is_zero_radius(declaration.resolved)
    }


class MarketingSiteKeepsZeroRadius(unittest.TestCase):
    """Nothing on the five site pages is rounded but the four badge rules.

    Section 9 of CLAUDE.md draws structure with 2px rules and hard edges and
    calls zero radius the single biggest difference from a generic dashboard.
    Section 9a records that Assay is now a documented exception to it and
    that the site is not, and hands this scan to the site session.

    Four limits, stated rather than left to be found.

    It reads declarations, not rendered elements. A rule that never matches
    anything still counts, which errs towards reporting.

    It does not resolve the cascade, so it cannot tell that one rounded
    declaration is overridden by a later square one. Again it reports.

    **A radius arriving from a browser default rather than from a declaration
    is invisible to this scan.** It reads no user agent stylesheet, so a form
    control the browser rounds for you is not something it can report.

    That limit is accepted rather than worked around. Ruled static by the
    product owner on 17 September 2026, closing Q2: a rendered scan would put
    a browser in the test environment to catch a defect that enters when
    somebody writes a declaration, which is the thing a declaration scan
    already reads.

    It is also the reason `forecast-risk.html` sets an explicit
    `border-radius: 0` on `select` and on `.btn`. A form control takes its
    radius from the browser's own stylesheet, and those two zeroes are what
    overrule it. Headless Chromium found no user agent radius anywhere on the
    site when this was built, and that is why. **They look redundant on a site
    that is square by default and they are load bearing. Do not tidy them
    away.** If they were ever deleted this scan would see the deletion, which
    is the half of the problem it can cover.

    It reads the five pages and their linked stylesheets. An SVG with round
    corners drawn into its own geometry is not a CSS radius and is not in
    scope here.
    """

    def test_no_page_carries_a_non_zero_radius(self) -> None:
        offenders = []
        for page in marketing_pages():
            for declaration in radius_declarations(page):
                if is_zero_radius(declaration.resolved):
                    continue
                if (declaration.page, declaration.selector) in APPROVED_ROUND_SELECTORS:
                    continue
                offenders.append(declaration.describe())
        self.assertEqual(
            offenders, [],
            "The site is zero radius apart from the four approved contact "
            "badges, which are allowed by selector and not by value. Found: "
            + "; ".join(offenders)
            + ". If this is a decision rather than an accident it belongs in "
            "CLAUDE.md section 9 as a named exception, and in this list by "
            "selector, before the test is changed.",
        )

    def test_the_scan_reads_every_page_and_its_chain(self) -> None:
        """Anti-vacuous, part one: prove it read something on each page.

        A scan that parses nothing finds nothing and passes. That has already
        happened once on this project, when an Assay badge check returned
        zero readings across eight tabs and was read as clean.

        The two anchors are structural rather than a count. Every page styles
        `body` in its own <style> block, and every page's chain reaches
        tokens.css, where `:root` carries the tokens. Break the rule parser
        and both disappear at once.

        A count floor was written first and thrown away. It would have had to
        sit under privacy.html at 16 rules, and a threshold chosen to clear
        the shortest page is tuned to pass rather than measured. The per-page
        counts are recorded in the evidence file, where a number belongs.
        """
        for page in marketing_pages():
            by_origin = {
                origin: {selector for selector, _ in css_rules(css)}
                for origin, css in css_sources(page)
            }
            self.assertIn(
                "tokens.css", by_origin,
                f"{page.name} did not resolve its stylesheet chain, so "
                "whatever this scan reported about it was read off half a "
                "page.",
            )
            self.assertIn(
                ":root", by_origin["tokens.css"],
                f"{page.name} reached tokens.css and parsed no :root out of "
                "it, so the rule parser is broken rather than the page clean.",
            )
            self.assertIn(
                "body", by_origin[page.name],
                f"{page.name} parsed no body rule out of its own <style>, so "
                "this scan did not read the page it reports on.",
            )

    def test_the_scan_finds_all_three_approved_badges(self) -> None:
        """Anti-vacuous, part two, and the one that matters.

        The exception list is not evidence that the badges are there. This
        holds the list against what the scan actually finds, so the list
        cannot quietly describe rules that no longer exist, and the scan
        cannot quietly stop reading.
        """
        found = set()
        for page in marketing_pages():
            found |= non_zero_radius_selectors(page)
        self.assertEqual(
            found, set(APPROVED_ROUND_SELECTORS),
            "The rounded elements the scan finds no longer match the "
            "approved badges. If a badge was removed, remove it from "
            "APPROVED_ROUND_SELECTORS in the same change; if something else "
            "is rounded, that is a finding for the product owner.",
        )

    def test_no_page_sets_a_radius_from_script(self) -> None:
        """The door the token scan above had to close separately."""
        for page in marketing_pages():
            text = page.read_text(encoding="utf-8")
            for block in SCRIPT_BLOCK.findall(text):
                self.assertIsNone(
                    SCRIPTED_RADIUS.search(block),
                    f"{page.name} sets a border radius from JavaScript. No "
                    "page did when this control was written, so there is no "
                    "approved form of it. A radius applied at runtime is "
                    "invisible to every static scan on this site.",
                )

    def test_a_planted_radius_is_caught(self) -> None:
        """Probe the classifier on the shape an accident actually takes."""
        self.assertTrue(is_zero_radius("0"))
        self.assertTrue(is_zero_radius("0px"))
        self.assertTrue(is_zero_radius("0 0 0 0"))
        self.assertFalse(is_zero_radius("4px"))
        self.assertFalse(is_zero_radius("50%"))
        self.assertFalse(is_zero_radius("0 0 0 3px"))
        self.assertFalse(is_zero_radius(""))

    def test_the_exception_is_by_name_and_not_by_value(self) -> None:
        """A pill is a pill wherever it lands.

        50% on an approved badge passes. The same value on anything else is a
        finding, which is the difference between allowing a selector and
        allowing a number.
        """
        self.assertIn(("index.html", ".close .contact-badge"), APPROVED_ROUND_SELECTORS)
        self.assertNotIn(("index.html", ".btn"), APPROVED_ROUND_SELECTORS)
        self.assertNotIn(("privacy.html", ".close .contact-badge"), APPROVED_ROUND_SELECTORS)

    def test_a_radius_written_through_a_token_is_read_through_it(self) -> None:
        """index.html's .btn is the case a literal scan would get wrong.

        It is written as var(--radius-md) and --radius-md is 0px, so it is
        square. Pinned because deleting the resolution step would turn a
        clean page into a false finding and send someone after nothing.
        """
        homepage = REPOSITORY / "index.html"
        values = declared_custom_property_values(homepage)
        self.assertEqual(values.get("--radius-md"), {"0px"})
        through_token = [
            declaration for declaration in radius_declarations(homepage)
            if "var(" in declaration.written
        ]
        self.assertTrue(through_token, "nothing on the homepage uses a token radius")
        for declaration in through_token:
            self.assertTrue(
                is_zero_radius(declaration.resolved),
                f"{declaration.describe()} did not resolve to zero",
            )

if __name__ == "__main__":
    unittest.main()
