# Evidence: delivery page, wordmark and masthead nav, 19 September 2026

The brief of 18 September 2026, revised 19 September, applied in one pass:
changeset 1 (wordmark to "Silurian PM"), changeset 2 (delivery.html, the
second nav link and the hairline separator) and changeset 3 (nav labels,
alignment and current-page state), then the breakpoint remeasured once at the
end as the brief instructs.

Rendered checks in headless Chromium 1194 against a local static server on the
repository's own files, so the Archivo variable font was loaded and awaited
before anything was measured. Every figure below is read through
`getComputedStyle` or `getBoundingClientRect`, not from the source.

Part of this brief was already on `main` when the pass began: `delivery.html`
existed, and `index.html`, `privacy.html` and the nav labels were already
done, from the 18 September build. This record covers what this pass changed
and what it measured, and says which parts it found already in place.

---

## The 521px breakpoint is now 712px

The brief's number is 521px. The value on `main` was already 716px, remeasured
twice on 18 September as the lockup's strings changed. All three changesets
move it again, so it was remeasured once at the end.

**Method.** Temporary copies of `index.html` and `delivery.html` with the wrap
query neutralised, so the desktop lockup could be measured at every width.
Viewport stepped 1300px down to 300px in 1px steps. Failure is the two nav
links ceasing to sit on one line, measured by comparing the two links' client
rect tops.

**Result.** Both pages fail at 712px and both hold at 713px. **1001
observations per page**, which is the count and not a claim: a scan that
reports nothing because it read nothing is not a pass.

```
index.html      first fail 712px   last hold 713px   1001 observations
delivery.html   first fail 712px   last hold 713px   1001 observations
```

**Why it came down from 716px rather than going up.** The air either side of
the nav hairline changed from a flat `var(--space-4)`, which is 16px, to the
brief's `clamp(14px, 2vw, 24px)`. At 712px, `2vw` is 14.24px, so the clamp is
narrower than the token it replaced and the two labels fit about 4px further
down. At desktop the clamp is wider, 24px at 1440px, which is the point of it.

The value and its comment were updated together, on both pages, in the same
edit. The comment records the strings it was measured against, the method, the
observation count and the reason it moved.

## The nav is centred against the lockup, not aligned to its first line

`.mast-brand .mast-nav` was `grid-row: 1; align-self: baseline`. It is now
`grid-row: 1 / 3; align-self: center`, so the nav spans both lockup rows and
centres against the pair.

Measured as the nav box's vertical centre minus the lockup's vertical centre:

```
width    nav centre - lockup centre
1440px   -0.01px
1090px   -0.01px
 900px    0.00px
 720px    0.00px
 713px    0.00px
```

Below the breakpoint the nav takes its own row, so the figure is not
meaningful there and is not quoted as if it were.

**Baseline drift**, measured as the nav link's text baseline minus the
wordmark's text baseline, using a zero-size inline probe appended to each:

```
1440px   8.73px      1090px   8.73px      900px   8.66px
 720px   9.59px       713px   9.59px
```

The brief says "drift against the lockup baseline of around 7px at desktop is
expected and intended". The measured figure is 8.7px at desktop, not 7px. It
is recorded as measured rather than rounded to the brief's number.

## The hairline separator

`.mast-nav a.forecast-link + a.forecast-link`, read on both pages:

```
width    border-left                    padding-left   nav gap    lines
1440px   1px solid rgb(63, 61, 59)      24px           24px       1
1090px   1px solid rgb(63, 61, 59)      21.8px         21.8px     1
 720px   1px solid rgb(63, 61, 59)      14.4px         14.4px     1
 713px   1px solid rgb(63, 61, 59)      14.26px        14.26px    1
 712px   0px none                       0px            16px       1
 560px   0px none                       0px            16px       1
 521px   0px none                       0px            16px       1
 320px   0px none                       0px            16px       2
```

`rgb(63, 61, 59)` is `--color-divider` at full ink. It is not faded and it is
not a typed pipe. The gap and the padding are equal at every width above the
breakpoint, so the hairline sits centred between the two labels rather than
closer to one of them.

**It spans the full line box and is not cropped.** The second link's rendered
height is 22.50px at every width, which is the 15px body step at
`line-height: 1.5`, and the border is drawn on that box.

**It disappears when the nav wraps.** At 712px and below the border is
`0px none` and the padding is 0, and the nav's own row gap carries the air the
padding was holding. Both hairlines go together: `.mast-rule` is
`display: none` in the same query.

