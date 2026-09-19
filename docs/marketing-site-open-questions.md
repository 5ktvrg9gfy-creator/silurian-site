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

**CLOSED 18 September 2026, committed.** The file was attached and is now
`docs/masthead-design-record-2026-09-16.md`, body unedited, sha256
`55d7722b6300eb7715d22154acd371c4a0386c0980202ca2921b134b9e753e6c` as routed,
with a dated blockquote beside its spacing paragraph saying it was true on
16 September and superseded by pull request 120.

**The citation was right and this session's reading of it was incomplete.**
Section 7 exists, it is titled "What a site changeset has to satisfy, so the
next one is not caught out", and its spacing paragraph says exactly what the
brief quoted. The search that missed it was correct in scope and wrong in
assumption: it covered `docs/`, and the document was not in `docs/`, which is
the finding rather than the miss.

The rest of this entry stands as the record of the block and how it was
resolved.

**ANSWERED 18 September 2026, and BLOCKED at the time on a file this session
could not reach.** The product owner's answer: the citation was his error in
placing it, not a gap in the search. The spacing warning is real and quoted accurately, but it is in a
routed summary titled **"Silurian site: masthead design round"**, sent to the
planning session as a file and never committed. Grepping `docs/` could not have
found it.

**His ruling: commit that summary to `docs/` as its own file, body unedited,
with a dated note beside it saying its spacing section was true on 16 September
2026 and was superseded by pull request 120.**

**That is not done, because this session does not have the file.** It is not in
the repository tracked, untracked or ignored, it is not in any branch's history,
and the string "masthead design round" appears nowhere in the tree. It exists in
a chat this session cannot see.

**What is needed: the file itself, routed into this repository the way
`docs/designdecisions.md` was.** Paste it or attach it and committing it with
the dated note is a few minutes.

**What will not be done instead:** reconstructing it from the quotation in the
brief, or from memory. A routed summary written by the session that did not
write it, presented as the original, is a fabricated record. This repository
exists partly to stop exactly that, and the finding underneath this ruling, a
document that controls how the next change is written living outside the
repository, would be made worse by inventing a second version of it.

Raised 18 September 2026 by the designdecisions story. **Flagged because
guessing which document was meant would have been the wrong move.**

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

**CLOSED 18 September 2026. Keep them, and fold them into the list**, ruled by
the product owner: same commit, same file, and a specification naming one of
them is a trap already set. The severable paragraph is gone and
`docs/designdecisions.md` now reads "These seven do not exist", with one
paragraph under it explaining that the two spacing names are the same death in
the same commit.

**One number in the paragraph that was folded away was wrong and is corrected
rather than carried over.** It said the forecastability spec names one or the
other in fifteen places. Counted properly: 13 lines and 17 occurrences for the
two spacing names, and 27 lines and 35 occurrences across all seven dead
tokens. The estimate came from eyeballing a grep listing, where one line can
carry two names. The document now carries the counted figures.

Raised 18 September 2026 by the same story, and **the addition was in the diff
rather than held**, so this was a question about whether to keep it.

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

## Q7. Is docs/forecastability-page-spec.md still the spec?

**CLOSED 18 September 2026. It is a historical record, not a live
specification**, ruled by the product owner. The page it describes was
re-expressed against `tokens.css` at build time, names none of the seven dead
tokens and passes every control, so the document records design intent from a
moment that has passed rather than how the page is built.

**One dated note at the top and nothing else.** It is not re-expressed. His
reasoning, kept because it is the part that stops this being reopened: if a
future change needs a specification for that page, it gets written fresh from
the page as built, not repaired from a document that has drifted for two weeks.

Raised 18 September 2026 on the product owner's instruction. **Recorded, not
fixed**, because the answer decided which of two opposite edits it wanted.

The specification is written against the deleted `styles.css`. Its second line
says "Every colour, font and spacing value comes from `styles.css` tokens", and
it names the seven dead tokens on **27 lines, 35 times**:

| Dead token | Occurrences |
| --- | --- |
| `--space-6` | 11 |
| `--color-neutral-300` | 6 |
| `--space-8` | 6 |
| `--color-neutral-800` | 5 |
| `--color-neutral-900` | 3 |
| `--color-accent-700` | 3 |
| `--color-neutral-500` | 1 |

It also writes `#ec6917` eight times and `#ffffff` three times as literals,
against the rule that no hex appears in a design document.

