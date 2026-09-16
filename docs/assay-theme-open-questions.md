# Assay theme changeset: open questions

Raised by the build session, 16 September 2026, against the changeset
"Assay app theme and dashboard shell" and the covering brief that folds band
2.9 into it.

The brief has no band number yet. It needs one before it can be recorded.

**Band 2.9 is not blocked by any of this and has been built.** See
`docs/evidence/2.9-evidence.md`.

**Q1, Q2, Q8 and Q9 are answered.** All four on 16 September 2026. The
product owner amended `CLAUDE.md` section 9 rather than overruling the first
objection, and the amendment plus the two later rulings are recorded there as
section 9a. Every answer is kept below with its original question as written,
because the next reader needs to know each was argued for and granted rather
than assumed.

**Q3 was answered on 16 September 2026** with three rulings and a two pass
split. Q4 to Q7 are still open. **Q10 and Q11 are new and come out of building
pass 1.** Q10 is the one that needs an answer, because pass 1 ships a token
value the product owner has not approved.

---

## Q1. ANSWERED. The 4px radius contradicts a standing rule and the test that holds it

**Answer, 16 September 2026.** The product owner amended section 9. Zero
radius remains the rule for the marketing site, and Assay is now a documented
exception at 4px on cards, buttons and inputs, 3px on badges, never higher
than 4px. The rule was amended first and the tests were changed afterwards,
in that order, which is the only order that makes the amendment mean
anything.

`*{border-radius:0!important}` has been removed from the Assay page and the
gate screen, because it was the specific mechanism making 4px impossible. The
two string assertions that held it are replaced by
`test_no_radius_exceeds_the_assay_bound`, which holds the 4px ceiling instead
of one pinned value. Removing the reset changed nothing that renders: all 1174
control readings across ten screens compute the same radius, colour, fill,
appearance and border colour as before, and every radius on the page is still
`0px`.

**The original question is kept below as it was written.**

---

**What it blocks.** The whole theme. Radius is the changeset's defining
instruction and the first line of its "What the app releases" table.

**The contradiction.** `CLAUDE.md` section 9 says "Zero radius everywhere",
and names `test_workspace_uses_approved_visual_tokens` as enforcing it. That
test asserts the literal string `*{border-radius:0!important}` is present in
the Assay page. `test_access_gate.py` asserts the same string a second time.

The `!important` matters. It is not a default that a later rule can beat. A
card written as `border-radius:4px` renders square regardless, so the theme
cannot be applied at all without deleting that line, rewriting section 9 and
editing two tests that exist to stop exactly that edit.

The covering brief lists four things the restyle must not break. This is not
among them, so the brief has most likely not seen it.

**Recommended default.** Do not apply the radius, and do not touch the two
tests, until the product owner has changed section 9 in writing. Section 4 of
`CLAUDE.md` calls editing a control to make a build pass "the one
unrecoverable move here", and while this is a visual token rather than a
fixture, the shape of the move is the same one.

**Cost if wrong.** Low and recoverable. If the answer is that section 9 should
change, the radius is a one line edit to the stylesheet plus two test edits,
maybe twenty minutes. Nothing else in the theme depends on it.

---

## Q2. ANSWERED. Shadows and the 1px card border contradict the same section

**Answer, 16 September 2026.** Granted in the same amendment. Section 9a now
allows one shadow step in Assay, at the values in the approved changeset and
with no second step, and 1px rules inside the app with the 2px ink rule
retained on the page header only.

No test holds either half yet, and Q8 below explains why the shadow half
cannot be tested until somebody decides what to do about the sticky header.

**The original question is kept below as it was written.**

---

**What it blocks.** The card treatment, which is most of the remaining theme.

**The contradiction.** The changeset puts one elevation step on cards and
replaces the 2px seams with 1px `#e3dfdd` borders, keeping 2px ink on the page
header only. Section 9 says structure is "drawn with 2px solid rules on seams
and 1px hairlines inside tables, not floated on shadows", and calls that "the
single biggest difference from a generic dashboard". No test holds it, which
by the standing rules means it deserves more care rather than less.

