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

**CLOSED 17 September 2026. Keep it static**, ruled by the product owner:
a rendered scan needs a browser in the test environment to catch a defect that
enters when somebody writes a declaration, which is what the static scan reads.
The limit is now stated plainly in the test's own docstring, in his words: a
radius arriving from a browser default rather than from a declaration is
invisible to this scan. The two explicit zeroes on `forecast-risk.html` are
recorded in the same place as the reason that limit has not bitten.

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

**CLOSED 17 September 2026, amended.** Ruled by the product owner: count rules,
not badges, because the scan reads rules. Section 9a now says three rules and
four rendered elements, because the homepage rule dresses the email and
LinkedIn badges together, and names all three selectors.

Raised 17 September 2026 by the same story. **Not a defect, a counting
ambiguity**, and it needed one word from the product owner rather than a
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

## Q4. A size setting called --radius-md, with one size in it

**CLOSED 17 September 2026. Leave it**, ruled by the product owner: the setting
resolves, the page renders square, and both controls pass on it honestly rather
than by luck. Renaming a setting inside a story about building a control is the
edit this repository has a rule against, and not making it was the right call.

One line is now recorded beside the declaration in `index.html` itself, which
is where somebody would go looking for the missing small and large: a single
step with nothing above or below it, declared and read on that page only, and
correct as it stands. **`index.html` is in the diff for that comment and
nothing else.** Sixteen full-page screenshot hashes, four pages at 1440, 768,
390 and 320px, are byte identical before and after.

Raised 17 September 2026 by the radius scan story and deliberately not acted
on. Restated in full on the product owner's instruction, because the first
version named the thing without explaining it.

**What it is.** A named setting written once near the top of `index.html`:

```
--radius-md: 0px;
```

Corner rounding, in other words, set to none. One rule on the homepage reads
that setting instead of writing the number itself:

```
.btn { ... border-radius: var(--radius-md); }
```

So the homepage's buttons are square, and they are square by pointing at a
setting rather than by saying zero.

**What is odd about it.** Two things, neither of them a fault.

The name says `md`, for medium. A medium implies a small and a large, which is
how these settings are normally written: a set of three or four rounding
values, and each element picks one. There is no small and no large. It is a
scale with one step, and the name describes a scale that was never built.

It also sits in the wrong file. The site's settings live in `tokens.css`, which
every page loads. This one lives in `index.html`, so only the homepage can see
it. Any other page writing `var(--radius-md)` would get nothing, and an unknown
setting in CSS makes the whole line vanish with no error. That is the exact
defect `test_no_page_uses_an_undeclared_var` was built for in PR 120, and that
control does cover this: it is declared and used on the same page, so it passes
honestly rather than by luck.

- **What it blocks.** Nothing. It resolves, it renders square, and both
  controls pass on it.
- **Recommended default.** Leave it exactly as it is. The story said do not
  change any rendered value, and renaming or moving a setting inside a story
  about building a control is the shape of edit this repository has a rule
  against. There is also nothing to gain: the site is square, so a rounding
  scale has nothing to hold.
- **If you would rather it were tidied**, the honest version is to delete the
  setting and write `border-radius: 0` on `.btn` directly, matching what
  `forecast-risk.html` already does on the same class. That is one line in one
  file, it removes a name that describes something imaginary, and it wants its
  own change with the sixteen screenshot hashes to prove nothing moved. It is
  not urgent and I would not spend a round trip on it.
- **Cost if wrong.** None either way. Recorded so the next reader knows it was
  seen and left alone on purpose rather than missed.

## Q5. The brief named a section that does not say what the brief says

Raised 18 September 2026 by the designdecisions story. **Nothing is blocked
and the work was done. Flagged because guessing which document was meant
would have been the wrong move.**

The brief said: "Section 7 of the masthead record warns that `--space-1` to
`--space-4` live only in `index.html`."

The masthead record is `docs/build-response-8-2026-09-16.md`. Read through:

- It has six numbered sections, then an unnumbered seventh, "One thing in the
  reply that has not arrived here". That seventh section is about the deleted
  ramp, not about spacing.
- The only stale spacing claim in the file is in **section 4**, and it reads
  "`var(--space-4)` exists and was used. 16px, declared in `index.html`". It is
  a statement rather than a warning, and it names one token rather than four.
- No file in `docs/` warns that `--space-1` to `--space-4` live only in
  `index.html`. Checked by grep across every token name.

So the instruction was acted on in both halves. The false claim is corrected
where it actually sits, section 4, with a dated note rather than a rewrite. And
it is not carried across: the new text in `docs/designdecisions.md` states the
current truth, that the four are in `tokens.css` since pull request 120.

- **What it blocks.** Nothing.
- **Recommended default.** Treat this question as closed unless the product
  owner had a different document in mind, in which case name it and it is a
  two-minute change.
- **Cost if wrong.** Low, and bounded. If some other file does carry that
  warning, it is still false and still uncorrected, and the grep above says
  there is no such file in `docs/`.

## Q6. Two dead token names were added to the list beyond the five given

Raised 18 September 2026 by the same story, and **the addition is in the diff
rather than held**, so this is a question about whether to keep it.

The brief named five dead tokens: the four `--color-neutral-*` steps and
`--color-accent-700`. `--space-6` and `--space-8` are dead in exactly the same
way, from the same deleted file, at 24px and 32px. `tokens.css` declares
`--space-1` through `--space-4` and stops.

They are in the new section, in their own paragraph, labelled as an addition
beyond the list and marked strike-if-unwanted, so removing them is deleting one
paragraph.

- **What it blocks.** Nothing today. No built page names either.
- **Recommended default.** Keep them. `docs/forecastability-page-spec.md` names
  one or the other in fifteen places, so the trap is set and already has a
  specification standing in it. A dead-token list that is missing two dead
  tokens teaches a reader that the list is complete when it is not, which is
  worse than no list.
- **Cost if wrong.** None. It is one paragraph of prose in a handoff document
  and nothing is built from it.
