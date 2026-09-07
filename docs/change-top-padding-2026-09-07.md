# Change request: top padding on forecastability.html

Date: 7 September 2026
Page: `forecastability.html`, live
Scope: one CSS declaration. Nothing else on the page changes.

---

## The defect

The `SILURIAN ASSAY` kicker sits roughly 16px below the header seam. It should be 72px, matching the gap between the header and the first content on `index.html`. As shipped, the kicker reads as attached to the header rather than as the start of the page.

## The change

The page's first content section takes `padding-top: 72px`.

`72px` is the site's established section top padding, already recorded in the build spec under Global and already used on `index.html`. It is not a new value and it is not a token.

## What must not change

- The `80px` bottom padding on the section.
- The horizontal gutter, which stays on `--edge`, `clamp(20px, 5vw, 72px)`.
- Every other section's padding on the page.
- The header itself, and the seam under it.
- Any colour, type step, copy or layout value anywhere on the page.

## If the section currently has a top padding value other than 72px

Replace it. Do not add a margin on the kicker, do not add a margin on the section, and do not add a spacer element. The padding belongs on the section, so the ground colour runs to the seam.

## If the padding is 72px in the stylesheet but 16px in the browser

Then something is overriding it, most likely a shared first-child or section rule. Find the override and let the 72px win on the page rather than adding a second declaration on top of it.

## Verification

At desktop width, the distance from the bottom of the header seam to the top of the `SILURIAN ASSAY` cap height is the same as the equivalent distance on `index.html`.

## Controls

No colour, type step, radius or page-list control is affected. This change cannot fail one.

## Nothing else is being asked for in this request

Do not bundle any other fix, tidy or improvement with it. If something else on the page looks wrong, raise it separately.
