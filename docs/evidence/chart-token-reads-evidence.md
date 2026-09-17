# Token names read from script: evidence

Built 17 September 2026, closing Q1 in `docs/marketing-site-open-questions.md`.
Base: `main` at `5a18edb`, which is PR 120 merged.

One file changed: `forecast-app/tests/test_marketing_site_tokens.py`. No page
was touched. This story adds a control and nothing else.

---

## 1. Why the gap was worth closing immediately

PR 120 closed the `var()` half of the defect class. It left seven names
uncovered, and the product owner's instruction was to take them next rather
than later, because a gap that specific is the one a future change walks into.

A canvas cannot use `var()`. `forecast-risk.html` therefore names its chart
colours as strings and asks `getComputedStyle` for each value:

```
const token=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
```

**`getPropertyValue` on a name nothing declares returns an empty string.** Not
an error, not a thrown exception. `ctx.strokeStyle=''` leaves the previous
colour in place and the chart paints on, wrong and silent. That is the same
failure shape as an undefined `var()`, through a door a `var()` scan cannot
see.

The seven, confirmed by scanning rather than from the record:

`--color-accent`, `--color-chart-grid`, `--color-chart-series`,
`--color-status-bad`, `--color-text`, `--color-text-muted`, `--font-body`

## 2. What was built

`test_no_page_reads_an_undeclared_token_from_script`, plus two supporting
tests. It pulls every custom property named as a string literal inside a
`<script>` block and holds it against **the same declared set** the `var()`
scan uses, built from the chain each page links.

Both doors, one declared set, two failure messages that name which door.

## 3. Proved before trusted

The probe was chosen to isolate the new door rather than to pass easily. Six
of the seven names also appear as `var()` in the page's CSS, so renaming one of
those would have fired the old test too and proved nothing new.

**`--color-chart-grid` is the only one of the seven read solely from script.**
It was renamed to `--color-chart-gridline` in `tokens.css`, leaving the chart
asking for a name that no longer exists.

The result:

> `forecast-risk.html reads ['--color-chart-grid'] from script and nothing in its chain (forecast-risk.html, tokens.css)`

**Exactly one test failed**, `test_no_page_reads_an_undeclared_token_from_script`.
The `var()` test stayed green, which is the evidence that the new scan does
independent work rather than shadowing the old one.

Reverted. `tokens.css` hashes byte identical to before the probe.

## 4. One limit, stated in the test's own docstring

**JavaScript comments are not stripped**, so a commented-out token read still
counts as a read. That produces a loud failure rather than a silent one, which
is the right way round for a control to be wrong, and stripping comments from
JavaScript reliably is more machinery than the risk earns.

The three limits from PR 120 still stand: the scan is static, so a media-gated
declaration counts as declared; and it proves a name is declared, not that its
value is sensible.

## 5. Suite

**284 tests before, 287 after.** Three added. No fixture, no `expected_*.json`,
no golden file, no schema, no version bump due. No page file changed, so no
render check was due and none is claimed.

## 6. Not run

No Vercel Preview and no Production check. Outbound network is blocked in this
environment, so neither is available to this session and neither is claimed.

No real device, and none was warranted: this change adds a test and alters
nothing a visitor can see.
