# Change request: email badge in the closing field, forecastability.html

Date: 7 September 2026
Page: `forecastability.html`, live
Scope: the closing accent field only. Section 9 of the build spec. Nothing above it changes.

---

## Why

The field instructs the reader to send a demand extract and gives them no way to send it. The only clickable thing in it goes to the sample analysis instead. The instruction and the mechanism are separated, so the primary action on the page cannot be taken.

## The change, in two parts

### 1. The statement loses its first clause

From:

> Send a demand extract and get the assessment back on your own products. Or look at the sample analysis first.

To:

> Get the assessment back on your own products. Or look at the sample analysis first.

Everything else about the statement is unchanged: `--text-title`, heading font at weight 800, `max-width: 34ch`, and "sample analysis first." stays a link to `forecast-risk.html` in `--color-paper` with a `2px solid var(--color-paper)` underline and the `&#8594;` arrow.

Add `margin-bottom: 32px` to the statement so it clears the badge below it.

### 2. An email badge goes below the statement

A single `<a href="mailto:hello@silurianconsulting.co.uk">`, `display: inline-flex; align-items: center; gap: 16px`, text `var(--color-paper)`, no underline.

Inside it, in this order:

**The badge.** `44px` by `44px`, `border-radius: 50%`, `background: var(--color-paper)`, `flex: none`, centring its glyph. It holds a `20px` envelope: a rectangle and the flap as a polyline, `fill: none`, `stroke: var(--color-accent)`, `stroke-width: 2`, `stroke-linecap: square`. Square caps, not round, because the site does not draw round ends.

**The label.** `--text-lead`, weight 800: `Send a demand extract`

## Address

`hello@silurianconsulting.co.uk`, confirmed by James for now.

## On the radius

`border-radius: 50%` on that badge is correct and must not be flattened to zero.

This is the site's existing agreed exception, not a new one. The exception covers the email and LinkedIn contact badges, and this is an email contact badge. `design-decisions.md` records it as agreed by James before design was involved and not up for revision.

No other corner on this page is rounded, and none should be.

## What must not change

- Every section above the closing field.
- The field's `background: var(--color-accent)`, its `32px 32px 48px` padding, its `72px` top margin.
- The `Next` kicker.
- The type step on the statement, and the fact that this field takes `--text-title` rather than `--text-poster`. Poster on this page is spent on the `92.5%` numeral, one poster per page.
- The `sample analysis first.` link, its wording, its target and its underline.

## What not to add

- No LinkedIn badge. Email only. The LinkedIn badge belongs to the homepage contact field, and this field is a single action plus a single alternative.
- No second copy of the sample analysis link.
- No `border-radius` anywhere else.
- No new token. Every value here is `--color-paper`, `--color-accent`, `--text-lead`, `--text-title`, or a literal px.

## Verification

- Clicking the badge or its label opens a mail client addressed to `hello@silurianconsulting.co.uk`.
- The badge and the label are one link, so the label is clickable too.
- The statement no longer contains the word "Send".
- Colour control passes: no raw hex, no `rgba()`.
- Type control passes: no raw `font-size`.
- The badge is the only rounded corner on the page.

## Nothing else is being asked for in this request

Do not bundle any other fix, tidy or improvement with it. If something else looks wrong, raise it separately.