## Nav labels, aria-label and current-page state

Read from the rendered DOM on each page:

```
page                  nav links                                      aria-label   aria-current
index.html            Project Management | AI Forecast Diagnostic    Services     none
delivery.html         Project Management | AI Forecast Diagnostic    Services     Project Management
forecastability.html  no nav on this page's masthead                 n/a          n/a
```

`aria-label` is "Services" and not "Forecasting tools" on both pages that carry
the nav. `forecastability.html` is the open item, recorded as Q9 in
`docs/marketing-site-open-questions.md`.

## The wordmark on every page

Read from the rendered DOM, the masthead's wordmark element on each page:

```
index.html             Silurian PM      (lockup, subline "Project & Programme Delivery")
delivery.html          Silurian PM      (lockup, same subline)
forecastability.html   Silurian PM      (older masthead, no subline)   <- changed in this pass
forecast-risk.html     Silurian         (older masthead, no subline)   <- not changed, Q10
privacy.html           Silurian PM      (older masthead, no subline)
```

No page's masthead says "Silurian Assay". The sublines on the two lockup pages
are unchanged.

## delivery.html rebuilt to the changeset's structure

The page on `main` was built on 18 September from
`docs/change-delivery-page.md`, which is vaguer about layout than the brief's
changeset 2. Five things differed and are now as the changeset specifies.

1. **The lead band.** Was a single stacked column. Is now `#about`'s two-part
   shape: headline and subline, a 2px seam, then a 4fr/7fr band with the prose
   left and the numbered list right. Measured column widths, content width in
   brackets:

   ```
   1440px   363.625px / 636.375px   (1056px, gap 56px)   ratio 4 : 7
   1090px   336.359px / 588.641px
    900px   274.172px / 479.828px
    720px   one column, gap 28px
   ```

   The second band, under the approach head, measures identically at every
   width, which is the point of putting the grid on one class.

2. **"Where we add value" is gone.** The changeset says the section takes no
   heading. It had one.

3. **The two paragraphs are one `.note-col` grid child**, not two children.
   The lead-in takes `.note` at 78% ink and the longer paragraph takes
   `.note-direct` at full ink, which is index.html's pairing.

4. **Typical assignments is a two-column hairline grid**, not a single flex
   column. `repeat(auto-fit, minmax(min(320px, 100%), 1fr))`, `column-gap:
   56px`, each item `padding: 18px 0` with a 1px top rule, at the lead step in
   the heading font at weight 800 and `letter-spacing: -0.01em`.

   ```
   1440px   500px / 500px     2 columns
   1090px   462.5px / 462.5px 2 columns
    900px   377px / 377px     2 columns
    720px   648px            1 column
   ```

   The last item's `border-bottom` computes `0px` at every width, on both
   columns, so no rule falls under the last item in either.

5. **The description meta** takes the changeset's lead-in sentence.

### One deviation from the changeset's literal value, and why

The changeset specifies `minmax(320px, 1fr)`. **Built exactly that way, the
page scrolled sideways by 20px at a 320px viewport**, because a 320px
viewport leaves a 280px content column after the gutter and a bare
`minmax(320px, 1fr)` holds a 320px track anyway. It is now
`minmax(min(320px, 100%), 1fr)`, which holds a 320px track everywhere there is
room for one and clamps to the column where there is not.

This is the failure `docs/designdecisions.md` names under the type scale: "the
page scrolled sideways; nothing in the diff showed it". It was found by the
render check at 320px and would not have been found by reading the source.

### Horizontal overflow, all five pages

`scrollWidth - clientWidth`, read at 320, 360, 480, 521, 560, 712, 713, 720,
900, 1090 and 1440px on `index.html`, `delivery.html`, `forecastability.html`,
`forecast-risk.html` and `privacy.html`. **55 page-width combinations, every
one 0px.** The 20px above is the pre-fix figure and is quoted to show the
check caught something.

## Radius, all five pages

Every element on every page read through `getComputedStyle`, all four corners
checked, at all the widths above.

```
page                   corners read   rounded elements
index.html             256            .close .contact-badge x2, both 50%
delivery.html          376            .close .contact-badge x2, both 50%
forecastability.html   696            .mail-badge, 50%
forecast-risk.html     692            .contact-badge, 50%
privacy.html           164            none
```