**Recommended default.** Same answer as Q1 and for the same reason: it is one
decision, not two. The changeset's own argument for the divergence is good and
worth reading on its merits. The site is read once at arm's length and the app
is read daily at close range, and that is a real difference. But it is the
product owner's decision to make, in section 9, not a decision to arrive at by
applying a mock.

**Cost if wrong.** Low. The card rules are confined to a handful of selectors.

---

## Q3. "Styling only, same screens, same words" removes most of the changeset

**What it blocks.** Knowing what is actually left to build.

**The problem.** The changeset describes a dashboard that does not exist: a
232px sidebar with two nav groups and six links, three top-line metric cards
with named figures, an actual-against-forecast chart with a legend and an
interval band, and a five column product table. Assay today is a masthead, a
single file form, a portfolio form and an eight tab workspace. Under the
correction, all of that structure is out of scope.

What survives as pure styling, mapped onto screens that exist, is roughly: the
table header fill and the 1px row rule and row hover, `--control-border` on
inputs, `--accent-pressed` on button hover, and the type scale. Of those, only
the table treatment is compatible with section 9 as written, because section 9
already allows 1px hairlines inside tables.

The slate family is a separate problem. It is defined in the changeset as
"sidebar ground", and there is no sidebar. Section 9 also says tokens are
lifted from the marketing site and not invented, and the slate is invented.

**Recommended default.** Answer Q1 and Q2 first, then reissue the theme as a
list of rules against the screens that exist. A mock for a different
information architecture cannot be read as a stylesheet for this one without
somebody deciding, line by line, what it means here, and that decision belongs
with the planning session rather than the builder.

**Cost if wrong.** Moderate, and this is the expensive one. Guessing produces
a restyle that has to be redone once the real rules arrive.

---

## Q4. The brief contradicts itself on whether the theme adds controls

**What it blocks.** Nothing on its own. It needs a one line answer.

**The contradiction.** The brief says "Same screens, same panels, same
columns, same strings, same order, same behaviour", and then, four paragraphs
later, "the new theme adds nav items, badges and two button styles". Nav items
and two button styles are new controls with new labels.

**Recommended default.** Read the second sentence as describing the changeset
rather than the approved scope, and treat nav items as out. That is consistent
with the correction and with the rest of the brief.

**Cost if wrong.** Low.

---

## Q5. The primary button label in the changeset fails contrast

**What it blocks.** Nothing yet. It is a defect in the changeset to fix before
the theme is applied.

**The problem.** The changeset specifies the primary action as "accent fill,
white label". White on `#ec6917` measures 3.18:1, below the 4.5:1 needed for
body sized text. The marketing site hit this exact problem on 6 September and
settled it: the label became `--color-charcoal-deep`, recorded in
`PROJECT_HANDOFF.md` as "the only ink reaching 4.5 against the accent at 15px
bold". Assay's equivalent token is `--ink-deep`, the same value, and band 2.9
has now used it for the same reason.

The verdict badges in the changeset are fine. White on the three status tokens
measures 6.28:1, 5.46:1 and 7.12:1.

**Recommended default.** Correct the changeset to `--ink-deep` on accent fills
and leave white on the status tokens. Band 2.9 already ships this, so if the
theme is applied as written it would undo it.

**Cost if wrong.** An inaccessible primary action on every screen.

---

## Q6. The abandoned palette is still painting two charts

**What it blocks.** Nothing. This is a finding, not a question, and it is
recorded here because fixing it was out of band 2.9's scope.

**What was found.** Band 2.9 asked for the dead `:root` block to go, because
it carried the abandoned Claude Design palette and was one edit away from
being live. That is done. But the same three values are also written as raw
hex literals in the JavaScript that draws the two charts on the single file
diagnostic screen, where they are not one edit away from being live. They are
live now.

```
$ grep -o '#ee7623\|#201e1d\|#68615e' forecast-app/static/index.html | sort | uniq -c
      2 #201e1d
      6 #68615e
      4 #ee7623
```

