# The marketing site's first radius scan: evidence

Built 17 September 2026, from `CLAUDE.md` section 9a, which records that the
site has never had a radius scan and hands writing one to the site session.
Base: `main` at `88830f9`, which is PR 121 merged.

One file changed: `forecast-app/tests/test_marketing_site_tokens.py`. **No page
was touched and no rendered value moved.** The whole diff is a control.

---

## 1. The result, first

**The site is clean. There is no fourth rounded thing.** Every non-zero radius
on the four pages belongs to an approved contact badge.

The brief said to stop and report if a fourth turned up. Nothing did, and that
is a measured result rather than an assumption: section 4 below shows what the
scan inspected to get there.

**Three selectors, four elements.** That is the one number worth flagging.
`CLAUDE.md` section 9a says "the three circular contact badges in index.html,
forecast-risk.html and forecastability.html". Rendered, there are four badges:
the homepage carries an email badge and a LinkedIn badge, and one CSS rule
dresses both.

| Page | Selector | Value | Elements it dresses |
| --- | --- | --- | --- |
| `index.html` | `.close .contact-badge` | `50%` | 2, email and LinkedIn |
| `forecast-risk.html` | `.close .contact-badge` | `50%` | 1 |
| `forecastability.html` | `.mail-badge` | `50%` | 1 |

Three rules, four elements. Both counts are correct about different things and
they are recorded here so the next reader does not have to work out which
section 9a meant. Amending `CLAUDE.md` is not this session's to do.

## 2. Allowed by selector, never by value

The exception list is three `(page, selector)` pairs:

```
APPROVED_ROUND_SELECTORS = frozenset({
    ("index.html", ".close .contact-badge"),
    ("forecast-risk.html", ".close .contact-badge"),
    ("forecastability.html", ".mail-badge"),
})
```

A scan that allowed `50%` as a value would wave through the next element
somebody rounds, which is the whole reason the rule exists. Pinned by
`test_the_exception_is_by_name_and_not_by_value`, which asserts that
`.close .contact-badge` on `index.html` is on the list and that `.btn` on the
same page is not.

## 3. The one declaration a literal scan would have got wrong

`index.html` writes:

```
.btn { ... border-radius: var(--radius-md); }
```

and declares `--radius-md: 0px` at line 17. **It is square.** A scan reading
the literal text would have reported a fourth rounded element and sent the
product owner after a defect that is not there, which is the opposite of the
brief's instruction to report real findings.

So the scan resolves `var()` one name at a time against the values the page's
chain declares, up to four levels. A name with no declaration, with two
different declarations, or written with a fallback is left exactly as written
and then fails the zero test with the unresolved text in the message. A radius
nobody can resolve is a finding, not a pass.

Pinned by `test_a_radius_written_through_a_token_is_read_through_it`.

## 4. Anti-vacuity, the part the brief said matters

### 4.1 What the rendered scan inspected, per page

Headless Chromium, all four pages at 1440, 768, 390 and 320px, walking every
element in the DOM and reading all four computed corner values. Counts are
elements inspected, not rules.

| Page | Elements inspected, each width | Non-zero radius | Which |
| --- | --- | --- | --- |
| `index.html` | 53 | 2 | `a.btn.contact-badge.email-badge`, `a.btn.contact-badge.linkedin-badge` |
| `forecast-risk.html` | 164 | 1 | `span.contact-badge` |
| `forecastability.html` | 166 | 1 | `span.mail-badge` |
| `privacy.html` | 33 | 0 | none |

416 elements per width pass, **1664 across the sixteen passes**, and the counts
and the findings were identical at every width. No user agent default turned up
a radius anywhere, and section 6 says why that is not luck.

### 4.2 What the static scan parsed, per page

| Page | Own `<style>` rules | `tokens.css` rules | Radius declarations | Non-zero |
| --- | --- | --- | --- | --- |
| `forecast-risk.html` | 92 | 2 | 3 | 1 |
| `forecastability.html` | 75 | 2 | 1 | 1 |
| `index.html` | 84 | 2 | 2 | 1 |
| `privacy.html` | 16 | 2 | 0 | 0 |

**275 CSS rules parsed, 6 radius declarations found, 3 of them non-zero.**

### 4.3 Proof that a scan reading nothing does not pass

Asserting the counts above would only restate them. The proof is to break the
parser and watch which tests notice.

`STYLE_BLOCK` was changed to match `<stylesheet>` instead of `<style>`, so
every page's own CSS became unreadable while the file still ran.

