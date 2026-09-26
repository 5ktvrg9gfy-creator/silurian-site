# Evidence: mapped changes to forecastability.html, 26 September 2026

Brief: "Assay: mapped changes to forecastability.html", dated 26 September 2026, supplied by the product owner. Built from `main` at `4f5bb1e` on `claude/sharp-einstein-tiwbz3`.

## What changed

- `forecastability.html`: title, meta description and page body replaced with the brief's section 4 and 5 copy, in the section 6 order. The shared masthead, navigation, footer, privacy link, tokens and contact address are unchanged. Page-local rules for the removed sections (intro figure, stat numeral, comparison flow, familiar row, callback, argument columns, pullout, "What you get" list, bridge, volume bar, legend, arrow link) are deleted.
- `forecast-app/tests/test_marketing_site_tokens.py`: one docstring updated, because it named the 92.5% numeral as this page's poster element. No assertion changed.

The page had no social title or description metadata, so there was nothing to align.

## Repository notes applied

1. The email badge keeps the class `.mail-badge`, so the radius scan's approved selector still matches.
2. The 92.5% numeral was the page's only poster use. It is removed and nothing replaces it. `test_a_page_spends_poster_at_most_once` allows zero.
3. The demonstration link does not use `.arrow-link`, which set `white-space: nowrap`. That rule is deleted, and the link computes `white-space: normal`.

## Deviations from the mapping

- The closing field's old kicker, "Next", is removed. The brief says no additional kicker is required, and the heading now opens the field.
- The `text-wrap: balance` on the closing heading is removed along with its comment. The new heading is three words on one line, so there is nothing to balance.

## Checks run, all local

- Suite: `python -m unittest discover -s tests` from `forecast-app/`. 294 tests before the change and 294 after, all passing. To run the full suite in this container, `requirements.txt` had to be installed and the system `cryptography` package replaced by a pip copy, because the Debian copy panics on import.
- Dash scan of the page source: zero em dashes, zero en dashes and zero spaced hyphens.
- Rendered in headless Chromium 1194 from the local file at 1440, 768, 375 and 320px wide:
  - The title and description match section 5 exactly.
  - Rendered text contains neither "92.5" nor "M5". Both strings appear only in a CSS comment, which is not rendered.
  - Headings: one H1, then H2s in the section 6 order, with H3s under the findings and the steps.
  - `scrollWidth` equals `clientWidth` at every width, so there is no horizontal overflow.
  - The demonstration link is one line at 1440 and 768px and wraps to two lines at 375 and 320px.
  - The four findings sit in two columns at 1440px and stack 1, 2, 3, 4 at 768px and below.
  - Seven links, all with the expected destinations: index.html twice, delivery.html, forecastability.html, forecast-risk.html, the mailto address and privacy.html.
  - Radius read through `getComputedStyle` on every element: 86 elements and 1 rounded, the `.mail-badge`. `CLAUDE.md` section 9a's dated count of 174 elements on this page was measured on the old body and is not edited here.

## Not run

- Archivo did not load in the local render because this environment is offline, so the screenshots use a fallback face. The layout was checked, but final typography was not.
- No Vercel Preview or Production check was run by this session. Linked destinations were checked for correct `href` values, not fetched live.

## Still open, not touched

Section 7 of the brief lists issues this change does not solve. They stay open: permanent forecasting claims in the app, routing not controlling what is forecast, fixed-percentage bands described as uncertainty, the inactive-product zero-history issue, missing portfolio exports and cross-run comparison, client-data handling and provider verification, and the demonstration page's own introduction.