Twelve literals, on three lines, all inside `demandChart` and
`inventoryChart`. The old accent `#ee7623` draws the forecast line, the
forecast area fill, the inventory line and a period label. The old ink
`#201e1d` draws the history line and the healthy inventory markers. The old
muted `#68615e` draws the axis labels and the handover divider. So that
screen renders the abandoned accent next to the live one.

**Recommended default.** Fix it in the theme band, which is touching colour
anyway, by replacing the twelve literals with `var(--accent)`, `var(--text)`
and `var(--muted)`. It was left out of band 2.9 because the band named the `:root`
block and section 4 says a brief that names three things wants three things,
and because it is a visible change to a screen rather than a no-op.

**Cost if wrong.** Cosmetic but embarrassing, and it will outlive anyone who
remembers why.

---

## Q7. Four tokens are declared and never used

**What it blocks.** Nothing. Noted so the next reader does not have to work it
out again.

`--accent-600`, `--neutral-brand`, `--radius-sm`, `--radius-md` and
`--radius-lg` are declared in the consolidated `:root` and referenced nowhere.
They were carried forward by band 2.9 rather than pruned, because pruning them
was not what the band asked for. The three radius tokens in particular are
worth a decision alongside Q1, since they are all zero and the theme would
make them non-zero.

---

## Q8. ANSWERED. The app already has a shadow, and the rule now says there is only one

**Answer, 16 September 2026.** The recommended default was taken. Section 9a
now reads "one card elevation step", and the sticky run context bar is outside
that rule and keeps its own shadow, because marking where a bar scrolling over
content ends is a different job from lifting a card off the page.

The shadow half of section 9a is now testable and is tested.
`test_no_shadow_beyond_one_card_step_and_the_sticky_bar` permits exactly two
values and nothing else. `test_there_is_no_second_card_elevation_step` counts
the distinct non-sticky values and allows one, so two selectors sharing a
value are one step and two different values are two.

Proved able to fail against the real page three ways: a second elevation on a
real panel, the approved elevation alongside a plausible second one, and the
sticky bar's own shadow removed. The page was restored after each.

**What the test cannot do.** It reads declarations, not what they are applied
to, so it would not catch the card elevation being spent on something that is
not a card, and it permits the sticky bar's value by name rather than by where
it sits. Recorded in section 9a rather than left to be discovered.

**The original question is kept below as it was written.**

---

**What it blocks.** Writing a test for the shadow half of section 9a, and
building the card treatment.

**The problem.** Section 9a, as amended, allows "one shadow step, the values
in the approved changeset, and no second step". The changeset's value is
`0 1px 2px rgba(26,33,41,0.06), 0 2px 8px rgba(26,33,41,0.04)`, on cards.

Assay already carries a different one:

```
.workspace-sticky{position:sticky;top:0;z-index:40;box-shadow:0 4px 10px rgb(26 25 24 / 10%)}
```

That is the sticky run context bar, and its shadow is doing a different job:
it separates a bar that scrolls over content from the content passing under
it. It is not a card elevation. So either it is the second step the rule
forbids, or it is not a step at all and the rule means card elevation only.

**Recommended default.** Read the rule as card elevation only, and keep the
sticky shadow as the separate thing it is, but say so in section 9a rather
than leaving it to be worked out again. A sticky bar with no shadow has
nothing to mark where it ends, and removing it would be a real regression to
buy a rule that was written about cards.

**Cost if wrong.** Low either way, but the test cannot be written until it is
decided, and an untested half of a rule is how the first one drifted.

---

## Q9. ANSWERED. Nothing enforces zero radius on the marketing site, and three badges already break it

**Answer, 16 September 2026.** Recorded, and stopped there. Writing the scan
is the site session's work and not an app band's, and the product owner does
not want a control written against three shipped pages inside a band about the
app.