Six rounded elements from four rules, which is the count `CLAUDE.md` section
9a carries. Nothing on the rebuilt delivery page carries a radius: 376
corners were read on it and the only two rounded are the closing field's
badges, which are the documented exception and are allowed by selector.

## Tests

`python -m unittest discover -s tests` from `forecast-app/`.

**294 tests before, 294 after, OK both times.** No test was added, changed or
removed in this pass.

The two the brief names, run individually and by name:

```
test_a_page_spends_poster_at_most_once ... ok
test_no_page_uses_an_undeclared_var ... ok
```

`--text-poster` appears once in `delivery.html`, on the closing field's `h3`.

The whole of `tests.test_marketing_site_tokens` was run verbosely, 40 tests,
OK, which covers the raw colour scan, the hand-written size scan in both the
longhand and the `font` shorthand, the undeclared-var scan, the font source
checks and the status colour match. `MarketingSiteKeepsZeroRadius` was run
separately, 7 tests, OK.

**What did not run.** No Vercel Preview and no Production smoke test. This
pass has not been deployed and nothing here should be read as a deployment
check. The `forecast-app` suite needed `starlette`, `fastapi`,
`python-multipart`, `jsonschema` and `httpx` installed in this container
before it would load; with them absent the discovery ran 200 tests with 8
module import errors, which is an environment gap in this container and not a
finding about the code.

## What this pass did not do

- The nav, hairline, `aria-label`, `aria-current` and centring on
  `forecastability.html`. That page has no lockup to put them in. Q9.
- The wordmark on `forecast-risk.html`, which still reads "Silurian". Q10.
- The footer's registered name, company number and office address, which the
  brief flags as a placeholder and out of scope. Q11.
- `forecastability.html`'s content, which the brief says needs James's copy.
- The `.mast-home` mark link and the `.back` link on `delivery.html`. The
  changeset says the masthead is "identical to index.html, with one link
  added", which would remove both. They were added on 18 September on the
  product owner's own instruction, recorded in commit `ccf373b`, so removing
  them under a brief written before that ruling would undo a decision rather
  than apply one.

---

# Second pass, 19 September 2026: masthead unification and the back link

Two changes ruled by the product owner after the first pass: move
`forecastability.html` onto the same masthead as `index.html` and
`delivery.html`, and change the back link's visible text to "Home" wherever it
appears. Same branch, so pull request 134 updates. Nothing merged.

Same method as above: headless Chromium 1194 against a local static server on
the repository's own files, fonts awaited, every figure read through
`getComputedStyle` or `getBoundingClientRect`.

## The ground did not change, and the note that said it would was wrong

`docs/marketing-site-open-questions.md` Q9 said the port "changes the top of
the page from paper to orange". **It does not.** `.mast-bar` declares
`background: var(--color-accent)` and every page carrying it overrides that
inline with `--color-paper`. Measured on all three pages, at all six widths:

```
index.html             .mast-bar background  rgb(255, 255, 255)
delivery.html          .mast-bar background  rgb(255, 255, 255)
forecastability.html   .mast-bar background  rgb(255, 255, 255)
```

`forecastability.html`'s old masthead painted `--color-paper` on `.mast` and
computed the same white. The ground is unchanged. What moved is the lockup, the
nav and the 2px seam, which is now on the bar rather than on `.mast`.

Q9 was written by reading the stylesheet rather than a rendered page. The
correction is recorded in the questions file and the wrong sentence is left
standing there, because a correction to the record stays on the record.

## What was ported, and how

`delivery.html`'s masthead `<style>` block was taken whole and put into
`forecastability.html`, not retyped. Its wrap query lives in that page's third
style block rather than the second, so it was extracted separately and added;
the first build of this change was missing it and the nav would not have
dropped to its own row below the breakpoint. Caught by counting `.mast-nav`
rules across the three pages, 6 against 4.

`--half: 14px` was added to the page's `:root`, which the bar's padding reads.
Same name and same value as the other two pages, not a new token.

Three shared comments named two pages and the old back-link string. They were
updated on all three pages in the same edit, so the block stays one thing.

## The breakpoint held at 712px, and was remeasured anyway

Method as before, wrap query neutralised, 1300px to 300px in 1px steps.

```
index.html             first fail 712px   last hold 713px   1001 observations
delivery.html          first fail 712px   last hold 713px   1001 observations
forecastability.html   first fail 712px   last hold 713px   1001 observations
```

