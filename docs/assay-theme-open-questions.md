# Assay theme changeset: open questions

Raised by the build session, 16 September 2026, against the changeset
"Assay app theme and dashboard shell" and the covering brief that folds band
2.9 into it.

The brief has no band number yet. It needs one before it can be recorded.

**Band 2.9 is not blocked by any of this and has been built.** See
`docs/evidence/2.9-evidence.md`. Everything below is the theme half.

---

## Q1. The 4px radius contradicts a standing rule and the test that holds it

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

## Q2. Shadows and the 1px card border contradict the same section

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