**Two things are settled for whoever writes it.** The three circular contact
badges in `index.html`, `forecast-risk.html` and `forecastability.html` are the
**documented exception** to zero radius on the marketing site. The scan must
**allow them by name** rather than failing on them. A control that fires on
approved, shipped pages gets an exclusion bolted on in a hurry, and an
exclusion added under pressure is how the Assay page ended up with an
exemption that had to be deleted on 6 September.

Recorded in `CLAUDE.md` section 9a so it does not live only here.

**No scan was written. The marketing site half of the radius rule is still
enforced by nobody.**

**The original question is kept below as it was written.**

---

**What it blocks.** Nothing. It is a gap that the amendment made visible.

**The problem.** Section 9 said "zero radius everywhere" and named
`test_workspace_uses_approved_visual_tokens` as enforcing it. That test only
ever read the Assay page. So the marketing site half was never enforced, and
splitting the rule in two has not removed any control, it has only made the
gap easy to see.

The site also carries three circular badges:

```
index.html:232          border-radius: 50%
forecast-risk.html:99   border-radius: 50%
forecastability.html:162 border-radius: 50%
```

All three are contact or mail badges and all three predate this file. They are
an unrecorded exception to "zero radius everywhere", and a scan written to the
letter of the rule would fail on shipped, approved pages.

**Recommended default.** Add a marketing site radius scan that permits `50%`
on a badge and nothing else, and record the circle exception in section 9. I
have not done it here, because writing a control that fires on three shipped
pages is not a thing to do without being asked, and because the brief was a
restyle of Assay.

**Cost if wrong.** Low now, higher later. The site's half of the rule is the
half with no test, and section 9 says a rule with no test behind it deserves
more care rather than less.

---

## Q10. ANSWERED. The changeset's row rule is invisible on Assay's panels

**What it blocks.** Nothing, because pass 1 ships a derived value rather than
waiting. It needs confirming or overruling, and it is the one thing in pass 1
that was not built as specified.

**The problem.** The changeset sets `--row-rule: #eeebe9` and puts cards on
white. Assay's tables sit on `--surface` `#eae9e9`, because section 9 puts
panels **darker** than the page, which the changeset's own note calls out as
inverting the usual expectation.

So the value lands on the wrong side of its ground:

| Row rule | Against | Ratio | Side |
| --- | --- | --- | --- |
| `#eeebe9`, the changeset value | its white card in the mock | 1.19:1 | darker than the ground |
| `#eeebe9`, the changeset value | Assay's `--surface` `#eae9e9` | 1.02:1 | **lighter than the ground** |
| `#aaaaaa`, what Assay has today | `--surface` | 1.92:1 | darker |
| `#dcd9d7`, shipped in pass 1 | `--surface` | 1.16:1 | darker |

Built and looked at rather than argued from the numbers alone. With `#eeebe9`
the row division is not faint, it is **gone**: the only horizontal line left
in a row is the sparkline's own baseline, which is not a row division and
reads as one. A three way crop of the same four rows is in the pull request.

**What was done and why it was not left alone.** `#dcd9d7` holds the
changeset's own relationship, a rule just over 1.1:1 and darker than its
ground, against Assay's surface instead of the mock's white card. It is
derived, not chosen, and it is not an approved value. It is flagged in a
comment beside the token, in the pull request and here.

Shipping `#eeebe9` would have removed the row divisions from the four densest
screens in the product, which is the opposite of what the changeset argues
for. Reverting to `#aaaaaa` would have meant the product owner looked at pass
1 and saw no table change at all, which was the point of the pass.

**Answer, 16 September 2026.** `#dcd9d7` approved. The product owner ruled
that deriving by holding the changeset's own relationship against Assay's
ground is the correct method, and that copying a value picked against white
onto a darker panel is not. The principle is now in section 9a with
`--row-rule` as the worked example.

**The wider point, worth more than the value.** Every colour in the changeset
was chosen against a white card ground. Assay's panels are darker by standing
rule. `--card-border` `#e3dfdd`, `--row-hover` `#f7f6f6` and `--slate-tint`
`#e8eaed` are all lighter than `#eae9e9`, so each one lands on the wrong side
of its ground in the same way `--row-rule` did. `--row-hover` survives because
a hover **should** be lighter than the row it lifts. `--slate-tint` as a table
header fill will not: a header fill lighter than the table it heads inverts
the relationship the mock intends. **Check that before pass 2 rather than
during it.**

