# Marketing site, open questions

Format, from `CLAUDE.md` section 1: what it blocks, the recommended default,
the cost if wrong.

---

## Q1. Token names read from JavaScript are not covered by the var() control

**CLOSED 17 September 2026, built.** The recommendation below was taken the same day, in the next story rather than later, on the product owner's instruction: a gap that specific is the one a future change walks into. `test_no_page_reads_an_undeclared_token_from_script` now holds the seven names against the same declared set as the `var()` scan. Proved by renaming `--color-chart-grid` in `tokens.css`, the one of the seven read only from script, and watching that test and only that test fail. The question is kept rather than deleted, because the reasoning is the useful part.

`test_no_page_uses_an_undeclared_var` was added on 17 September 2026 and closes
the var() half of the defect class. It does not close the other half.

`forecast-risk.html` reads seven token names as strings, through
`getComputedStyle`, to paint its canvas:

`--color-accent`, `--color-chart-grid`, `--color-chart-series`,
`--color-status-bad`, `--color-text`, `--color-text-muted`, `--font-body`

A canvas cannot use `var()`, so this is not avoidable on that page. It is the
same defect in the same shape: rename or remove one of those seven in
`tokens.css` and the chart paints with an empty string, silently. The control
added today reads `var(` and will not see it.

- **What it blocks.** Nothing today. All seven resolve. It blocks nobody until
  someone renames a token, and then it blocks them silently, which is the
  problem.
- **Recommended default.** Extend the same control to read
  `token('--name')` and the `getComputedStyle(...).getPropertyValue('--name')`
  form, holding both against the same declared set. It is roughly ten lines in
  a scan that already exists, and it takes the class from half closed to
  closed.
- **Cost if wrong.** Low either way. If the extension is too eager it fires on
  a string that happens to look like a token name, which is a visible failure
  fixed in a minute. If it is never built, the next token rename breaks a chart
  on a client-facing page with nothing to catch it, which is the exact shape of
  the defect this story was written about.

**Not built in the story that raised it, because that story asked for `var()`
and `CLAUDE.md` section 4 rule 3 says a brief that names one thing wants one
thing.** Raised rather than folded in, then built as its own story the same
day. That is the sequence the rule is for: the scope discipline cost one round
trip and no time.

---

## Q2. The radius scan reads CSS, not a rendered page

Raised 17 September 2026 by the radius scan story, which asked for a test that
fails when any **element** carries a non-zero radius.

`MarketingSiteKeepsZeroRadius` reads declarations, not elements. That gap is
not a shortcut: `forecast-app/tests/` is the only suite anything invokes, it
runs on Python with no browser, and Playwright is not one of its six
dependencies. A committed browser test would be a new dependency in the Assay
application's requirements to test the marketing site, which is a decision
rather than a build step.

The rendered scan was run once, by hand, as the evidence for this story:
1664 element inspections across four pages and four widths, four rounded
elements found, all approved. It is in
`docs/evidence/radius-scan-evidence.md` and it is not committed as a test.

- **What it blocks.** Nothing today. The static scan and the rendered scan
  agree exactly on the four pages as they stand.
- **Recommended default.** Leave it static. The two things the static scan
  cannot see are a user agent radius and a cascade override, and the site is
  four hand-written pages where both are visible by reading. Revisit if the
  site ever gains a build step or a component framework, because a generated
  page is where a declaration scan stops being equivalent to a rendered one.
- **Cost if wrong.** Low. A radius the static scan misses would have to come
  from a browser default on a form control, and the two explicit zeroes on
  `select` and `.btn` are what stop that today. If they were deleted, the
  static scan would see the deletion, which is the part that matters.

## Q3. CLAUDE.md 9a says three contact badges. There are four.

Raised 17 September 2026 by the same story. **Not a defect, a counting
ambiguity**, and it needs one word from the product owner rather than a
change to anything built.

Section 9a names "the three circular contact badges in index.html,
forecast-risk.html and forecastability.html". Three CSS rules carry a radius,
which matches. Four elements render rounded, because the homepage rule dresses
both the email badge and the LinkedIn badge.

- **What it blocks.** Nothing. The scan allows by selector, so three entries is
  correct whichever count is meant.
- **Recommended default.** Amend section 9a to say three rules and four
  elements. `CLAUDE.md` is a shared file and this session does not edit it, so
  it is raised here for routing.
- **Cost if wrong.** Low, and it is the cost of somebody counting badges on
  the site, getting four, and reading the rule as already broken. That is a
  wasted hour, not a defect.

## Q4. --radius-md is a scale with one step

Raised 17 September 2026 by the same story, and deliberately not acted on.

`index.html` declares `--radius-md: 0px` and uses it once, on `.btn`. The name
implies a small and a large that do not exist, and the token lives on the
homepage rather than in `tokens.css` where the site's tokens live.

- **What it blocks.** Nothing. It resolves, it is square, and both controls
  pass on it.
- **Recommended default.** Leave it. The story said do not change any rendered
  value, and moving or renaming a token that resolves to zero is a change to
  the site made inside a control story, which is the shape of edit this
  repository has a rule against. If it is ever tidied it belongs in its own
  change, with the sixteen screenshot hashes to prove nothing moved.
- **Cost if wrong.** None either way. Recorded only so the next reader knows it
  was seen and left alone on purpose rather than missed.