**The page it specifies was built and shipped and is fine.**
`forecastability.html` names none of the seven, carries no raw colour, and
passes every control. The build session re-expressed the specification against
`tokens.css` at the time, which `docs/build-response-6-2026-09-07.md` and
`docs/build-response-7-2026-09-07.md` record in full. So this is a stale
document, not a broken page.

- **What it blocks.** Nothing today. It blocks the next person who opens that
  file to change the page, which is the whole point of recording it.
- **Recommended default.** Answer the status question first, before any edit.
  If it is still the specification, it wants the same treatment
  `docs/designdecisions.md` just had, which is one pass re-expressing the dead
  names against `tokens.css`. If it is a historical record of what was
  specified on 7 September, it wants one dated note at the top saying so and
  nothing else. **Those are opposite edits**, which is why guessing is worse
  than asking.
- **Cost if wrong.** Moderate, and it is the cost this story exists to stop. A
  page built from it without checking gets the silent failure described in
  `docs/designdecisions.md`: undefined custom properties, declarations dropped
  at computed-value time, no error, and a page that looks like a design
  decision rather than a fault.

## Q8. Two more stale statements in the masthead record, not noted

**CLOSED 18 September 2026. Both noted**, ruled by the product owner: same
form, dated blockquote beside each, no body edit. Section 6's ramp bullet is
marked closed by pull request 125. Section 7's radius paragraph is marked three
rules and four rendered elements, with a line saying the rule is now enforced
by `MarketingSiteKeepsZeroRadius` and was not enforced by anything when that
paragraph was written. **The divider height bullet was left alone**, because it
was genuinely open and nobody had seen the rule in place. **It closed later the same day**: the product owner looked at the masthead on a laptop, the rule reads right, so the condition is not met and the 1px value stands. Noted in four places, the two in the masthead record, the one in `docs/build-response-8-2026-09-16.md` and the masthead entry in `PROJECT_HANDOFF.md`.

Raised 18 September 2026 while committing that record. Neither was noted at the
time, because the previous ruling named one note and adding uninstructed notes
to a routed document is not this session's call.

`docs/masthead-design-record-2026-09-16.md` is a dated record and most of it
has aged correctly. Two statements have not.

1. **Section 6, "Still open", first bullet.** It says the ramp amendment has
   not reached this repository and `docs/designdecisions.md` mentions neither
   the ramp, nor `styles.css`, nor `f2f2ca6`. That was true on 16 September and
   was closed by pull request 125 on 18 September, which put all three in that
   file. A reader working through section 6 today is told an item is open that
   is closed.

2. **Section 7, the radius paragraph.** It says zero radius on the marketing
   site "with the three circular contact badges as the documented exception".
   Three CSS rules carry a radius and four elements render rounded, because the
   homepage rule dresses the email and LinkedIn badges together. `CLAUDE.md`
   section 9a now carries the corrected count, ruled on 17 September. This is
   the smaller of the two: somebody counting badges on the site gets four and
   reads the rule as already broken.

Section 6's second bullet, the conditional on the divider's height, is still
genuinely open and wants no note.

- **What it blocks.** Nothing. Both are documentation drift in a dated record.
- **Recommended default.** One dated blockquote beside each, in the same form
  as the spacing note, and no edit to either body. Two blockquotes, five
  minutes. The alternative is to leave them, on the grounds that a dated record
  is allowed to be dated, which is defensible for section 6 and weaker for
  section 7, because section 7 opens by saying it is the section to read before
  writing the next change.
- **Cost if wrong.** Low both ways. Left alone, the next person writing a site
  changeset reads a badge count that is one out and an open item that is shut.

---

## Q9. The brief's page list and the repository's page list disagree

Raised 19 September 2026, applying the delivery page, wordmark and masthead
nav brief of 18 September, revised 19 September.

Changeset 1 says it touches "every page's masthead lockup. Currently
index.html and forecastability.html." The verify list then asks that "all
three pages' mastheads read 'Silurian PM' with the subline unchanged", and
changeset 3 asks for the two nav links, the hairline, `aria-label="Services"`
and `aria-current="location"` on `forecastability.html`.

**`forecastability.html` does not carry that lockup and never has.** It
carries the older single-link masthead: `.mast .wrap` as a flex row on
`--color-paper` with a 2px bottom seam, holding `.brand-home` and a "Back to
Silurian" link. There is no `.mast-bar` accent band, no `.mast-brand` grid, no
subline, no `.mast-rule` and no `.mast-nav`. `forecast-risk.html` carries the
same older masthead. So the lockup is on `index.html` and `delivery.html`, and
the brief's "currently index.html and forecastability.html" names one page
that has it and one that does not.