**Cost if wrong.** Low for the value. Higher for the wider point, because it
affects every remaining colour in the theme.

---

## Q11. Pass 1 or pass 2 for the table header fill

**What it blocks.** Nothing. Pass 1 was built on the conservative reading.

**The problem.** The two pass split puts "the table treatment on all four
grids" in pass 1 and "`--slate-tint` under ruling 1" in pass 2.
`--slate-tint` **is** the table header fill, so the two lists overlap.

**What was done.** The explicit pass 2 listing was followed. Pass 1 ships the
row rule and the row hover and no header fill, and ruling 1 is held complete
for pass 2: the token, the note recording it as the only member of the slate
family adopted, and the line in section 9a permitting it by name.

That reading also makes the passes coherent in their own right. Pass 1 only
takes weight away, quietening rules and borders. Pass 2 adds: the header fill,
the radius, the elevation and the type. The header fill and the 11px/700
header type are one treatment in the changeset, and pass 1 excludes type
changes, so splitting them would have shipped half of it.

**Recommended default.** Leave it as built. If the header fill was wanted in
pass 1, it is one rule and one token.

**Cost if wrong.** One round trip.

---

## Q12. ANSWERED. The invented tokens are not only the slate family

**What it blocks.** Nothing. Recorded so section 9 and the code do not drift
apart.

**The problem.** Section 9 says tokens are lifted from the marketing site and
not invented. Ruling 1 grants `--slate-tint` an exception by name. But
`--row-rule`, `--row-hover`, `--control-border` and `--accent-pressed` are
inventions too, adopted in pass 1, and no ruling covers them.

**What was done.** Section 9a gains one line permitting the app only token
additions as a category, naming the four adopted in pass 1 and recording
`--slate-tint` as ruled in and arriving in pass 2. That extends ruling 1's
reasoning to its siblings rather than leaving four tokens in breach of section
9 with nothing written down.

**Answer, 16 September 2026.** Kept, and explicitly not trimmed. The product
owner ruled that naming all five and ruling the other five slate members out
fills a gap in ruling 1 rather than exceeding it: `--row-rule`, `--row-hover`,
`--control-border` and `--accent-pressed` are inventions exactly as
`--slate-tint` is, and ruling 1 granted one by name and left four unnamed.

**Cost if wrong.** Low, and it is a documentation line rather than code.

---

## Q13. --slate-tint, re-derived. Answer needed before pass 2

**What it blocks.** The table header fill, which is the first item in pass 2.
Ruling 2 says report the derived value and the reasoning before applying it,
so nothing has been applied. A preview was rendered and reverted.

**Why it needed re-deriving.** `#e8eaed` measures **1.005:1** against
`--surface`. That is worse than the row rule was. It is not a faint fill, it
is the same lightness as the table it heads, so there would be no header band
at all.

**The derivation, by the section 9a method.**

| Step | Value |
| --- | --- |
| The changeset's fill against its white card | `#e8eaed` is 1.205:1 and **darker** |
| Its deliberate cool cast, held | blue over red `+5`, chroma 5 |
| The same ratio solved against `--surface` `#eae9e9` | target luminance 0.6689 |
| Neutral at that luminance, plus the cast | **`#d4d6d9`** |
| What it actually measures | 1.202:1 against `--surface`, cast `+5` |

**Checked against everything it sits beside.**

| Against | Ratio | Note |
| --- | --- | --- |
| `--surface` `#eae9e9`, the table it heads | 1.20:1 | reads as a band |
| `--bg` `#f3f2f2`, the page behind the panel | 1.30:1 | |
| `--row-rule` `#dcd9d7` | 1.04:1 | fill darker than rule, the same order as the mock's 1.016:1 |
| `--text` `#3f3d3b`, the header label | 7.43:1 | well over the floor at 11px bold |