**It did not move.** What fails first is the nav's own two labels, and neither
of those changed. The comment was still updated on all three pages, because it
previously said "on both pages carrying this lockup: index.html and
delivery.html" and that is now three pages. **A number that holds is a
measurement, not an absence of one**, and the comment has to say what was
actually measured or the next reader cannot tell the difference between a
value that was checked and one that was skipped.

## The new masthead, read at the six named widths

```
width   bar ground           nav   hairline    aria-label  aria-current              nav centre - lockup centre
1440    rgb(255,255,255)     1     1px solid   Services    AI Forecast Diagnostic    -0.01px
1090    rgb(255,255,255)     1     1px solid   Services    AI Forecast Diagnostic    -0.01px
 720    rgb(255,255,255)     1     1px solid   Services    AI Forecast Diagnostic     0.00px
 560    rgb(255,255,255)     1     0px none    Services    AI Forecast Diagnostic    n/a, nav on its own row
 521    rgb(255,255,255)     1     0px none    Services    AI Forecast Diagnostic    n/a
 320    rgb(255,255,255)     2     0px none    Services    AI Forecast Diagnostic    n/a
```

Wordmark "Silurian PM" and subline "Project & Programme Delivery" read from the
rendered DOM on all three lockup pages, identical on each.

`aria-current="location"` is on the AI Forecast Diagnostic link on this page,
on the Project Management link on `delivery.html`, and on neither link on
`index.html`.

## The back link

```
page                   visible text        href
delivery.html          Home                index.html
forecastability.html   Home                index.html
forecast-risk.html     Back to Silurian    index.html    <- not changed, Q10
index.html             no back link
privacy.html           no back link
```

No `aria-label` or `title` anywhere on the site contained "Back to Silurian",
so none needed changing. Checked by grep across every tracked HTML file, which
found the string on three pages and in no attribute.

Destinations are unchanged on every one.

## One thing added that the instruction did not name

`forecastability.html`'s only focus ring was
`.mast .brand-home:focus-visible`, which the port deleted with the rest of the
old masthead. **That page has no global `:focus-visible` rule**, where
`index.html` and `delivery.html` both do in their base layer, so the port would
have silently traded an accent outline for the browser default on the one link
that had one.

Restored as `.mast-bar a:focus-visible` with the same two declarations the
other pages use, which covers all four links in the bar rather than just the
mark. Verified by focusing each in turn:

```
.mast-home                  2px solid rgb(236, 105, 23)
.mast-nav a.forecast-link   2px solid rgb(236, 105, 23)
.back                       2px solid rgb(236, 105, 23)
```

`rgb(236, 105, 23)` is `--color-accent`. This is a restoration of what the port
removed, not a new treatment, and it is called out here because it is the one
declaration in this pass that no instruction asked for.

## Horizontal overflow and radius

`scrollWidth - clientWidth` at 320, 521, 560, 720, 1090 and 1440px on all five
pages. **30 combinations, every one 0px.**

Radius read through `getComputedStyle`, all four corners of every element, at
every width:

```
page                   corners read   rounded
index.html             256            2, both .close .contact-badge at 50%
delivery.html          376            2, both .close .contact-badge at 50%
forecastability.html   720            1, .mail-badge at 50%
forecast-risk.html     692            1, .contact-badge at 50%
privacy.html           164            0
```

Six rounded elements from four rules, which is the count `CLAUDE.md` section 9a
carries. `forecastability.html`'s corner count rose from 696 to 720 because the
new masthead has more elements in it, and its rounded count is unchanged at
one. **The new masthead added 24 corners and no radius.**

## Tests

`python -m unittest discover -s tests` from `forecast-app/`. **294 before, 294
after, OK both times.** No test added, changed or removed.

`test_no_page_uses_an_undeclared_var` passes, which is the control that would
have caught the ported block naming a token `forecastability.html` cannot see.
That is the reason `--half` was added rather than assumed.

## What did not run

**No Vercel Preview check and no Production check were run by this session.**
The previews build and Vercel reports them, but this container's egress proxy
answers 403 to CONNECT for `*.vercel.app`, so the deployed pages were not
opened from here. Every rendered figure in this record is from the local build
of the same commit, not from the preview.

## Not done

- `forecast-risk.html`: wordmark, masthead and back-link label all unchanged.
  Out of scope by instruction, and the back link's label is the half of that
  instruction that disagrees with itself. Q10.
- No page copy was written, on this page or any other.
- The rest of `forecastability.html` below the masthead is untouched.