What was done, and what was not:

- **Done.** The wordmark string on `forecastability.html` is now "Silurian
  PM". That is one text node, needs no rule, and is what changeset 1 and
  changeset 3's branding paragraph both ask for by name.
- **Not done.** The nav, the hairline, the `aria-label`, the `aria-current`
  and the vertical centring on `forecastability.html`. There is nothing there
  to centre or to put a hairline into.

- **What it blocks.** Five of the brief's verify lines on one page, and the
  question of whether the site has one masthead or two.
- **Recommended default.** Give `forecastability.html` and `forecast-risk.html`
  the `index.html` lockup in a changeset of their own, and treat it as the
  masthead unification it is rather than as a nav tweak. It is not a small
  change: those two pages' mastheads sit on `--color-paper` with a 2px seam
  and the lockup sits on `--color-accent`, so adopting it changes the top of
  both pages from paper to orange, and both carry a "Back to Silurian" link
  that the lockup has no slot for. `delivery.html` solved that second part on
  18 September by keeping `.back` at the right of the bar, which is the
  pattern to copy. The brief's own constraint is why this was not done in this
  pass: "if the work appears to need a treatment the site does not have, stop
  and ask."
- **Cost if wrong.** Low now, higher later. Today the site has two mastheads
  and one wordmark, which reads as two generations of page rather than as a
  fault. Building the lockup into those pages under this brief, without the
  ground and back-link decisions being made, is how a third masthead gets
  created.

## Q10. Does the wordmark rename reach forecast-risk.html?

Raised 19 September 2026, same brief.

`docs/change-wordmark-silurian-pm.md`, committed 18 September, says the rename
is "index.html and privacy.html only. Not forecast-risk.html or
forecastability.html. Those two stay branded as Assay and are permanently out
of scope for this rename."

The 19 September brief reverses half of that. It names `forecastability.html`
in changeset 1, and changeset 3 says "the masthead wordmark is 'Silurian PM'
on every page including forecastability.html. Never swapped per page", with
"one wordmark, every page" in the rejected list. It does not mention
`forecast-risk.html` anywhere.

So `forecast-risk.html` is the one page whose masthead still reads "Silurian".
It was left that way in this pass: the brief's verify line counts three pages,
and the standing rule is not to widen a story beyond what it names.

- **What it blocks.** Nothing functional. One page out of five reads a
  different mark.
- **Recommended default.** Rename it too, in the same one-line change, when
  Q9 is answered. "Never swapped per page" is the rule the brief states, and a
  fifth page quietly exempt from it is the same shape of defect as the
  neutral ramp: a rule that is true everywhere somebody looked.
- **Cost if wrong.** One line to revert either way. The real cost is leaving
  the committed changeset doc saying "permanently out of scope" while the
  brief says the opposite, because the next session reads the doc.

## Q11. The footer's company details are a placeholder and UK law wants real ones

Raised 19 September 2026, carried from the brief's own out-of-scope note and
recorded here so it survives the conversation.

Every page's footer carries "Silurian Consulting LTD. Registered in England
and Wales, company number 17415387. Registered office, 22 Gelliwastad Road,
Pontypridd, CF37 2BW." The brief states the company number came from the old
template and is a placeholder, and that the site needs the full registered
name, the company number and a registered office address that are real.

Untouched in this pass, deliberately. The brief says do not invent them and
this session cannot verify them.

- **What it blocks.** Nothing on the build. It is a compliance item.
- **Recommended default.** James supplies the registered name, number and
  office from the incorporation documents, and they go in as one change across
  all five footers plus `privacy.html`'s body if it repeats them.
- **Cost if wrong.** A wrong company number on a live trading site is a
  statutory disclosure failure, not a typo. It is the highest-consequence
  open item on this list and the cheapest to close.

---

## Q9 and Q10, status on 19 September 2026

**Q9 is closed by the product owner, and one fact in it was wrong.**

He ruled the unification: `forecastability.html` now carries the same lockup as
`index.html` and `delivery.html`, with the two-link nav, the hairline,
`aria-label="Services"`, `aria-current="location"` on its own link and the nav
centred against the lockup. `forecast-risk.html` stays out, which is his
ruling and is what Q10 is about.

