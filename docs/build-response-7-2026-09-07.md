# Build response 7: the forecastability page is built

From: the build session (Claude Code, marketing site repository)
To: the design session, via James
Date: 7 September 2026
Against: `docs/forecastability-page-spec.md`, version 2
Branch: `claude/silurian-marketing-site-wks2f7`

Built as specified. Version 2 answered all three blockers and needed no new tokens, exactly as it claimed. One conflict comes back, four decisions were mine to make, and one item is held.

---

## 1. Built

`forecastability.html`, the site's fourth marketing page. All nine sections in the order given, all copy verbatim.

**No new tokens.** No neutral ramp, no spacing scale, no `styles.css`, and `--color-accent-700` appears nowhere. Every colour is one of the nine tokens in your table and every size is a step.

**The chart holds level.** The two outcome boxes finish at exactly the same pixel at 1440, delta 0. The `flex: 1` connector does the work, and the comment in the CSS says what happens if anything is added after an outcome box, including that it cost 37px last time.

**Controls, in the order you set.** The colour control and the type scale control both passed on the page **before** it was added to `EXPECTED_PAGES`. Then the page list moved from three to four. Not the reverse.

Both were then proved to cover the new page rather than assumed to: a raw `12px` planted on it fails the suite naming the value, and the file is byte-identical after reverting.

Suite: **222 tests, passing.** Rendered at 1440, 768, 390 and 320: no failed request, no horizontal overflow, Archivo loaded at every width.

## 2. One conflict

**The poster step is not used once on the site. It is used three times.**

The spec says, under Type: "`--text-poster` is otherwise used once on the site, on the homepage closing accent field."

It is on:

1. `index.html`, the closing accent field
2. `forecast-risk.html`, the closing accent field, applied on 6 September when the poster step was created
3. `forecastability.html`, the `92.5%` numeral, as this spec asks

So the reasoning in the note, that this page's closing field takes `--text-title` "so the homepage keeps the one poster line", is built on a premise that was already untrue when it was written.

**Nothing is broken.** All three render at their intended sizes and nothing changed on the existing pages. But this is the third time the question from build response 3 has surfaced without an answer: **is poster once per site, or once per closing accent field?** Under the second reading everything is already correct. Under the first, `forecast-risk.html`'s closing line needs a different step and this page's numeral is the sole poster use.

I have changed nothing while it is open.

## 3. Four things the spec did not cover, decided and flagged

1. **Title and meta description.** Not specified, and every page needs both. Title: "Not every product can be forecast | Silurian Consulting LTD". Description: drawn from the standfirst, trimmed to a sensible length. Both are client-facing copy on a page whose copy is signed off verbatim, so they should be read by someone who signs copy.
2. **The stacking width.** The spec gives desktop only. Below 860px the intro row, the chart, the two-column sections and the bridge all collapse to one column, and the `flex: 1` connector releases. That width is a judgement, chosen so the chart's two columns never get narrower than the node copy can carry.
3. **Header and footer.** Not specified. The page carries the site masthead with the single-link brand block, plus a "Back to Silurian" link matching `forecast-risk.html`, and the standard footer.
4. **The `1fr 1fr` grid for "Does this look familiar?"** is built as written, with the line in the first cell and the second cell empty, so it sits under the left column and cannot compress the chart.

## 4. Held, not done

**The header label.** The nav now points at `forecastability.html`, as decided. The label still reads "AI Demand Forecasting". Your settled list changes it to "AI Forecast Diagnostic" and notes it is made wherever the live header is served from, which is `index.html`. That is live copy on the homepage, so it goes through James rather than arriving inside a page build. One word, ready when he says.

## 5. Standing, from earlier responses

The M5 figures are still unverified. Outbound network is blocked here, so 92.5 per cent, two thirds, one half and the *International Journal of Forecasting* citation cannot be checked from this environment. They are now on a page that is one merge from public. This is the third response to raise it.

The two contrast exceptions are built as recorded: white on accent at 3.18:1 for the kicker and node copy, and the numeral at 2.85:1. Both deliberate, neither touched.

## What this session cannot verify

No access to the live site, any preview, or a real device. Every measurement is headless Chromium against the branch, which does not reproduce platform control styling. This page has no form controls, so that gap is narrow here, but the two accent fields carry white text at a contrast below the normal floor and only a real screen shows how that reads.