**It works, and it was looked at rather than argued from the numbers.** The
preview render is in the report: the header reads as a distinct band, the
label holds, and the cool cast is subtle but present against the warm body.

**One thing it breaks, and the fix by the same method.** `.sort-button:hover`
is `#dedcdc`, which today darkens from `--surface` by 1.127:1. Against the new
fill it is 1.07:1 and **lighter**, so the sort hover would almost vanish and
would be on the wrong side of its ground, which is the Q10 mistake again.
Re-derived by the same three steps: **`#c8cacd`**, 1.128:1 darker than the
fill, header label at 6.58:1.

**The finding worth more than either value.** In the changeset `--slate-tint`
has **three jobs**: table header fill, chart gridlines, and hovers. Those sit
on three different grounds. Re-derived against `--surface` it is right for the
header fill and wrong for a gridline on `--paper` `#fff`, where the original
`#e8eaed` is correct as drawn. **One token cannot do all three in Assay.**
Ruling 1 says keep the name so the code and the design document agree, so the
recommendation is to keep the name and narrow the job.

**Recommended default.** Adopt `--slate-tint: #d4d6d9` for the table header
fill only, take `#c8cacd` for the sort hover, and record in section 9a that
the gridline and hover uses in the changeset are not this token's job. If a
gridline value is wanted later it is a separate derivation against `--paper`,
and it is not needed until something draws gridlines.

**Cost if wrong.** Low for either value, one line each. Higher for the three
jobs point: leaving one token doing three jobs on three grounds is how the
next invisible fill happens.

---

## Q14. Four heavy seams, and one of them carries state

**What it blocks.** Ruling 4. The product owner asked what each of the four
selectors dropping from 4px or 5px marks, and is not ruling on them by rule.

**The four, and a fifth at 3px.**

| Selector | Now | What it marks |
| --- | --- | --- |
| `.validation-panel` | 5px | The validation result. **This one carries state**, see below |
| `.bundle-view` | 5px | A recorded run reopened from a bundle. It marks a change of mode: you are reading a run off a file rather than one you just did |
| `.bundle-centre` | 4px | The portable run record block on Provenance, where you keep, reopen or reproduce a run. It divides the readout from the tools |
| `.provenance` | 4px | The provenance panel, what produced this result |
| `.chart-card` | 3px | The two charts on the single file screen. Listed because it is also above 2px |

**`.validation-panel` is not decoration and dropping it to 1px costs
something specific.**

```
.validation-panel{border-top:5px solid var(--text)}
.validation-panel.reject{border-color:var(--bad)}
.validation-panel.accept_with_warnings{border-color:var(--warn)}
.validation-panel.accept{border-color:var(--good)}
```

The border **is** the verdict. It is red on a reject, amber on accept with
warnings, green on accept. At 5px it is the first thing you see on the panel.
At 1px it is a hairline, and the verdict then rests on the badge text alone.

Section 9 says state is encoded twice on every row, colour and words, so that
removing colour entirely leaves the screen fully readable. Dropping this to
1px does not break that rule, because the words are still there. It weakens
the colour half to the point where it stops doing work, on the one panel whose
job is to say whether the file can be used at all.

**Two more carry state the same way and are outside ruling 3's categories**,
because they are left borders rather than top: `.quality-exception` at 4px
`--warn`, and `.bundle-warning` at 5px `--warn`. Neither is touched by ruling
3 as written. Listed so nobody assumes they were covered.

**Recommended default.** Drop `.bundle-centre`, `.provenance`, `.bundle-view`
and `.chart-card` to 1px as ruling 3 says. **Hold `.validation-panel` at its
current weight** and record it in section 9a as a marker that carries state
rather than divides a block, which puts it outside category A for the same
reason the page header is. A hairline that changes colour is a rule with a
tint, not a verdict.

**Cost if wrong.** For the four, low and visible: they are dividers and the
screen still reads. For `.validation-panel`, the reject verdict stops
announcing itself on the one screen where a user most needs to notice it.