| Test | Result on the broken parser |
| --- | --- |
| `test_no_page_carries_a_non_zero_radius` | **passed** |
| `test_the_scan_reads_every_page_and_its_chain` | failed: `'body' not found in set()` |
| `test_the_scan_finds_all_three_approved_badges` | failed: all three badges missing |
| `test_a_radius_written_through_a_token_is_read_through_it` | failed: `None != {'0px'}` |

**The main control reported a clean site while reading nothing at all.** That is
the `.stage-tag` failure from the theme band reproduced on demand: a check that
returns zero observations reads exactly like a check that found nothing wrong.
Without the two anti-vacuity tests this scan would have been worthless and
would have looked green.

The anchors are structural rather than a count: every page styles `body` in its
own `<style>` block, and every page's chain reaches `tokens.css`, where `:root`
carries the tokens. Break the parser and both vanish together.

**A count floor was written first and thrown away.** It would have had to sit
under `privacy.html` at 16 rules, and a threshold chosen to clear the shortest
page is tuned to pass rather than measured. The counts live here instead, which
is what the brief asked for.

`STYLE_BLOCK` was restored and the test file compared byte for byte against the
copy taken before the break. Identical.

## 5. Proof that it can fail

A pill planted on an ordinary element, on the page furthest from any approved
badge:

```
.legal a { border-radius: 6px; }
```

added to `privacy.html`. Two tests fired:

```
test_no_page_carries_a_non_zero_radius
  privacy.html: .legal a { border-radius: 6px }, in privacy.html

test_the_scan_finds_all_three_approved_badges
  Items in the first set but not the second: ('privacy.html', '.legal a')
```

The message names the page, the selector, the property and the value, and says
where to take the decision if the radius is deliberate. Two firing is correct:
one says the site is no longer square, the other says the rounded set no longer
matches the approved list.

`privacy.html` reverted, sha256 `400d9845cba43cc49f50e4ba325df01730b3315441ca7bd51fc171669cffe0fc`
before and after, and `cmp` against the copy taken first reports identical.

## 6. Two zeroes that look redundant and are not

`forecast-risk.html` sets `border-radius: 0` explicitly on `select` and on
`.btn`. `index.html` sets `border-radius: var(--radius-md)` on `.btn`, which
resolves to `0px`.

These read like belt and braces on a site that is square by default. They are
not. A form control takes its radius from the browser's own stylesheet, not
from nothing, and the rendered scan found no user agent radius **because those
zeroes are there**. Deleting them as redundant is how the site would acquire
rounded controls on some future browser without anyone writing a radius.
Recorded in the test's own docstring as well as here, because a comment in an
evidence file nobody opens is not a control.

## 7. What this control does not do

Four limits, stated in the test's docstring too.

**It reads declarations, not rendered elements.** A rule that matches nothing
still counts. That errs towards reporting, which is the right direction.

**It does not resolve the cascade.** It cannot tell that a rounded declaration
is overridden by a later square one. Again it reports.

**It reads no user agent stylesheet.** A control a browser rounds by default is
invisible to it. Checked once against headless Chromium when this was built,
and section 6 is why there were none. That check is evidence taken today, not a
committed test: Playwright is not a dependency of this suite and adding one is
a decision, not a build step. Raised as Q2.

**It reads CSS, not geometry.** An SVG drawn with round corners in its own path
data is not a CSS radius and is out of scope.

It does cover three doors: rules in the page's own `<style>` and in its linked
stylesheets, `style=` attributes on elements, and any radius set from
JavaScript. The third is the door the token scan had to close separately last
story. Nothing on the site uses it, so any hit at all is a finding rather than a
value to classify.

## 8. A mistake made while building this, recorded

The first run of the new tests was filtered through
`grep -i "radius\|Ran \|OK\|FAILED"` to keep the output short. Six tests
printed `ok` and nothing printed `FAILED`, so it read as seven passes.

It was six passes and one failure. `test_the_scan_reads_every_page_and_its_chain`
had failed on the count floor, and because its first docstring line carried none
of the grep terms, the failure was filtered out of the output rather than absent
from it.

Caught by running the class unfiltered a few minutes later, for a different
reason. This is the same family as everything else in section 4: **a tool that
reports nothing has not told you there is nothing.** The filter was the blind
spot, not the suite.

## 9. Suite

287 tests before, **294 after**, all passing. Seven added, all in
`MarketingSiteKeepsZeroRadius`.

## 10. Not run

No Vercel Preview and no Production check. Outbound network is blocked in this
environment and neither is claimed. No real device.

Nothing rendered can have moved: no site file is in the diff. The rendered
measurements in section 4.1 were taken against the working tree with headless
Chromium, which reproduces layout and colour faithfully and does not reproduce
platform control styling, which is exactly the gap section 6 is about.
