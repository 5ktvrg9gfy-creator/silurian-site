# Evidence: the forecastability nav label becomes "Silurian Assay", 21 September 2026

The changeset of 21 September 2026, applied alone as it instructs. One label
on four pages, the four breakpoint comments that named the old string, and the
breakpoint itself remeasured once at the end.

Rendered checks in headless Chromium 1194 against a local static server on the
repository's own files, so the Archivo variable font was loaded and awaited
before anything was measured. Every figure below is read through
`getComputedStyle` or `getBoundingClientRect`, not from the source.

Before the pass began, the four changesets the handoff names as already live
were confirmed present on `main` at `82d9988`, by reading the file rather than
by trusting the note: the wordmark reads "Silurian PM" on all four pages,
`delivery.html` exists and carries the shared lockup, and the shared
`.mast-nav` carries two `.forecast-link` items, the `.mast-rule` hairline and
`aria-label="Services"`. None of the four was applied again.

---

## What changed

The second nav link's text, in the `.mast-nav` of every page carrying the
shared lockup:

```
was   <a class="forecast-link" href="forecastability.html">AI Forecast Diagnostic</a>
now   <a class="forecast-link" href="forecastability.html">Silurian Assay</a>
```

On `index.html`, `delivery.html`, `forecastability.html` and
`forecast-risk.html`. Same element, same class, same href, same
`aria-current` behaviour, same hairline, same centring. The lockup is
untouched and still reads "Silurian PM" with the "Project & Programme
Delivery" subline on all four. No lockup says "Silurian Assay".

**The breakpoint moved from 712px to 648px** on all four pages, and each
page's comment was corrected in the same pass: the value, the prose and the
string it names. A comment that names a string its page no longer renders is
how the last masthead drift started, so the old string appears nowhere in the
four files.

## Method

The method the existing comment names, run as written.

Temporary copies of all four pages with the masthead wrap query neutralised,
so the desktop lockup could be measured at every width. Only that query was
moved: the pages carry other media queries at 560px, 720px, 850px and 860px
and those were left alone, and the substitution asserts it matched exactly one
rule per page rather than trusting a pattern.

Viewport stepped 1300px down to 300px in 1px steps. At each step the fonts
were already loaded, awaited through `document.fonts.ready` and then confirmed
through `document.fonts.check('800 24px Archivo')`, because a sweep measured
before the font arrives measures the fallback.

Failure is the two nav links ceasing to sit on one line, measured by comparing
the two links' client rect tops.

## Result, after the change

**All four pages fail at 648px and hold at 649px. 1001 observations per page**,
which is the count and not a claim: a scan that reports nothing because it read
nothing is not a pass.

```
page                   first fail   last hold   observations   labels read
index.html                  648px       649px           1001   Project Management | Silurian Assay
delivery.html               648px       649px           1001   Project Management | Silurian Assay
forecastability.html        648px       649px           1001   Project Management | Silurian Assay
forecast-risk.html          648px       649px           1001   Project Management | Silurian Assay
```

The labels column is read from the rendered DOM at every step, not asserted, so
the sweep also proves it measured the pages it reports on.

## Control, against the pages before the change

The same sweep, unchanged, against the four pages as they stood on
`origin/main` at `82d9988`:

```
page                   first fail   last hold   observations   labels read
index.html                  712px       713px           1001   Project Management | AI Forecast Diagnostic
delivery.html               712px       713px           1001   Project Management | AI Forecast Diagnostic
forecastability.html        712px       713px           1001   Project Management | AI Forecast Diagnostic
forecast-risk.html          712px       713px           1001   Project Management | AI Forecast Diagnostic
```

It reproduces the recorded 712px exactly, on all four pages. **That is what
says the 64px is the string and not the harness.** A new number measured by a
new rig is a number and an assumption; the same rig returning the old number on
the old pages removes the assumption.

**Why it came down.** The second label is eight characters shorter than the one
it replaced, so the pair stops fitting at a narrower width. Nothing about the
spacing changed in this pass.

## Every check in "Verify before finishing"

