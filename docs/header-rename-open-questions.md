# Site header rename, open questions

Both questions are answered. Nothing here is waiting on anyone.

Format per CLAUDE.md section 1: what it blocks, the recommended default, the
cost if the default is wrong.

---

## Q1. Does the subline belong on the other three pages as well? Answered, no.

The brief says to change the site header and to add a subline under the logo
or header. The header exists on four pages. The rename was applied to all
four, because a header reading one name on the homepage and another on the
next page is not a rename. The subline was applied to the homepage masthead
only.

The reason is what the brand block is doing on each page. On the homepage it
is a lockup: the mark, the name, and now the line that says what the company
does. On `forecast-risk.html`, `forecastability.html` and `privacy.html` it
is a back link, sitting beside a second link that already reads "Back to
Silurian". A tagline inside a navigation control is clutter rather than
identity, and those three pages have their own subject in the first heading
below it.

**What it blocks.** Nothing. The rename is complete and consistent on its own.
This is whether the subline spreads.

**Recommended default.** Leave it on the homepage only. If the answer is that
it should be everywhere, the change is one wrapper and one shared rule, half
an hour including the render checks at four widths.

**Cost if wrong.** Low and reversible either way. Spread too far, the three
sub-page headers grow a line that repeats on every screen a reader passes
through. Left as it is, a visitor arriving straight on `forecastability.html`
from a search result sees the name without the line that says what the
company does, which the homepage would have told them.

**Answer, 16 September 2026.** The recommended default was taken. The product
owner ruled that the other pages are just Silurian. The subline is a homepage
thing and does not spread. Nothing to build: the site already reads this way,
and this entry records that it is a decision rather than an omission somebody
tidies up later.

---

## Q2. The date in the record. Answered, the 20th was wrong.

`PROJECT_HANDOFF.md` was headed "Last updated: 20 September 2026" and recorded
a Production phone check on that date, but every commit in this repository,
including the one carrying that entry, is dated 16 September 2026, which is
also this session's date. The two could not both be true, and a session that
cannot tell which is right does not get to pick, so this was raised rather
than corrected on the spot.

**What it blocks.** Nothing. It makes the record unreliable about when things
happened, which is what the record is for.

**Answer, 16 September 2026.** The product owner ruled the 20th wrong. Seven
dates in `PROJECT_HANDOFF.md` and two in `docs/production-smoke-test.md` now
read 16 September 2026. **The date is the only thing corrected**: the phone
check was run, it passed, and the device, the browser, the address and the
commit are untouched. Both files carry a note saying the date was wrong and
was corrected, because a correction nobody can see is indistinguishable from
the record having always said this.
