# Marketing site, open questions

Format, from `CLAUDE.md` section 1: what it blocks, the recommended default,
the cost if wrong.

---

## Q1. Token names read from JavaScript are not covered by the var() control

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

**Not built today because the story asked for `var()` and `CLAUDE.md` section 4
rule 3 says a brief that names one thing wants one thing.** Raised rather than
folded in.