| Check | Result |
| --- | --- |
| All four navs read "Project Management" and "Silurian Assay", with the hairline between them | Pass. Read from the rendered DOM at 1440px on all four. Hairline `1px solid rgb(63, 61, 59)`, padding equal to the nav gap at every width above the breakpoint |
| All four lockups still read "Silurian PM" with the subline unchanged | Pass. `Silurian PM` and `Project & Programme Delivery` on all four |
| "AI Forecast Diagnostic" appears nowhere in the four pages' rendered output, and nowhere in their style-block comments | Pass. Zero occurrences in `document.body.innerText`, in `<title>` and in `<meta name="description">` on all four, and zero in the source of all four files |
| The nav still wraps to its own row below the breakpoint, and the hairline still disappears when it does | Pass. `grid-column: 1 / -1` and `.mast-rule: none` first at 648px on all four, with the hairline at `0px none` and `padding-left: 0` |
| The breakpoint value in each page agrees with what was measured, and the comment records the remeasure and its date | Pass. `@media (max-width: 648px)` on all four. Each comment states 648px, the 1001 observations, the control run and "Remeasured on 21 September 2026" |
| Zero radius everywhere except the existing contact badges | Pass. 8 radius declarations read across the five site pages, 4 of them non-zero, and those 4 are exactly the approved selectors |

Read at ten widths on each page: 1440, 1090, 900, 720, 650, 649, 648, 560, 420
and 320.

**The radius scan's counts**, recorded because a check that reports zero
observations has not passed, it has not run:

```
page                   radius declarations read   non-zero   selector
index.html                                    2          1   .close .contact-badge
delivery.html                                 2          1   .close .contact-badge
forecastability.html                          1          1   .mail-badge
forecast-risk.html                            3          1   .close .contact-badge
privacy.html                                  0          0   none
```

Four non-zero declarations, matching `APPROVED_ROUND_SELECTORS` exactly.

**What did not change, confirmed rather than assumed.** `aria-label="Services"`
on all four navs. `aria-current="location"` on the delivery link on
`delivery.html` and on the forecastability link on `forecastability.html`, and
on neither link on `index.html` or `forecast-risk.html`. The "Home" back link
on the three pages that carry one. Every `<title>` and every
`<meta name="description">`, which carry the registered company name and are
not nav copy.

**One measured difference worth recording.** At 320px the two labels now sit on
one line, where the longer label wrapped to two. The nav is still on its own
row and the hairline is still gone, so the rule the breakpoint exists to
protect holds. The shorter string simply fits where the longer one did not.

## Tests

The suite at `forecast-app/`, run with
`python -m unittest discover -s tests`: **294 tests before the change and 294
after, all passing.** `MarketingSiteKeepsZeroRadius` is green including both
of its anti-vacuous tests, `test_the_scan_reads_every_page_and_its_chain` and
`test_the_scan_finds_all_three_approved_badges`. `MarketingSiteTokens`,
`MarketingSiteVariablesResolve`, `MarketingSiteTypeScale` and
`StatusColoursMatchAssay` are green.

No test in the repository asserts the string "AI Forecast Diagnostic". Searched
case-insensitively across all 24 test modules, the fixtures, the expectation
files and `CLAUDE.md` before anything was edited, and it returns nothing.

**An environment note, not a repository fault.** The container's system
`fastapi` is a broken mixed install, and 8 test modules fail to import against
it on unmodified `main` as well as here. The suite was run in a clean
virtualenv built from `forecast-app/requirements.txt`, where all 294 tests
collect and pass. Anyone reproducing this on the same container image should
expect to do the same.

## What did not run

The branch `claude/upbeat-volta-vjn5wd` is pushed, at `08e0719`.

**The Vercel Preview check has not run.** Whether a Preview builds at all for a
branch other than `main` depends on the Vercel project settings, and those are
not verified here, so this record does not say a Preview exists.

**The Production smoke test has not run.** Production deploys only from `main`,
after merge, so there is nothing yet to smoke test.

Both remain outstanding before merge, per section 6 of `CLAUDE.md`.

## Out of scope

`docs/marketing-site.md`, `docs/masthead-design-record-2026-09-16.md` and
`docs/evidence/masthead-nav-2026-09-19-evidence.md` still record the old label
and are historical records of decisions taken on their stated dates, so they
are not rewritten. The same reasoning covers `PROJECT_HANDOFF.md`,
`docs/forecastability-page-spec.md`, `docs/build-response-6-2026-09-07.md`,
`docs/build-response-7-2026-09-07.md`, `docs/build-response-8-2026-09-16.md`
and `docs/evidence/delivery-page-evidence.md`, which also name it. This file is
the current-state note.