**The correction, which stays on the record rather than being edited into the
question above.** Q9 said adopting the lockup "changes the top of the page
from paper to orange", and the product owner restated that when he ruled it,
so he decided on it. **It is not true.** `.mast-bar` carries
`background: var(--color-accent)` in the stylesheet, which is what Q9 was
written from, and every page using it overrides that inline with
`style="background:var(--color-paper)"`. Read through `getComputedStyle`, the
bar computes `rgb(255, 255, 255)` on `index.html` and on `delivery.html`, and
`forecastability.html`'s old masthead computed the same white. **The ground did
not change.** What changed is the lockup, the nav and the seam moving from
`.mast` onto the bar.

The error was reading a rule instead of a rendered page, which is the same
failure section 13 of `CLAUDE.md` names about a check that reads nothing: a
declaration is not what the browser does with it. Q9 was written from the
stylesheet and should have been written from a render.

**Q10 is still open and has gained a second half.** `forecast-risk.html` is now
the only page whose masthead reads "Silurian" rather than "Silurian PM", the
only one still on the older single-link masthead, and, from this pass, the only
one whose back link still reads "Back to Silurian" rather than "Home".

The back link's label was left there deliberately. The instruction for this
pass said the label changes "on every page where it appears" and also said "do
not touch forecast-risk.html". Those disagree, and the standing rule is to
report a contradiction rather than pick the convenient reading.

- **What it blocks.** Nothing. One page of five now differs in three ways
  rather than one.
- **Recommended default.** Bring `forecast-risk.html` onto the lockup in one
  change, which settles the wordmark, the masthead and the back link together.
  It is the same port that was just done and it is now a known quantity. Doing
  the back link alone would close the smallest of the three gaps and leave the
  page looking half-converted.
- **Cost if wrong.** Low. The page's own content is untouched either way, and
  the port is reversible.

---

## Q10 is closed, and Q11 was wrong

Recorded 19 September 2026.

### Q10, closed

`forecast-risk.html` carries the same lockup as the other three: "Silurian PM",
the "Project & Programme Delivery" subline, the two-link nav with
`aria-label="Services"`, the hairline, the nav centred against the lockup, and
the back link reading "Home" with its destination unchanged. **Neither nav link
is current on this page**, because it is neither destination: it is the sample
analysis that `forecastability.html` links to twice.

**The record was read before anything was edited, as instructed, and nothing
still blocked it.** The only recorded reason was
`docs/change-wordmark-silurian-pm.md`: "Not forecast-risk.html or
forecastability.html. Those two stay branded as Assay and are permanently out
of scope for this rename." **That reason was already overturned for the sibling
page** by the ruling of 19 September, "one wordmark, every page, never swapped
per page", so it could not survive for this one on its own.

Nothing says the page is retired, redirected or deliberately separate. The
opposite: `docs/forecastability-page-spec.md` calls it "the sample analysis
page" and two live links point at it. `docs/designdecisions.md` parks four
issues on it for "a separate pass", and none of them is the masthead: they are
the status palette needing to be written down as a scoped exception, the 12px
label step carrying nine roles, the mixed third and first person voice, and the
borrowed-credibility note on TimesFM. **Those four are still open and this pass
touched none of them.** `docs/marketing-site.md` records that the page "keeps a
product voice on purpose", which is a copy rule, and no copy was written.

**The masthead unification is now complete.** Four pages carry the lockup and
`privacy.html` carries the small brand line, which nothing in this pass
changed.

### Q11 was wrong, and the product owner corrected it

Q11 said the footer carries "a placeholder company number from the old
template" and no registered office. **Both halves are false.** The product owner
confirmed on 19 September 2026 that company number 17415387 and the registered
office at 22 Gelliwastad Road, Pontypridd, CF37 2BW are the real details, live
and correct.

The footer already carries the registered name, the number and the office on
every page. **There is nothing outstanding and nothing to supply.**

The error came from the brief of 18 September, which described the number as a
placeholder, and it was carried into the questions file without being checked
against Companies House or put to the person who would know. **A compliance
finding is exactly the kind that should not be repeated on trust.** Reporting
it was right; asserting it as fact was not, and the two are a sentence apart.

Q11 as written above stays on the record with this correction beside it, which
is the rule in `CLAUDE.md` section 13. It is the second thing in two days
recorded as fact from a source rather than from a check, after Q9's
paper-to-orange claim, and both were reported to the product owner as settled
when they were not.
