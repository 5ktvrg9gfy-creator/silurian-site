"""Fail the build when a page loads Vercel Web Analytics without the opt-out.

Belongs to the marketing-site session, like test_marketing_site_tokens.py, and
lives in this directory for the same reason: this is the only suite anything
runs.

The privacy notice promises two things: a visitor can turn analytics off in
their browser with the button on privacy.html, and a Global Privacy Control
signal is treated as a request to turn it off. Both are kept by one check,
registered with window.va('beforeSend', ...) before Vercel's script loads, that
returns null when the browser holds va-disable or sends the signal. A page that
loads the script without that check breaks the promise on that page and shows
nothing wrong, because analytics just keeps working. That is what this pins.

Every page is scanned, Assay included, because "any page loading the script" is
the rule. Assay does not load it today, by the product owner's decision of 27
September 2026, so it passes by loading nothing. If it ever does load it, the
check applies there too.

The scan is textual. It proves the check is present and in the right place. It
does not run it; the browser run is in the pull request evidence.
"""

import re
import unittest
from pathlib import Path


REPOSITORY = Path(__file__).parents[2]
SCRIPT_PATH = "/_vercel/insights/script.js"

SCRIPT_TAG = re.compile(
    r"<script\b[^>]*\bsrc\s*=\s*[\"'][^\"']*" + re.escape(SCRIPT_PATH) + r"[\"'][^>]*>",
    re.IGNORECASE,
)
INLINE_SCRIPT = re.compile(r"<script\b(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>", re.IGNORECASE | re.DOTALL)
BEFORE_SEND = re.compile(r"\bva\(\s*[\"']beforeSend[\"']\s*,")


def pages() -> tuple[Path, ...]:
    """The five marketing pages from the filesystem, and the Assay page."""
    roots = sorted(REPOSITORY.glob("*.html"))
    return (*roots, REPOSITORY / "forecast-app" / "static" / "index.html")


def opt_out_problems(html: str) -> list[str]:
    """Why a page's analytics is not covered by the opt-out, if it loads any.

    For each tag loading the script, one inline script before it must register
    beforeSend, read va-disable, check navigator.globalPrivacyControl and
    return null. All four in one script, so the parts cannot be scattered
    across the page where no one of them does the job.
    """
    problems: list[str] = []
    for tag in SCRIPT_TAG.finditer(html):
        covered = False
        for inline in INLINE_SCRIPT.finditer(html[: tag.start()]):
            body = re.sub(r"/\*.*?\*/", "", inline.group(1), flags=re.DOTALL)
            if (
                BEFORE_SEND.search(body)
                and "va-disable" in body
                and "navigator.globalPrivacyControl" in body
                and re.search(r"\breturn\s+null\b", body)
            ):
                covered = True
        if not covered:
            problems.append(
                f"{tag.group(0)} loads with no beforeSend check for va-disable "
                "and navigator.globalPrivacyControl registered before it"
            )
    return problems


GOOD_SETUP = """<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  window.va('beforeSend', function (event) {
    if (navigator.globalPrivacyControl === true) return null;
    try { if (localStorage.getItem('va-disable')) return null; } catch (error) {}
    return event;
  });
</script>"""
TAG = f'<script defer src="{SCRIPT_PATH}"></script>'


class AnalyticsOptOut(unittest.TestCase):
    def test_every_page_loading_analytics_registers_the_opt_out_first(self) -> None:
        failures = {
            page.relative_to(REPOSITORY).as_posix(): problems
            for page in pages()
            if (problems := opt_out_problems(page.read_text(encoding="utf-8")))
        }
        self.assertEqual(
            failures,
            {},
            "A page loads Vercel Web Analytics without the opt-out the privacy "
            "notice promises. Register the va-disable and Global Privacy "
            "Control beforeSend check in an inline script before the tag.",
        )

    def test_the_scan_sees_the_five_marketing_pages_load_analytics(self) -> None:
        # Zero tags found would pass the test above on nothing.
        loading = sorted(
            page.name
            for page in pages()
            if SCRIPT_TAG.search(page.read_text(encoding="utf-8"))
            and page.parent == REPOSITORY
        )
        self.assertEqual(
            loading,
            ["delivery.html", "forecast-risk.html", "forecastability.html", "index.html", "privacy.html"],
        )

    def test_a_covered_page_is_not_a_finding(self) -> None:
        self.assertEqual(opt_out_problems(GOOD_SETUP + TAG), [])

    def test_a_missing_check_is_caught(self) -> None:
        bare = """<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>"""
        self.assertEqual(len(opt_out_problems(bare + TAG)), 1)

    def test_a_check_after_the_script_tag_is_caught(self) -> None:
        self.assertEqual(len(opt_out_problems(TAG + GOOD_SETUP)), 1)

    def test_a_check_without_global_privacy_control_is_caught(self) -> None:
        planted = GOOD_SETUP.replace("navigator.globalPrivacyControl === true", "false")
        self.assertEqual(len(opt_out_problems(planted + TAG)), 1)

    def test_a_check_without_va_disable_is_caught(self) -> None:
        planted = GOOD_SETUP.replace("va-disable", "something-else")
        self.assertEqual(len(opt_out_problems(planted + TAG)), 1)

    def test_a_check_left_only_in_a_comment_is_caught(self) -> None:
        planted = GOOD_SETUP.replace("window.va('beforeSend'", "/* window.va('beforeSend' */ window.va('other'")
        self.assertEqual(len(opt_out_problems(planted + TAG)), 1)

    def test_each_tag_is_judged_by_what_comes_before_it(self) -> None:
        self.assertEqual(len(opt_out_problems(GOOD_SETUP + TAG + TAG)), 0)
        self.assertEqual(len(opt_out_problems(TAG + GOOD_SETUP + TAG)), 1)


if __name__ == "__main__":
    unittest.main()
