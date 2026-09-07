# Silurian project handoff

Last updated: 6 September 2026

This is the recovery and transfer document for the Silurian website and Forecast Diagnostic. It must be reviewed and updated as part of every build, including small website changes. A new Codex task or another AI system should read this file before making changes.

## Current position

- Email badge added to the closing field on `forecastability.html`, 7 September 2026: the field told a reader to send a demand extract and gave them no way to send it, the only clickable thing in it going to the sample analysis instead. The statement drops its first clause and now reads "Get the assessment back on your own products. Or look at the sample analysis first.", and a single `mailto:` link sits below it carrying a 44px round white badge with a 20px envelope stroked in the accent, square caps, beside the label "Send a demand extract". Badge and label are one anchor, so the label is clickable. Address `hello@silurianconsulting.co.uk`. The badge's `border-radius: 50%` is the site's existing agreed exception for email and LinkedIn contact badges and must not be flattened. It is the only rounded corner on the page, confirmed by walking every element's computed style rather than by reading the CSS. One defect was introduced and caught by looking at the render: `.close a` gives every anchor in that field a 2px underline for the sample analysis link, and it outranks a bare `.mail-link`, so the badge arrived underlined against a spec that asks for none. Fixed by matching the specificity. **That is the second specificity defect on this page in one evening, and both looked correct in the source.** Verified against the request's own list: the mailto target, badge and label as one link, the statement no longer containing the word Send, no raw hex, no `rgba()`, no raw `font-size`, and the badge as the only radius. Nothing above the closing field changed, and the four-width render is otherwise unchanged with the chart outcomes still level at 1440. The suite is 224 tests and passes. Production verification outstanding.
- Forecastability release evidence, 7 September 2026: two merges. Pull request 91, merge `c04ba93f67ad681aecf4971e80c21fafe3acc764`, carried the spec, the page, the header strapline change to AI Forecast Diagnostic and the copy approvals. Pull request 92, merge `a48f6c09459ed6d345ec25cbe693b009755143cd`, carried the poster rule and the top padding fix. Both landed byte identical to the tree the suite passed on, 222 tests and 224 tests respectively. `main` moved under this branch three times during the work, twice from another session adding the plain language rule to `CLAUDE.md` and once from pull request 91's own merge commit. Each time `main` was merged in and the suite re-run before merging, so neither merge landed a tree that had only been tested in isolation. The product owner reviewed the live page and reported one defect, the kicker sitting against the header seam, which is the padding fix in pull request 92. He confirmed everything else on the page as correct. **Which widths and devices he used are not recorded, because he did not state them.** The orange panels carry white text below the normal contrast floor by deliberate decision, and whether that reads acceptably on a real screen is still the one thing on this page nobody has confirmed. Production verification of the padding fix itself is outstanding: it merged after his review, so what he looked at was the page with the defect still in it. Open and unstarted: the four `forecast-risk.html` items the design session scoped as a separate pass, and the two `CLAUDE.md` rules that describe a site that does not exist, zero radius and no status palette. Both are shared-file changes the product owner routes.
- Top padding defect on `forecastability.html` fixed, 7 September 2026: the product owner reported the Silurian Assay kicker sitting against the header seam instead of 72px below it, and the cause was not the value. The page declared `main { padding: 72px 0 80px }` and the browser computed `0px 72px`: `.wrap` is a class selector and `main` an element selector, so `.wrap { padding: 0 var(--edge) }` took the whole shorthand and the top and bottom padding never applied at all. The stylesheet said one thing and the render did another, which is the case the change request anticipated. Fixed by matching the specificity, `main.wrap { padding: 72px var(--edge) 80px }`, rather than stacking a second declaration on top, which would have produced the right pixels and hidden the cause. The 860px rule had the same defect and is corrected in the same way. The 80px bottom padding was also not applying and is restored by the same fix; that is stated because the change request asked for it not to change and it had in fact never been in effect. Verified by measurement: the distance from the header seam to the first content is now 72px on `forecastability.html` and 72px on `index.html`, which is the request's own acceptance test. Nothing else on the page moved, the four-width render is unchanged, the chart outcomes still finish level at 1440 with a delta of 0, and no control is affected. Two lines changed, nothing bundled with them. The suite is 224 tests and passes.
- Poster rule settled and enforced, 7 September 2026: the design session answered the question raised in build responses 3, 7 and the pull request 91 body. Poster is one per page, on the single loudest element, and is not welded to any component. Not once per site, which makes the step unusable once a fourth page exists. Not once per closing panel, which welds a size to a component. **No page changed.** The built site already satisfied the rule, confirmed by measuring rendered elements at 1440 rather than by reading the source: `index.html` spends poster on its closing line, `forecast-risk.html` on its closing line, `forecastability.html` on the 92.5 per cent numeral with its closing field on `--text-title`, and `privacy.html` spends none. The rule is recorded beside the steps in `tokens.css` with both rejected readings and the reasons, and `test_a_page_spends_poster_at_most_once` now holds the count. Proved by planting a second poster use on `forecastability.html`'s closing field, the exact mistake the rule prevents, and watching the suite fail, then reverting. The control counts declarations rather than rendered elements and says so: one declaration matching several elements passes, which on `index.html` is correct, because its closing line is one heading set in two spans. Two elements competing for poster is a copy problem no test can see, and the design session's own test for that is a copy test. The suite is 224 tests and passes.
- Forecastability page copy approvals, 7 September 2026: the two lines this build session wrote, which no signed-off copy covered, are approved by the product owner as written. The title is "Not every product can be forecast | Silurian Consulting LTD" and the meta description is "Assay reads a demand extract and tells you which products you can forecast, which you never will, and which you have not got the history to judge.", 146 characters, cut from the standfirst to fit a search result. The M5 statistics are approved by the product owner on the same date: 92.5 per cent, two thirds, half, and the three and forty per cent figures in the second column, together with the *International Journal of Forecasting* 2022 citation. **Provenance, recorded because it matters: he verified them in a separate Claude research session, not in this one. This build session has never seen the source and cannot reach it, since outbound network is blocked here.** The approval is his, the verification is his, and nothing in this repository should be read as this session having checked them. Raised in build responses 6 and 7 and closed here.
- Header strapline changed, 7 September 2026: the homepage nav link reads AI Forecast Diagnostic, the design session's settled wording, approved by the product owner and applied the same day. It read AI Demand Forecasting from 4 September. The destination changed in the same batch, to `forecastability.html`. Only `index.html` and the site record are edited. The earlier handoff entries describing the 3 and 4 September releases still say AI Demand Forecasting and are left alone, because they were true on their dates and belong to the sessions that wrote them. The design spec and the build responses that quote the old label are likewise untouched, being sent documents rather than descriptions of the current state.
- Forecastability page built, 7 September 2026: `forecastability.html` is the site's fourth marketing page, built from version 2 of the spec at `docs/forecastability-page-spec.md`, which answered all three blockers from build response 6 and is expressed entirely in live `tokens.css` names. No new token was needed, no neutral ramp, no spacing scale, and the red from the deleted export never appears. The header link on `index.html` now points at the new page; `forecast-risk.html` becomes the page a reader arrives at from it, through the two links in the bridge row and the closing field. The header label is unchanged, because the settled change to AI Forecast Diagnostic is live copy and is held for the product owner. The page passes the colour control and the type scale control as built, before being added to `EXPECTED_PAGES`, which is the order the site record requires: on tokens first, pinned second. Both were then proved to cover it, by planting a raw 12px size on the page and watching the suite fail, then reverting. `test_the_scan_actually_reads_the_pages` no longer carries its own copy of the page count and derives it from `EXPECTED_PAGES`. Verified in a browser at 1440, 768, 390 and 320px: no failed request, no horizontal overflow, Archivo loaded, and the two chart outcome boxes finish exactly level at 1440, delta 0px, which is the spec's one structural requirement. Below 860px the columns stack, so the level finish does not apply there. One conflict is reported rather than reconciled, in `docs/build-response-7-2026-09-07.md`: the spec says the poster step is otherwise used once on the site, on the homepage closing field. It is also on `forecast-risk.html`'s closing field, applied on 6 September. Poster is therefore on three elements across three pages, not two. The unanswered question from build response 3 about whether poster is once per site or once per closing field is now load bearing. The suite is 222 tests and passes. Not seen on the live site or a real device.
- Forecastability page spec received and not built, 7 September 2026: `docs/forecastability-page-spec.md` is committed verbatim. The page is not built and the reason is recorded in `docs/build-response-6-2026-09-07.md`. **The spec is written against `styles.css`, which this repository deleted on 4 September 2026 in commit `f2f2ca6`.** Every token it names that is not in `tokens.css` comes from that deleted file: the neutral ramp 300, 500, 800 and 900, `--color-accent-700` at `#ae1800`, and the spacing scale 1, 2, 3, 4, 6 and 8 with exactly the gaps the spec describes. That file's ink was `#201e1d` and its accent `#ec3013`, the red palette that ran on `forecast-risk.html` in Production for weeks. This is the failure `docs/marketing-site.md` records under the export retirement: the dangerous residue of an abandoned approach is its documentation rather than its code. The note did its job. Two hard blockers beyond that: the spec never names the file, so nothing can be created, and it does not say whether the header link moves from `forecast-risk.html` to the new page. A fourth page will also fail `test_the_page_list_is_pinned`, which is the control working as designed; the order is to put the page on `tokens.css` first and add it to `EXPECTED_PAGES` second, never the reverse. Three things need a decision before a build: the filename and navigation, whether a neutral ramp and spacing scale are added to `tokens.css` with values chosen against the live palette, and whether the failure outcome's red becomes a real token. Also raised and not acted on: the settled item changing the header strapline to "AI Forecast Diagnostic" is live copy on `index.html`, the two recorded contrast exceptions sit below the normal floors on a client-facing page, and the M5 statistics are presented as fact with a journal citation and cannot be verified from this environment.
- Third revision release evidence, 6 September 2026: merged through pull request 87, merge `aa99ba21129e30abf20b40f471105d397925f962`. It carried the sub-note, the single-link brand block on `privacy.html` and `forecast-risk.html`, and the release record for pull request 86. `main` had not moved between the last local suite run and the merge, so the landed tree is byte identical to the tree 222 tests passed on. The product owner confirmed the live site after deployment. The pages, widths and devices are not recorded because he did not state them. `docs/designdecisions.md` needs no further commit: the version handed over on the evening of 6 September is byte identical to the copy already on `main`, sha256 `18b2a2c6fe86e285a9635fe523e0948d3886266577d05232a67b2e9897ac073d`, landed in pull request 87. **That document is intent and not authority.** `CLAUDE.md` section 2 has not been amended to include it, so where it disagrees with `tokens.css` or a test today, they win and the disagreement is raised. Six such disagreements are recorded in `docs/build-response-5-2026-09-06.md` along with seven items that need a decision or an asset before anyone can act on them.
- Design brief third revision executed, 6 September 2026: the sub-note "Work is taken directly, not brokered." is added under the homepage paragraph at 15px in full ink with a 22px gap and no rule above it, and the header brand block becomes a single link on `privacy.html` and `forecast-risk.html`, so the mark and the wordmark both go home. Verified by clicking each half in a browser and confirming the destination. `index.html` is left as the exception: its brand block is not a link at all, because it is the home page, and whether it should self-link is raised rather than assumed. The round contact badges are withdrawn as a defect by the design session and are recorded as the site's one agreed radius exception, predating design involvement. Do not raise them again. One defect was introduced and caught inside this change. The sub-note made a third child in a two-column grid, which pushed the services list into the left column under the paragraph. No test failed, nothing overflowed, and the page still rendered: it was found by measuring element positions rather than by reading the diff or glancing at a thumbnail. The paragraph and its sub-note are now one wrapped grid child, and the lesson is recorded in `docs/marketing-site.md`. The brief's arithmetic for the left column is still stale: it predicts the column finishing about 37px short of the services list, and it measures 75.5px, because the list is 277.5px tall rather than the 257.1px the brief carries. The intent, a deliberately uneven edge with the list the heavier side, is achieved. The four `forecast-risk.html` items remain a separate pass and are untouched: the status palette needing to be recorded as a scoped exception, the 12px label step carrying nine roles, the mixed voice, and the borrowed-credibility notice. The suite is 222 tests and passes. Twelve page and width combinations render with no failed request, no horizontal overflow and Archivo loaded. Not seen on the live site or a real device.
- Design build release evidence, 6 September 2026: merged through pull request 86, merge `0c4c55cdd791cf1763da12b5f9888a1159970554`. It carries the whole design band in one landing: the hero rebuild, the three service domains, the first-person-plural copy, the seven-step type scale across all three pages, the wordmark token, the type control, the font load check, and the record of pull request 85 that was already on the branch. `main` had not moved between the last local suite run and the merge, so the landed tree is byte identical to the tree 222 tests passed on and to the renders the product owner approved. The product owner confirmed the live site after deployment. Which pages, widths or devices he used are not recorded, because he did not state them, and the three changes most worth a second look are named here rather than assumed checked: the homepage gap beneath the paragraph, the `privacy.html` headline dropping from 68px to 40px, and any page on a phone. Two follow-ups are open and neither is started. The design session owes an answer on the paragraph capacity model, which `docs/build-response-3-2026-09-06.md` sets out with the measured numbers. And the four `forecast-risk.html` issues in `docs/designdecisions.md`, the round contact badge breaking the zero-radius constraint, the status palette needing to be written down as a scoped exception, the 12px label step carrying nine roles, and the mixed voice, are a separate pass by the design session's own instruction.
- Design brief rewritten and executed in full, 6 September 2026: the design session superseded its brief after two build responses, and every decision in the new version is applied. The homepage paragraph is replaced with the session's final 352-character copy and the page moves to the first person plural, which reverses the first person singular built an hour earlier: "Tell us what needs to land" is back as it was live. All three page headlines now take the 40px display step, so `forecast-risk.html` drops from 76px and `privacy.html` from 68px; the stat value takes display too, which costs nothing at desktop. Poster at 56px is spent only on a closing accent field. The wordmark leaves the scale entirely into its own `--wordmark-size` token, so the scale keeps no exceptions. The rule that a `clamp()` is classified by its desktop rendered value and never by its minimum is written into `tokens.css`, which is the control that would have caught all four size errors this band produced. `MarketingSiteTypeScale` now fails the build on any hand-written size on the three pages, with no allowance file, and reads the `font` shorthand as well as the longhand. Proved by planting a raw 13px in `index.html` and watching the suite fail, then reverting. One prediction in the brief did not hold and is reported rather than worked around: the paragraph was specified as 349 characters setting in 11 lines and levelling the two lower columns. It is 352 characters, sets in 7 lines, and leaves a 120px gap under it. The brief's model assumed a 32-character measure and 23.25px leading; measured, the column runs about 50 characters at 22.5px leading. The copy is shipped verbatim because copy is the design session's call, and the layout consequence is theirs to answer. The four `forecast-risk.html` issues the brief raises, the round contact badge, the status palette exception, the label step carrying nine roles, and the mixed voice, are explicitly a separate pass and are not in this change. The suite is 222 tests and passes. Twelve page and width combinations render with no failed request, no horizontal overflow and Archivo loaded. Not seen on the live site or a real device.
- Type scale rolled out and the font check built, 6 September 2026: the design session answered all eight build questions and the answers are executed. A seventh step, `--text-poster` at 56px, carries the closing line rather than folding it into the 31px title step. No exceptions inside the scale: micro-labels are 12px and `privacy.html` body is 15px, its sustained reading answered by `line-height: 1.65` and a 34em measure. All three pages consume the steps. Four values keep their own `clamp()` and are held for a decision, because no step fits their rendered range: the `forecast-risk.html` headline at 76px and the `privacy.html` headline at 68px, which the 40px display step would cut by 47 and 41 per cent; the header wordmark, whose 15 to 18 taper no step matches; and that page's stat value at 40px. The stat value is the mild one and a first version of this entry overstated it: 40px is the display step exactly, so that mapping costs nothing at desktop and four pixels on a phone, and it is held only because the design's table maps its declared 26px minimum, which would take it to 25px instead. That is the same `clamp()` blind spot as the 42px and 56px errors, found a third time. `SelfHostedFontLoads` is added to `forecast-app/tests/test_marketing_site_tokens.py`: one `@font-face` source, root relative, not third party, and the file present at a plausible size. Proved by moving `assets/fonts/Archivo-Variable.ttf` aside and watching the suite fail, then restoring it, plus three in-test probes. It does not prove a browser loaded the face. One real defect was introduced and fixed inside this change: the 11px to 12px micro-label move pushed the `forecast-risk.html` exceptions table 10px past a 320px viewport and the page scrolled sideways. The scale keeps no exceptions, so the cell padding gives way at 560px and below instead. It was invisible in the diff and was caught by asserting scroll width against client width on all three pages at four widths. The type scale is deliberately not yet enforced by test: the design session set completion of the rollout as the condition, and four held values mean it is not complete. The suite is 210 tests plus the six new font checks and passes. Twelve page and width combinations render with no failed request, no horizontal overflow and Archivo loaded. Not seen on the live site or a real device.
- Homepage rebuilt to the design session's brief, 6 September 2026: `docs/designdecisions.md` items 1, 2, 3 and 5 are executed on `index.html`, and item 4's six type steps are added to `tokens.css` and consumed by the `#about` section only. The headline is uncapped at full content width and sets on one line from 800px upward; the eight-item service list becomes three domains, with capability building deleted and the Regulatory and Quality partnership moved into the paragraph; the page moves to the first person singular. No imagery is added, which is item 5's decision rather than an omission. Two of the brief's numbers were wrong and are corrected in `docs/marketing-site.md` rather than silently absorbed. Its size inventory read fixed `font-size` values and skipped every `clamp()`, so the headline was recorded as 42px when it measured 57.6px at 1440. The 40px display step is therefore a 30 percent reduction at desktop, not a 2px snap, and the same error puts the 56px closing line against a 31px title step. The closing line is not moved and is held for a decision. The brief's diagnosis of the meta description was also wrong: the file is valid UTF-8 and declares its charset, and the bytes themselves are a double-encoded em dash, one of 39 such sequences in the file. The description now reads with a comma, which also satisfies the house dash rule. The Cardiff against Pontypridd question in the same description was put to the product owner and closed by him on 6 September 2026: Cardiff, Wales is his general location and is deliberate. The registered office in the footer stays Pontypridd, which is the legal address. The two are not in conflict and neither is a defect. The suite is 210 tests and passes. Rendered and measured at 1440, 1280, 1200, 1150, 1120, 1100, 1090, 1080, 1060, 1024, 900, 800, 768, 600, 480, 390 and 320px: the headline holds one line to 800px, breaks into two balanced lines at 768 with no orphan, and no width overflows. Not seen on the live site or on a real device. Vercel Preview and Production checks after merge are outstanding.
- Homepage hero mark release evidence, 6 September 2026: merged through pull request 85, merge `2bc350eeaa38d4ccac1f9709ee4cb861948a3b80`. `main` had not moved between the last local run and the merge, so what landed is byte identical to the tree the 210-test suite passed on and to the renders the product owner approved. Both Vercel deployments reported Ready on the pull request head, and the marketing project is the one that applies; the Assay deployment is the expected second check, since the only file this work touched under `forecast-app/` is the marketing control in `tests/`, which the application build does not use. The product owner confirmed the live homepage as correct after deployment. Which widths or devices he used is not recorded here, because it was not stated. The narrow-screen surface is thin in any case: the figure was already hidden below 720px, so the 390 and 320px renders are byte identical across the change. No further marketing work is outstanding from this request. The single-column layout for `#about` is the approved state; if a service image replaces the removed mark, the second column returns with it.
- Homepage hero mark removed, 6 September 2026: the faceted stone that filled the right column of `#about` in `index.html` is gone, on the product owner's instruction and on redundancy rather than on any defect, since the same mark already sits in the header, the footer and the favicon. The art is kept verbatim at `assets/hero-stone.svg`, referenced by no page, because a service image is under consideration for that slot; it was loaded through an `img` tag in a browser to prove the saved file still draws rather than only that it was saved. `#about` becomes one column at every width and the rules that served only the figure went with it: `.split-figure`, `.rock`, `.rock-art`, the `#about .rock` background suppression and three 720px rules. Verified on rendered pixels at 1440, 768, 390 and 320px. The 390 and 320px screenshots are byte identical to the capture taken before the change, because the figure was already hidden below 720px, which also shows the mobile layout was not disturbed by removing those media-query rules. In the same change the marketing colour control lost its six-fill exclusion. `forecast-app/tests/test_marketing_site_tokens.py` no longer strips `fill="#..."` from `index.html` before scanning, so an inline fill is now an ordinary raw colour and fails the scan directly. It was deleted rather than set to zero. The exclusion was weaker than it read: it pinned the count at six and stripped the values, so it could see a seventh fill appear and could not see any of the six change. Proved rather than asserted, by restoring the pre-removal page with one logo fill moved from `#2b2a29` to `#ff0000`: the old control passed all ten of its tests on that page and the new control fails on it. Ownership of that one file moved to the marketing-site session on the same date, because the page and its control sat on opposite sides of a session boundary and whichever half landed first would have left `main` red. The rest of `forecast-app/` did not move. The local suite is 210 tests and passes. No CI runs it, so the pull-request checks are Vercel deployments only and are not evidence for the suite. Production verification after merge is outstanding, and the decision to collapse `#about` to a single column rather than hold the empty slot open is with the product owner at the time of writing.
- Marketing header update, 3 September 2026: released through pull request 67, merge `1e076271427e7a283d32933ae5f088e38da0c1a6`. AI Demand Forecasting sits beside the company name and opens a dropdown linking to `https://assay.silurianconsulting.co.uk/` in a new tab. The label and Assay link match the live service list at 15.5px. Local and public Production browser checks passed at 1440, 768, 390 and 320px for sizing, overflow, click, keyboard, Escape, outside click and destination.
- iOS control colour defect fixed, 6 September 2026: the Run sample analysis button on `forecast-risk.html` rendered its label in the iOS system blue, because `.btn` declared a background and a border but never a `color`, so the control took the platform default. Confirmed rather than assumed: the button computed `rgb(0, 0, 0)` in Chromium against a page ink of `rgb(63, 61, 59)`, so it was taking a UA default that happens to look correct on desktop. Pre-existing since 28 August and not caused by any recent work. The label is now `--color-charcoal-deep`, the only ink reaching 4.5 against the accent at 15px bold, and the control carries `appearance: none`. Every interactive control on all three pages was audited and none now takes a browser default. The `select` keeps `appearance: auto` deliberately, because neutralising it removes the dropdown arrow on every platform. Whether iOS also rounds the controls' corners is unverified and only a real device answers it; `border-radius: 0` was already explicit on both. The same pattern is far worse in Assay and is raised as story 2.9.3, unchanged here.
- Claude Design export residue retired, 4 September 2026: twelve unreferenced files were removed from the repository root, leaving `index.html`, `forecast-risk.html`, `privacy.html`, `tokens.css`, `logo-stone.svg`, the three Markdown records, `assets/`, `docs/` and `forecast-app/`. Three of the twelve were the reason: `readme.md` instructed a future developer in the imperative to link `styles.css` and take every colour from it, which would have reapplied the abandoned red palette and reintroduced the Google Fonts request; `_ds_manifest.json` declared that red accent as the token set; and `README (1).md` stated that Archivo is loaded from Google Fonts at runtime, which stopped being true earlier the same day. The other nine were dead code, editor state and unreferenced binaries. No page referenced any of the twelve before or after, all 16 screenshot hashes are unchanged, and Git history retains every byte. See the pull request for a line on each file.
- Marketing-site colour control added, 4 September 2026: `forecast-app/tests/test_marketing_site_tokens.py` fails the build when any of the three marketing pages carries a raw colour value, in any of five forms, and holds the three status colours equal between `tokens.css` and Assay's own `:root` block. It lives in the Assay suite because that is the only suite anything invokes, and the file and `docs/marketing-site.md` both record why. Colours only: font sizes are deliberately not pinned. Nine probes were run and each failed as required, a raw value planted in each of the five forms, one status value moved on each side in turn, a seventh logo fill, and a fourth page. Probing found a real defect first: the page list was read from `git ls-files` and reported OK for an untracked new page. It now reads the filesystem, so the control fires as soon as a page exists rather than when it is staged. The first write-up of that finding claimed such a page would already be live in Production. That was wrong and is corrected here: Vercel's Git integration builds from the commit, so an untracked page is not deployed and the guard would have failed in CI before any deploy. The window was local. A manual `vercel --prod` from a working directory does upload untracked files, but that is not the documented deployment path.
- All three pages moved onto the tokens, 4 September 2026: `privacy.html`, `index.html` and `forecast-risk.html` each lost their own `@font-face` and colour tokens and now consume `tokens.css`, which carries 18 declarations. The seven values with no site-wide role became tokens of their own rather than exemptions in the control. `forecast-risk.html`'s canvas reads the tokens through `getComputedStyle` because a canvas cannot use `var()`. Both duplicate definitions are gone: `--color-divider` and `--color-accent` each have exactly one definition, and the losing 40 percent divider value is out of the tree. The only raw colours left on the site are the six logo SVG fills, which cannot be tokenised because an external SVG loaded through `img` cannot read a page's custom properties. All 16 full-page screenshot hashes remain byte identical to the capture taken before the band started. See `docs/marketing-site.md`.
- Token file added, 4 September 2026: `tokens.css` at the repository root holds the site's eight colours, the two approved-but-unapplied brand tokens and the three font tokens, plus the `@font-face` declaration. It is linked by `index.html`, `forecast-risk.html` and `privacy.html` and is self hosted with no third-party origin. It landed inert: nothing was removed from any page, each page's own values still win, and all 16 full-page screenshot hashes are byte identical to the capture taken before this band started. The font URL is root-relative, `/assets/fonts/Archivo-Variable.ttf`, so the file's location cannot break it. A URL inside a linked stylesheet resolves against the stylesheet rather than the page, and a page-relative URL would fail silently if the file ever moved, because `font-display: swap` paints a fallback instead of raising an error. Both forms were probed: the page-relative form returns 404 and leaves the font unloaded while the page still renders, and the root-relative form returns 200 and loads. Confirmed loading from all three pages, one request each and no failures. The pages adopt the tokens one at a time in the next story. See `docs/marketing-site.md`.
- Dead component layer removed from `index.html`, 4 September 2026: 112 of 186 CSS rules and 43 token declarations covering 36 names were removed, taking the file from 38,165 to 20,746 bytes. Every removed rule was proved dead twice, by a class absent from the body and by the page containing no JavaScript that could add one. All 16 full-page screenshot hashes, three pages at 1440, 768, 390 and 320px plus the four chart states, are byte identical to the pre-change capture. `--color-charcoal-deep` and `--color-neutral-brand` were kept although nothing references them, because they are approved brand tokens recorded in this document. Correction, added 4 September 2026: the comment sweep in that story was partial, not complete. Three orphaned comments among surviving declarations were missed by a detector that only looked for comments followed by another comment or a block end, and were found and removed in S1.3. This is the first change of the site token band, which buys prevention rather than any visible improvement. See `docs/marketing-site.md`.
- Header simplified and page colours aligned, 4 September 2026: the Assay dropdown is removed from the `index.html` header on the product owner's preference, not on a defect, and replaced by a plain text link reading AI Demand Forecasting that points at `forecast-risk.html`. Removing it takes the last JavaScript off the marketing homepage. `forecast-risk.html` had been running a second colour scheme, and its ink, rules and accent now use the site values `#3f3d3b` and `#ec6917`. Rendered pixels confirm the old `#201e1d` and `#ee7623` no longer appear anywhere on the page and both header seams sample `#3f3d3b`. Header heights match at 1440 and 768px, and differ at 390 and 320px because the homepage navigation wraps below the company name. Seven colours on `forecast-risk.html` have no equivalent in the site token set and were deliberately left unchanged. Three of them, `#356b46`, `#9a5a12` and `#a52a1f`, are the status colours Assay also uses in `forecast-app/static/index.html`, and they appear nowhere in the Claude Design export, so they are a decision shared by both products. Change them on both sides or neither. `index.html` now contains no JavaScript at all, which is a property to keep rather than an accident. See `docs/marketing-site.md`. Production verification after merge is outstanding.
- Self-hosted font correction, 4 September 2026: `forecast-risk.html` was the last page loading Archivo from `fonts.googleapis.com`. It now uses the same self-hosted `assets/fonts/Archivo-Variable.ttf` declaration as `index.html` and `privacy.html`, so no page sends a visitor to Google before the page renders. Appearance is unchanged: the variable font covers the 400, 600 and 800 weights the page requested. A local Chromium check at 1440 and 390px on 4 September 2026 recorded every request the page makes, which is the page itself, `logo-stone.svg` and `assets/fonts/Archivo-Variable.ttf`, and no external request of any kind. The 800 weight face reported loaded and the heading rendered in Archivo rather than a fallback. Production verification after merge is outstanding.
- Marketing header release evidence, 3 September 2026: merged through pull request 68, merge `e53f802a121e4e46f56526318405994d07739199`. It recorded the Production smoke result for the header dropdown on `https://www.silurianconsulting.co.uk/` at 1440, 768, 390 and 320px and closed the marketing header work. It changed this handoff only, and no site file.

### Marketing header delivery

Only `index.html` and this handoff change. Native details/summary provides a closed-by-default dropdown, including without JavaScript. A small inline script closes it on Escape, outside click or focus leaving it. On narrow screens the navigation wraps below the company name without splitting the logo/name group. Archivo stays self-hosted; no analytics, cookies, third-party embeds, environment variables, DNS or Assay application changes are introduced. The external link uses `noopener noreferrer`.

The owner approved the mockup and requested deployment. All 196 Python tests passed using the bundled Python runtime; the old embedded runtime lacks current dependencies. Both Vercel Preview deployment checks succeeded for `ca53083`. The signed-in browser verified the marketing Preview's dropdown and Assay destination, including its narrow-screen appearance. Anonymous Preview requests lead to Vercel sign-in; deployment protection was not changed. Production smoke checks passed on `https://www.silurianconsulting.co.uk/` after merge, with the menu closed initially, matching service typography, correct new-tab link, no horizontal overflow and working keyboard and pointer dismissal at all four tested widths. No marketing work remains for this request. Application story acceptance below remains separate and unchanged.

### Existing application and marketing position

- Story 2.3 planner action view merged in pull request 50 at `655b984` on 2 September 2026. A fresh clone of `main` at that commit has a clean working tree and passes 119 tests. Fixtures 30 and 31 still produce their recorded results. The run manifest schema is 1.6 and the confidential bundle schema is 1.3. The Vercel Preview deployments for the merged head were Ready with no failed check. The Production planner action check is partly done: the resolution picker was checked against Production on 2 September 2026 and is a closed list defaulting to the placeholder. The open items list count, the do this text and the resolution effects have not been checked against Production yet; the owner runs them and records the result here.
- **Sprint 2 is closed.** Criterion 16 was run on 2 September 2026 with one supply chain planner who did not build the tool and was given no explanation, and it passed on substance. The full record is `docs/planner-test-findings.md` and the protocol is `docs/planner-test-pack.md`. The planner opened `RTG-60403`, not the `RTG-60301` the criterion predicted, because the open items list is ranked by volume and put a 12.85 percent line above an 8.28 percent one. The screen was right and the criterion was wrong. They reproduced three of the five discontinued resolution codes unprompted, and refused to forecast a line whose status was unconfirmed.
- Band 2.7, say it to a planner, is the remediation the planner test earned. It is built from `docs/briefs/2.7-build-brief.md` and changes words and where they sit. No decision, threshold or engine behaviour moved. Eleven findings, one diagnosis: the tool spoke its own vocabulary fluently and never taught it.
- The expected JSON line-ending follow-up merged in pull request 48 at `7416fc8` on 2 September 2026. A fresh clone of `main` at that commit has a clean working tree and passes 110 tests.
- Story 2.2 routing merged in pull request 47 at `5e41a4a` on 2 September 2026. A fresh clone of `main` at that commit has a clean working tree and passes 110 tests. All 14 fixture 31 decisions match `expected_routing.json` v1.1. The run manifest schema is 1.5 and the confidential bundle schema is 1.2. The Vercel Preview deployments for the merged head were Ready with no failed check. The fixture 31 routing check passed against Production on 2 September 2026 on all four assertions: the headline read 65.57 percent eligible and 34.43 percent not with seven decisions in the split, the refused data quality filter left exactly `RTG-60401`, `RTG-60402` and `RTG-60502`, `RTG-60403` read discontinued confirm status despite its not usable band, and `RTG-60301` read policy only with no refusal block and its outlier caveat shown.
- The cold-start handover merged in pull request 44 at `72ffd8c`. Fixture 31 merged in pull request 45 at `dce6b48` and the sample CSV line-ending fix in pull request 46 at `d85a030`, both on 2 September 2026. A fresh checkout of `main` is clean and passes 86 tests before Story 2.2.
- Story 2.1 is complete. Pull request 41 merged at `40e3508` on 1 September 2026. Local verification passes 83 tests, the approved 15-SKU fixture passed Vercel Preview acceptance, and the same fixture passed the Production smoke test after deployment.
- Story 2.0 is complete. Pull request 39 merged at `cc338d5` on 31 August 2026. Preview acceptance passed with the mixed portfolio fixture, and both Vercel Production deployments completed successfully. The Forecast Diagnostic Production shell, self-hosted Archivo font and stone mark all returned HTTP 200 after deployment.
- Stories 1.1 through 1.6 are complete and merged into `main`.
- Story 1.5 is complete. Pull request 31 merged at `157b776`, and both Preview and Production acceptance passed.
- Story 1.6 merged in pull request 37 at `4bc303d`. Local, Preview and Production acceptance passed.
- Story 1.4 merged in pull request 29 at `86f9b02`. Quality and forecast-bundle Preview acceptance passed, and the Production quality-bundle smoke test passed.
- Production is deployed and working.
- Marketing-site pull request 26 is merged. Archivo is self-hosted, the SIL Open Font Licence is retained in the repository, and a privacy notice is linked from the footer.
- The approved marketing spacing and white contact-section treatment from pull request 28 is present in `main`.
- Marketing-site pull request 34 is merged. Production was verified on 31 August 2026 with charcoal ink `#3f3d3b`, main and light-facet orange `#ec6917`, dark-facet orange `#c15613`, the shared logo favicon and matching circular email and LinkedIn badges. The email address remains present in the `mailto:` link and therefore remains machine-readable.
- The approved optional warm neutral is `#cabfad`, exposed as `--color-neutral-brand`. It is not currently applied to a visible site element.
- The approved deep charcoal is `#1a1918`, exposed as `--color-charcoal-deep`. It is used in the logo, as a raw hex in the SVG rather than through the token, and since 6 September 2026 it is applied through the token as the Run sample analysis label on `forecast-risk.html`, being the only ink that reaches 4.5 against the accent at that control's size.
- The marketing site does not intentionally use analytics, advertising cookies or non-essential tracking technologies.
- The Forecast Diagnostic accepts single-SKU and portfolio CSV files, validates them before forecasting, assesses portfolio data quality, runs forecasts through TimesFM 2.5 in BigQuery, produces inventory-risk analysis, and creates a downloadable run manifest.
- Production was checked on 29 August 2026 using the fixed TimesFM reference fixture. The file was accepted, the TimesFM forecast completed, and the saved ten-run reproducibility evidence was displayed without errors.
- No application database or object store is used. Uploaded files are processed for the current request and are not deliberately saved by application code. The framework can spool a multipart upload temporarily, and BigQuery uses an anonymous result table for up to 24 hours, so do not make an unqualified no-retention claim.

## Authoritative locations

- GitHub repository: `https://github.com/5ktvrg9gfy-creator/silurian-site`
- Production branch: `main`
- Marketing website: `https://www.silurianconsulting.co.uk/`
- Marketing Vercel project: `silurian-site`
- Production application, customer facing: `https://assay.silurianconsulting.co.uk`
- Production application, original address: `https://silurian-forecast-diagnostic.vercel.app/`. Still resolves and is not retired.
- Forecast Vercel project: `https://vercel.com/silurian/silurian-forecast-diagnostic`
- Local repository: `C:\Users\jksta\OneDrive\Documents\Silurian Consulting Limited\silurian-site-repo`
- Forecast application: `forecast-app/`
- Fixture provenance: `forecast-app/tools/`, the generators that produced every pinned fixture and expectations file and the checkers that verify them. Read `forecast-app/tools/README.md` before running anything: the committed files are authoritative and the scripts are not.

The additional domains `silurianconsultinglimited.co.uk` and `silurianconsultingltd.co.uk` redirect to `silurianconsulting.co.uk`.

Both application addresses are served by the same Vercel project and are gated by the same environment variable, `SILURIAN_ACCESS_PASSWORD`. Its value is set in Vercel by the product owner and appears nowhere in this repository. See `forecast-app/docs/access-gate.md`.

DNS for `silurianconsulting.co.uk` is at Cloudflare. **The `assay` record must stay unproxied, DNS only, and never the orange cloud**, because proxied Vercel cannot verify the domain or issue its certificate. Somebody will eventually turn that on to be helpful, and the tool will stop resolving when they do.

GitHub is the source of truth. Do not replace the repository with a complete design export or edit Production directly when the same change can be made through the normal branch and pull-request workflow.

## Authority order

When documentation disagrees, use this order:

1. `expected_findings.json`, `expected_quality.json` and `expected_classification.json` for thresholds and expected behaviour.
2. `run_manifest.schema.json` and `run_bundle.schema.json` for output shape.
3. Build briefs for intent and reasoning, but not for numbers changed by later answers or expectation files.
4. `CLAUDE.md` for standing build rules.

Stop and report a contradiction rather than choosing a convenient source. The Story 1.2, 1.3 and 1.4 briefs predate later decisions and do not by themselves describe current Production thresholds or hashing behaviour.

## Repository map

### Root website

- `index.html`: main Silurian marketing page
- `forecast-risk.html`: entry page for the Forecast Diagnostic
- `tokens.css`: the one source for every colour the site renders and the `@font-face` declaration, linked by all three pages
- `logo-stone.svg`: main logo asset
- `privacy.html`: public privacy notice
- `assets/fonts/Archivo-Variable.ttf`: self-hosted Archivo variable font
- `assets/fonts/OFL.txt`: Archivo's SIL Open Font Licence
- `MAINTENANCE.md`: marketing-site maintenance notes
- `docs/marketing-site.md`: marketing-site intent as stated by the product owner, plus the conventions and traps that are not obvious from the files
- `CLAUDE.md`: standing repository rules and authority order for a cold start
- `PROJECT_HANDOFF.md`: mandatory build recovery and transfer record

### Forecast Diagnostic

- `forecast-app/app.py`: FastAPI routes and application orchestration
- `forecast-app/static/index.html`: complete browser interface
- `forecast-app/validator.py`: CSV input validation and normalisation
- `forecast-app/quality_engine.py`: portfolio quality metrics and findings
- `forecast-app/classification_engine.py`: demand-state, ABC volume-class and contextual XYZ classification derived from the quality result
- `forecast-app/forecast_engine.py`: statistical baselines and inventory-risk calculations
- `forecast-app/bigquery_timesfm.py`: BigQuery TimesFM 2.5 provider and Vercel OIDC authentication
- `forecast-app/run_manifest.py`: run-manifest generation, integrity and provenance
- `forecast-app/run_manifest.schema.json`: authoritative manifest schema
- `forecast-app/run_bundle.py`: confidential bundle export, integrity, read-only reopen and reproduction comparison
- `forecast-app/run_bundle.schema.json`: authoritative bundle schema
- `forecast-app/determinism.py`: uncached repeat-run measurement
- `forecast-app/tests/`: automated tests and fixed fixtures
- `forecast-app/docs/`: signed-off contracts, surveys, open questions, amendments and deployment evidence
- `forecast-app/docs/fixture-inventory.md`: every fixed fixture, its purpose and the deployed end-to-end check
- `forecast-app/docs/ADR-001-manifest-integrity-hashing.md`: final two-hash manifest decision and rationale
- `forecast-app/docs/final-handoff-audit.md`: final Codex shutdown audit and residual owner actions
- `docs/handover-gaps.md`: cold-start record of information missing from the repository or discoverable only through code and local environment inspection
- `forecast-app/vercel.json`: Vercel Python application configuration
- `forecast-app/requirements.txt`: deployed dependencies

## Delivered stories

### Story 1.1: trust the pipe

Implemented fail-closed CSV validation before forecasting. It detects structural, date, numeric, unit, duplicate, grain, total, record-type, encoding and source-system ambiguity. Blocking findings prevent the model from being called. Warnings and transparent normalisations remain auditable in a downloadable validation record.

Key references:

- `forecast-app/docs/1.1-contract.md`
- `forecast-app/tests/fixtures/`
- `forecast-app/tests/test_validator.py`

### Story 1.2: data quality portrait

Implemented portfolio-level and SKU-level data-quality assessment. It reports coverage, volume exposure, stale extracts, short history, discontinuation, suspect zeros, outlier candidates and level shifts. Missing periods are not silently filled with zero. ADI and CV squared are metrics only, not demand classifications.

Key references:

- `forecast-app/docs/1.2-contract.md`
- `forecast-app/tests/quality_fixtures/`
- `forecast-app/tests/test_quality_engine.py`

### Story 1.3: run provenance

Implemented a complete versioned run manifest for validation and forecast runs. It records source hashes, effective options, deployment identity, model identity, TimesFM reference-canary status, reproducibility evidence, stage relationships and a final manifest integrity hash.

The TimesFM reference canary rounds only its own output to six decimal places before hashing. Forecast results are not rounded by this control. The approved canary fingerprint is:

`803063c75e9de5e3e2113be3de5e9614a86988f2589f423417bc1cefabff8a75`

The controlled ten-run Preview measurement used disabled BigQuery query caching and compared 108 forecast points. All outputs in the final measured deployment were identical. Production stores this approved evidence and displays it in the run manifest. The temporary measurement flag has been removed.

Key references:

- `forecast-app/docs/1.3-contract.md`
- `forecast-app/docs/1.3-amendments.md`
- `forecast-app/docs/1.3-determinism.md`
- `forecast-app/run_manifest.schema.json`
- `forecast-app/tests/run_manifest_fixtures/`
- `forecast-app/tests/test_run_manifest.py`
- `forecast-app/tests/test_determinism.py`

### Story 1.4: reproducible and re-openable runs

The implementation adds a client-owned confidential run bundle containing the recorded results and the complete manifest. The browser can download a completed bundle, reopen it read only without calling an engine, and deliberately reproduce validation, quality or forecast runs against the supplied source. Reproduction distinguishes exact matches, tolerance matches, defects and runs that are not comparable.

The manifest schema is now 1.2. Its fingerprint excludes deployment-only identity while retaining calculation-relevant libraries and region. The exact manifest hash covers the real fingerprint. Forecast-stage safeguards from Story 1.3 remain required and are not fabricated in the quality-only golden.

The golden bundle is generated by the real validator and quality engine. Generation stops unless every metric and band agrees with the unchanged independent `expected_quality.json` target.

Preview acceptance used `20_portfolio_mixed.csv` with analysis date 1 August 2026. Exported bundle `run_3449475208c949e0ac42bdaf26097b37` passed bundle and manifest integrity, reopened read only, and reproduced validation and quality exactly with fingerprint `3b7aada9440d72b9128d0f177ff2dc8c39e544dfba2cab886677510b00f533d0`. Changing the recorded portfolio band caused the bundle to be refused. A browser number-serialisation defect found during this test was corrected and covered by regression testing.

Forecast-bundle acceptance on Preview commit `3c1b7bf` reran the same source and returned `not_comparable` because forecast reproducibility was unknown in that Preview. Validation matched exactly and the result stated that the forecast stage could not be verified, with fingerprint `e5eb92a3a9473e759a6c595bb4b53239229de052cc983ce859d13974e432766f`. This is the required fail-closed outcome when measured determinism evidence is unavailable.

Production smoke testing after merge `86f9b02` used the approved synthetic mixed portfolio with analysis date 1 August 2026. Quality export returned 200, bundle reopen returned 200, and reproduction returned `reproduced` with validation and quality exact. Production fingerprint: `792f192ec5c32287d1fc227a62d0c4dfaf6a48a0d6a8c38df9ff63fa99e6546d`.

Key references:

- `forecast-app/docs/1.4-contract.md`
- `forecast-app/run_bundle.py`
- `forecast-app/run_bundle.schema.json`
- `forecast-app/tests/run_bundle_fixtures/`
- `forecast-app/tests/generate_run_bundle_goldens.py`
- `forecast-app/tests/test_run_bundle.py`

### Story 1.5: data handling controls

The implementation adds a complete data map and narrows data exposure without changing the forecasting contract. New manifest schema version 1.3 replaces the readable source filename with a filename SHA-256 and extension. Legacy version 1.2 manifests and bundles remain compatible and can still contain a readable filename.

Client-data API responses use `Cache-Control: no-store`. Application logging uses fixed messages and does not deliberately record source rows, SKUs, findings, bundles or exception text. Every BigQuery forecast disables query-cache reuse and now fails closed if Google reports a cache hit. Confidential bundle reopening is performed entirely in the browser, and the former server reopen endpoint has been removed.

Vercel Preview acceptance confirmed the function in London, a Hobby plan with one owner, no log drains or monitoring integrations, and no enabled Web Analytics, Speed Insights or Observability Plus. Successful quality, controlled-error and forecast requests produced metadata-only runtime entries with no uploaded filename, SKU, CSV row, request body or client-facing error detail.

Live testing found `BIGQUERY_LOCATION` set to the US despite the London code default. Preview and Production settings were corrected to London, the Preview was redeployed, and a subsequent TimesFM forecast completed in `europe-west2`. BigQuery job history and Cloud Audit Logs showed parameterised SQL placeholders rather than the actual dates and demand values. Cloud Logging has standard `_Default` and `_Required` sinks only. The remaining client-statement issue is written provider confirmation about the scope of platform backups, followed by qualified legal and contractual review.

Production acceptance after merge `157b776` used the repository's synthetic single-SKU sample. Run `run_3db2788c1f2c78fcc58617202e9b0c3b` completed through TimesFM 2.5 with forecast demand 16,388 and minimum inventory 2,512. The primary BigQuery job `21ced5d4-1d15-4efa-863e-9c9014570445` ran in `europe-west2`. The matching Vercel request returned 200, was received in London `lhr1`, and had an empty Message field with no SKU or uploaded data. This closes the Story 1.5 technical acceptance criteria.

Key references:

- `forecast-app/docs/1.5-data-map.md`
- `forecast-app/run_manifest.py`
- `forecast-app/run_manifest.schema.json`
- `forecast-app/bigquery_timesfm.py`
- `forecast-app/app.py`
- `forecast-app/static/index.html`
- `forecast-app/tests/test_app_manifest.py`
- `forecast-app/tests/test_bigquery_timesfm.py`

### Story 1.6: make the stages agree

Validation now gates whether processing may continue, while quality characterises the demand history. Validation no longer emits `HISTORY_TOO_SHORT`, `SERIES_DISCONTINUED`, `SERIES_STALE`, `ZERO_VS_MISSING_AMBIGUOUS` or `SINGLE_OBSERVATION_SERIES`. Unit-scale, mid-history UOM-change and mixed record-type gates remain in validation.

Unresolved numeric date order now uses `DATE_ORDER_UNRESOLVABLE`. `DATE_FORMAT_AMBIGUOUS` is reserved for contradictory day-first and month-first evidence. Invalid dates are excluded from the evidence set, so `31/04/2025` raises `DATE_INVALID` without being cited as day-first evidence.

The permanent suite checks static finding-code ownership, conflicting cross-stage properties for every fixture that can proceed, and duplicate codes in the real quality endpoint payload. A deliberate temporary duplicate proved that the ownership test fails correctly. The full local suite passes 67 tests. The bundle goldens were regenerated and still match the independent Story 1.2 quality target.

Fixture 07 validates as `accept` with zero findings. Its quality output is enforced by `expected_quality.json` v1.2, including every per-SKU structural metric, band, required finding, the portfolio-level `EXTRACT_STALE` finding and null CV squared for the single-observation series. CV squared is explicitly a population estimate and is null below three non-zero observations. The manifest records both choices. Per-SKU trailing periods are reconciled against both the portfolio cut-off and analysis date. `SINGLE_OBSERVATION_SERIES` remains unimplemented because `HISTORY_TOO_SHORT` and the not-usable band already prevent a one-point series from proceeding.

Pull request 37 passed all three GitHub checks with no merge conflict. Preview acceptance used fixtures 02, 07, 08, 11 and 20. The reviewed fixture 07 rerun confirmed zero validation findings, `EXTRACT_STALE`, the population CV-squared method note and the three-observation reporting minimum. Production acceptance after merge `4bc303d` used `20_portfolio_mixed.csv` with analysis date 1 August 2026. Validation returned zero findings, quality analysed 12 SKUs, clean volume was 83.6%, and flagged volume was 16.4%. Production run `run_f82e9e9c05f2f6a7c1d4f8cc344974e6` produced manifest `89dc494df54c7438858de617010e79a8eda134882e0f9365db245cd332394dd7`.

Key references:

- `forecast-app/docs/1.6-verification.md`
- `forecast-app/tests/fixtures/expected_findings.json`
- `forecast-app/tests/test_stage_consistency.py`
- `forecast-app/validator.py`

### Story 2.0: a tool rather than a page

Story 2.0 merged in pull request 39 at `cc338d5`. It changes interface structure only. Validation, quality, forecast, manifest and bundle calculations are unchanged.

The diagnostic now presents Validation, Data quality, Forecast and Provenance as peer panels beneath a sticky run-context bar. The context keeps the filename hash, analysis date, inferred frequency, verdict, quality band and run ID visible while the user changes panels or scrolls. The quality grid is the work surface: every column sorts, band filters and SKU search persist across panel changes, and every line carries both a visual treatment and its written band. Enter, Space or a pointer opens a side drawer with What, So what and Do this detail. Escape closes the drawer and restores focus and scroll position. The forecast empty state derives eligible and excluded counts and reasons from the actual quality result.

Archivo and the stone mark are self-hosted by the Forecast Diagnostic. The route exposes only the two allow-listed packaged assets. There is no new third-party request, environment variable, engine call or persistence mechanism.

Local verification covered 72 tests. Seventy-one passed in full discovery. The unchanged 50,000-row performance test exceeded its five-second threshold when run inside full discovery on the OneDrive worktree, then passed in isolation in 2.534 seconds. Mixed-portfolio browser acceptance used `20_portfolio_mixed.csv` with analysis date 1 August 2026 and confirmed 12 lines, 83.6% clean volume, persistent filtering and searching, keyboard row opening, Escape closure, and a derived forecast state of 10 eligible and 2 excluded. The user repeated the mixed-portfolio check in Preview and approved the result before merge. GitHub reported successful Production deployments for both Vercel projects. The public Forecast Diagnostic shell and both packaged workspace assets returned HTTP 200 after deployment.

Key references:

- `forecast-app/static/index.html`
- `forecast-app/tests/test_workspace_ui.py`
- `forecast-app/docs/2.0-open-questions.md`

### Story 2.1: portfolio classification

Story 2.1 merged in pull request 41 at `40e3508`. It adds a classification stage after quality without changing validation, quality or forecast calculations. The stage consumes the recorded quality result and reuses its ADI and CV-squared values exactly. It never recomputes those structural metrics.

Every usable line receives one of four demand states from the pinned ADI 1.32 and CV-squared 0.49 cuts: smooth, erratic, intermittent or lumpy. Lines that cannot be classified receive an explicit unclassifiable state and refusal reason. ABC is based on cumulative demand volume with 80 and 95 percent cuts. XYZ is shown only for smooth and erratic demand, where it is meaningful; other demand states display `Not meaningful for this demand class`. Classification supplies implications only and does not select or name a forecast method.

The workspace adds Classification between Data quality and Forecast. Its primary matrix crosses ABC volume class with the five demand states. All 15 cells are always visible, empty cells are disabled, and each populated cell shows volume share before line count. Selecting a populated cell filters the sortable, searchable SKU grid. The grid joins quality band and findings from the quality result at display time, so the classification artefact does not duplicate them. The existing SKU drawer now includes demand class, ABC volume class, contextual XYZ, ADI, CV squared, non-zero observations and the classification implication.

The manifest schema is version 1.4 and records the classification input and output references, thresholds, estimator choices and outcome counts without exposing SKU names or commercial volumes. The confidential bundle schema is version 1.1 and can store, reopen and exactly reproduce a classification result. Legacy manifests and bundles remain supported.

The approved fixture contains 15 SKUs and 466 rows across 35 monthly periods. It covers all four statistical demand quadrants, all three ABC classes, both sides of the threshold cuts and three refusal cases. Local automated verification passes all 83 tests. The consistency suite proves exact ADI and CV-squared reuse, schema stage/result conditionals, bundle integrity and reproduction, and the contradiction case for PKG-50602. Browser acceptance used analysis date 1 August 2026 and monthly frequency. Local and Vercel Preview testing confirmed 15 classified lines, 17.7 percent lumpy volume, two unclassifiable lines, 11 populated matrix cells, four disabled empty cells, the contextual XYZ wording, and a cell filter that isolates PKG-50301 as lumpy, class A, 13.86 percent of volume, caveated with `OUTLIER_CANDIDATE`. The user repeated the fixture check in Production after merge and confirmed the result. The Production deployment for merge `40e3508` was Ready and the public application loaded successfully. No environment variable or deployment setting was added or changed.

Key references:

- `forecast-app/classification_engine.py`
- `forecast-app/tests/test_classification_engine.py`
- `forecast-app/tests/classification_fixtures/30_classification_portfolio.csv`
- `forecast-app/tests/classification_fixtures/expected_classification.json`
- `forecast-app/docs/2.1-fixture-note.md`
- `forecast-app/static/index.html`

### Story 2.2: routing decision, reason and refusal

Story 2.2 merged in pull request 47 at `5e41a4a` on 2 September 2026. It adds a routing stage after classification that records one decision per line from a closed set of seven, the reason for it, an eligibility flag and, where a line is refused, a refusal carrying a closed list of resolution options. Routing runs no method and computes no metric: it reads `demand_class` from the classification result and the band, findings and `SERIES_DISCONTINUED` flag from the quality result, and every number a reason names is copied unchanged from the stage that owns it.

Precedence is fixed and tested in order: a line carrying `SERIES_DISCONTINUED` routes to `discontinued_confirm_status` whatever its class or band; otherwise a `not_usable` band routes to `refused_data_quality` whatever its class; otherwise the demand class decides, including unclassifiable to `insufficient_evidence`. A caveated band never reroutes, ABC volume class never affects the decision, and the portfolio band never affects a line decision. `policy_only` is a route and not a refusal, so its refusal is null although it is ineligible. Quality codes inside a refusal are references, not emissions, and the Story 1.6 cross-stage tests extend to routing.

A routing resolution never changes a quality band. The engine's `resolvable` flag answers whether a user decision can change the band in this run; a routing resolution answers what happens to the line next. The engine accepts an optional set of resolutions, validates each code against the refusal's own list, requires `SUPERSEDED_BY_SKU` to name a successor present in the file, records the code and note on the line in the bundle only, and reports counts by code in the manifest options. Capture and re-run through the interface are deferred to Story 2.3, as the brief's default directs.

The workspace adds Routing between Classification and Forecast. Its headline states the forecast-eligible and ineligible volume shares to two decimals from computed values, followed by the split by reason, a filter by decision, search and a sortable grid with the decision written on every row. The quality and classification grids gain a decision column. The SKU drawer gains the decision, the reason, the quality band at decision and, on a refused line, the refusal with its resolution options under a sentence stating that no option changes the quality band. The forecast panel's empty state now counts routing eligibility when a routing result exists. The word resolve is reserved for routing; the engine flag copy says a limitation can or cannot be lifted within this run.

The manifest schema is 1.5 and adds `routing` to the stage enum and `routing_result` to the artefact types. The routing stage's `input_ref` is the classification stage's `output_ref`, its options carry the routing table version, the precedence order and the vocabulary, and its outcome is constrained by the schema to counts and codes only. The bundle schema is 1.2 and requires `results.routing` exactly when the manifest carries a routing stage. The server accepts bundle versions 1.1 and 1.2 and the browser accepts 1.0 to 1.2, so recorded runs from earlier stories still reopen and reproduce. The regenerated goldens and the two schema copies under `tests/` were stored with CRLF line endings by the previous Windows checkout; the generator and a plain copy write LF, so those three files now carry LF and their hashes are re-recorded. Ignoring line endings, the golden changes are the routing stage and result only.

Local automated verification passes all 110 tests. The routing suite asserts every SKU, every boundary case, the precedence order on synthetic inputs, exact metric reuse by equality, read-only inputs, refusal of invalid resolutions, the manifest stage shape and a bundle round trip. Three controls were proved able to fail: reversing the precedence order moves `RTG-60403` to `refused_data_quality`, one appended byte in `expected_routing.json` fails the integrity guard, and a routing outcome carrying a SKU, a share or a wrong input reference is refused by the manifest. A Chromium check of the local application with fixture 31 at analysis date 1 August 2026 and monthly frequency showed the headline 65.57 percent eligible and 34.43 percent not, seven decisions in the split, 14 of 14 rows, the refused-data-quality filter isolating `RTG-60401`, `RTG-60402` and `RTG-60502` and surviving a panel switch, the `RTG-60403` drawer reading discontinued confirm status despite a not usable band, the `RTG-60301` drawer reading policy only with no refusal block and its outlier caveat shown, the `RTG-60501` drawer reading insufficient evidence on a clean band, the forecast empty state reading 7 of 14 eligible, the provenance statement naming routing as bitwise reproducible, and the confidential bundle reopening in the browser as version 1.2 with manifest 1.5 and no version differences. The Vercel Preview deployments for the merged head were Ready with no failed check. The build session could not reach Production itself, because its egress policy blocks `vercel.app`. The fixture 31 routing check passed against Production on 2 September 2026 on all four assertions: the headline read 65.57 percent eligible and 34.43 percent not with seven decisions in the split, the refused data quality filter left exactly `RTG-60401`, `RTG-60402` and `RTG-60502`, `RTG-60403` read discontinued confirm status despite its not usable band, and `RTG-60301` read policy only with no refusal block and its outlier caveat shown. Story 2.2's Production evidence is therefore complete.

Open questions and the defaults applied are recorded in `docs/2.2-open-questions.md`. Two were raised against `expected_routing.json` v1.0 and closed by v1.1 (sha256 `7fea85d2ec16ed57781e37a74957d18af3313ca58afc4fad59f086e2f69bc607`), issued by the product owner on 2 September 2026: the headline prints 65.57 and 34.43 because portfolio shares are now computed from unit volumes rather than by summing rounded per-SKU shares, and `trailing_periods_since_last_demand` moved under `fixture_metadata` because no stage owns it. `.gitattributes` now pins the JSON goldens and schema copies under `tests/*_fixtures` and the two runtime schemas to LF, so the two remaining CRLF manifest goldens were renormalised and their hashes re-recorded; the `expected_*.json` files stay byte-exact under `-text`. The section 10 known gap, staleness measured on the last period present rather than the last period with demand, is recorded and deliberately not fixed.

Key references:

- `docs/briefs/2.2-build-brief.md`
- `docs/2.2-open-questions.md`
- `forecast-app/routing_engine.py`
- `forecast-app/tests/test_routing_engine.py`
- `forecast-app/tests/fixtures/31_routing_portfolio.csv`
- `forecast-app/tests/fixtures/expected_routing.json`
- `forecast-app/docs/fixture-inventory.md`
- `forecast-app/static/index.html`

### Story 2.3: planner action view, open items and provenance

Story 2.3 merged in pull request 50 at `655b984` on 2 September 2026, with the corrected brief adopted on the branch before merge. It turns each routing decision into an action a planner can take and captures the answer when they take it. Every decision carries a do this written against section 2 of the brief: the planner's next move, numbers first, no hedging and no method name beyond the decision families. The do this and the classification so what say different things on every decision, and a test proves no sentence appears in both. The `refused_data_quality` action names the specific data request from the quality codes on the line.

A resolution records an answer and changes scope membership, and never changes a routing decision or a quality band by assertion. The effects follow section 3 exactly: `DISCONTINUED_CONFIRMED`, `SUPERSEDED_BY_SKU`, `TREAT_AS_NEW_LINE` and `EXCLUDE_FROM_SCOPE` resolve the line and take it out of forecast scope; `STILL_ACTIVE_DEMAND_GAP` and `STILL_ACTIVE_DATA_MISSING` resolve it in scope; `SUPPLY_LONGER_HISTORY` and `SUPPLY_CORRECTED_EXTRACT` record a data request and keep the line on the open items list as awaiting data; `DEFER` changes nothing. Every code carries a consequence sentence the interface shows before the resolution is applied. A test applies every code to a refused line and asserts the decision, eligibility, band, refusal, reason and action are unchanged and every other line is untouched.

The open items list is its own panel, reachable from the routing panel and from a pill in the run context. It lists every unresolved, awaiting-data or deferred refusal ranked by volume share descending, with a count and a volume total at the top, and its empty state names when the last refusal was resolved. On fixture 31 it opens with five lines carrying 25.39 percent of volume: the five refused lines. The corrected brief states that figure and excludes `policy_only` lines because they carry no refusal; a further 9.04 percent needs a commercial conversation rather than a data answer and belongs with the exceptions in Story 5.3. Q1 in `docs/2.3-open-questions.md` records how the first draft's 34.43 percent arose.

Resolution capture: the drawer on a refused line carries a closed-list picker, a successor picker limited to the SKUs in the file for `SUPERSEDED_BY_SKU`, an optional note and the consequence sentence. There is no free-text path to a resolution. Applying one stamps the time in UTC, re-runs the whole pipeline with the resolutions supplied as `routing_resolutions` on `/api/quality`, and reopens the line. Each applied resolution is a pass in the manifest's routing options with the code, the applied time, the status and the SKU as a hash, never the identifier, following the Story 1.5 filename rule; the readable SKU, successor and note are in the bundle only. Reproduction replays the recorded passes. Provenance: every drawer block carries a tag naming the stage that produced it, the reused metrics carry a title saying quality computed them and classification reused them, and the routing result publishes a field-to-stage map.

The manifest schema is 1.6: routing options gain `passes` and the routing outcome gains resolved, data requested, deferred and out-of-scope counts, all constrained to counts, codes and hashes. The bundle schema is 1.3: the routing result gains the action, the resolution with its note, passes with readable SKUs, resolution effects and statement sources. The routing engine version is 1.1.0. Manifests 1.2 to 1.6 and bundles 1.1 to 1.3 remain accepted.

Local automated verification passes all 119 tests. Two controls were proved able to fail: changing one entry in the effects table fails the effects test, and a do this that repeats the reason fails the register test. A Chromium check of the local application with fixture 31 showed the run context pill reading five open items, the open items panel reading five lines carrying 25.39 percent of volume in the expected order, the `RTG-60403` drawer with five stage tags, the do this text and a closed-list picker with no text input, the consequence sentence appearing on selection before apply, the applied `SUPERSEDED_BY_SKU` resolution recorded with its successor while the decision still read discontinued confirm status, the pill and list dropping to four lines and 12.54 percent, the manifest pass carrying a SKU hash and no readable SKU, the note present in the bundle only, a `DEFER` on `RTG-60501` leaving the list at four with the line marked deferred, the list surviving a panel switch, and the bundle reopening in the browser at version 1.3 with manifest 1.6. The Vercel Preview deployments for the merged head were Ready with no failed check. Against Production, the resolution picker was checked on 2 September 2026 and is a closed list defaulting to the placeholder; the open items list count, the do this text and the resolution effects remain to be checked there. The Production availability gap seen on 2 September 2026 was a client-side DNS resolution failure, NXDOMAIN, so no request reached Vercel; it was not a deployment, hosting or code fault and no deployment was affected.

Open questions and defaults are in `docs/2.3-open-questions.md`. Q1, the open items volume figure, and Q2, the SKU hash in manifest passes, were raised against the first draft of the brief and are closed by the corrected brief, which matches what was built.

Key references:

- `docs/briefs/2.3-build-brief.md`
- `docs/2.3-open-questions.md`
- `forecast-app/routing_engine.py`
- `forecast-app/tests/test_routing_engine.py`
- `forecast-app/tests/test_workspace_ui.py`
- `forecast-app/static/index.html`

## Application routes

| Route | Purpose and return |
|---|---|
| `GET /` | Returns the Forecast Diagnostic HTML interface. |
| `GET /health` | Returns `status` and the selected forecast provider name. |
| `GET /sample-data.csv` | Downloads the synthetic single-SKU demand sample. |
| `GET /sample-portfolio.csv` | Downloads the synthetic portfolio sample with inventory fields. |
| `GET /workspace-assets/{asset_name}` | Returns only the allow-listed Archivo font or stone mark. Other names return 404. |
| `POST /api/validate` | Validates one CSV. Returns validation and a manifest. A rejected file returns 422 and never calls a model. |
| `POST /api/quality` | Validates, assesses quality, classifies and routes. Accepts optional `routing_resolutions` JSON mapping a SKU to a resolution code, applied time, optional successor and optional note, validated against the closed vocabulary. Returns validation, `quality`, `classification_result`, `routing_result`, manifest and confidential bundle. A rejected file returns 422 before quality, classification or routing; an invalid resolution returns 400. |
| `POST /api/analyse` | Validates and forecasts one SKU, then returns the forecast and inventory result plus validation, manifest and confidential bundle. |
| `POST /api/analyse-portfolio` | Validates and forecasts a portfolio with supply inputs, then returns prioritised results plus validation, manifest and confidential bundle. |
| `POST /api/reproduce-bundle` | Verifies an uploaded bundle, reruns its recorded supported stages from the supplied source, and returns the comparison plus the candidate manifest. |

Recorded bundles reopen entirely in the browser. There is no server reopen route.

Current result and evidence versions:

- validation result: 1.1
- quality result: 1.2
- classification result: 1.0
- routing result: 1.1, routing table 1.2, routing engine 1.1.0
- run manifest: 1.6, with legacy 1.2 to 1.5 accepted where the schema permits
- confidential run bundle: 1.3, with 1.1 and 1.2 accepted for reopen and reproduction

## Fixture inventory and deployed check

`forecast-app/docs/fixture-inventory.md` lists every validation, quality, classification, manifest and bundle fixture and explains its planted condition. Machine-readable thresholds and expected behaviour remain in the three expectation JSON files named in the authority order.

For a deployed end-to-end classification check, upload the committed `forecast-app/tests/classification_fixtures/30_classification_portfolio.csv`, set analysis date `2026-08-01`, select monthly frequency and assess data quality. Classification must show 15 lines, 17.7 percent lumpy volume, two unclassifiable lines, 11 populated matrix cells and four disabled empty cells. Selecting A and lumpy must isolate `PKG-50301` at 13.86 percent of volume with caveated quality and `OUTLIER_CANDIDATE`.

For a deployed end-to-end routing check, upload the committed `forecast-app/tests/fixtures/31_routing_portfolio.csv` with the same date and frequency and open Routing. The headline must read 65.57 percent of volume forecast eligible and 34.43 percent not. Filtering by refused data quality must leave `RTG-60401`, `RTG-60402` and `RTG-60502`. `RTG-60403` must read discontinued confirm status despite its not usable band, and `RTG-60301` must read policy only with no refusal block.

## Marketing-site production configuration

- Vercel project: `silurian-site`
- Framework preset: Other
- Build command: empty
- Output directory: repository root
- Production branch: `main`
- Primary domain: `www.silurianconsulting.co.uk`

The site is static HTML and CSS. It has no application framework, package installation or build command. Routine wording is stored directly in `index.html`. The privacy notice is in `privacy.html`.

Archivo is served from `assets/fonts/Archivo-Variable.ttf`. Do not restore Google Fonts or another third-party font request unless the privacy implications have been reviewed. Keep `assets/fonts/OFL.txt` whenever the font is redistributed with the site.

Approved brand palette tokens are charcoal ink `#3f3d3b`, deep logo charcoal `#1a1918`, main orange `#ec6917`, dark logo orange `#c15613` and optional warm neutral `#cabfad`. Deep charcoal is available as `--color-charcoal-deep`; the optional neutral is available as `--color-neutral-brand` but is intentionally unused on the current site.

The main repository is connected to both Vercel projects. Pull requests may therefore show checks for `silurian-site` and `silurian-forecast-diagnostic`. Confirm the check relevant to the changed component, and investigate any unexpected failure before merging.

## Forecast production configuration

The Vercel project uses the `forecast-app` Python application. Production is connected to `main`, and merging to `main` starts a Production deployment automatically.

Vercel configuration inventory at 1 September 2026. This records names and scopes only:

| Variable | Production | Preview |
|---|---:|---:|
| `FORECAST_PROVIDER` | yes | yes |
| `GOOGLE_CLOUD_PROJECT` | yes | yes |
| `GCP_PROJECT_NUMBER` | yes | yes |
| `GCP_WORKLOAD_IDENTITY_POOL_ID` | yes | yes |
| `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | yes | yes |
| `GCP_SERVICE_ACCOUNT_EMAIL` | yes | yes |
| `BIGQUERY_LOCATION` | yes | yes |
| `BIGQUERY_MAX_BYTES_BILLED` | yes | yes |
| `TIMESFM_REFERENCE_BASELINE_SHA256` | yes | yes |
| `TIMESFM_DETERMINISM_JSON` | yes | only the legacy `codex/story-1-3-run-manifest` Preview scope |
| `APP_VERSION` | no custom value | only the legacy `codex/story-1-3-run-manifest` Preview scope |

The marketing Vercel project requires no custom runtime environment variables. Vercel supplies its own system variables to both projects.

The Google Cloud values and the complete determinism JSON belong in Vercel, not in this repository. Never copy credentials, identity tokens or private Google Cloud identifiers into source files, commits, issues, manifests or this handoff.

`BIGQUERY_LOCATION` must select the London BigQuery region in both Preview and Production. Story 1.5 live acceptance verified both Preview and Production jobs in `europe-west2`. Recheck the first Production forecast after any future change that affects deployment settings.

`TIMESFM_MEASURE_DETERMINISM` is a temporary controlled-measurement flag. It must not remain enabled in Production. When enabled in an isolated Preview, each forecast request runs TimesFM ten times and incurs additional time and BigQuery usage.

The approved TimesFM canary output hash is `803063c75e9de5e3e2113be3de5e9614a86988f2589f423417bc1cefabff8a75`. It was last confirmed in Production on 29 August 2026. Every managed forecast runs the fixed synthetic reference series first. A changed rounded output sets `model.reference_check.status` to `drift_detected` and the API fails the forecast with a managed-model-change message. Do not replace the baseline until the provider change has been investigated and documented.

## Authentication and model path

- Vercel obtains a short-lived identity token through its OIDC integration.
- Google Workload Identity Federation exchanges that token for restricted Google credentials.
- The Google Cloud project identifier is supplied by `GOOGLE_CLOUD_PROJECT`. Its value is deliberately not committed.
- The application impersonates the service account named by `GCP_SERVICE_ACCOUNT_EMAIL`. Its value is deliberately not committed.
- No named BigQuery dataset is configured by the application. Parameterised forecast queries use anonymous query-result storage under provider lifecycle rules.
- BigQuery processing region is `europe-west2`.
- BigQuery runs its managed TimesFM 2.5 model through `AI.FORECAST`.
- Query caching is explicitly disabled for managed forecasts.
- No static Google service-account key is stored in GitHub or sent to the browser.
- The browser receives forecast results and provenance only.

## Local development

From `forecast-app/` on a conventional Python 3.12 environment:

```text
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/uvicorn app:app --reload
```

Open `http://localhost:8000`.

The statistical baseline is the safe local default when `FORECAST_PROVIDER` is unset. The managed BigQuery provider requires the deployment identity configuration and should not depend on credentials committed to the repository.

The TimesFM Python package in `requirements-timesfm.txt` is not the Production model path. Native TimesFM is not supported by the current Windows ARM development environment. Production uses BigQuery's managed TimesFM service instead.

## Tests

Run the Forecast Diagnostic tests from `forecast-app/`:

```text
python -m unittest discover -s tests
```

The current local suite contains 119 tests. There is no GitHub Actions workflow, so the Python suite does not run automatically on pull requests. The visible pull-request checks are Vercel deployment checks and Preview feedback only. A developer must run the suite locally until CI is added.

Focused provenance, bundle, stage-consistency and classification checks:

```text
python -m unittest tests.test_app_manifest tests.test_bigquery_timesfm tests.test_run_manifest tests.test_determinism tests.test_run_bundle tests.test_stage_consistency tests.test_validator tests.test_classification_engine tests.test_routing_engine tests.test_workspace_ui
```

On the current Windows machine, the repository's embedded Python can be used when the system `python` command is unavailable:

```text
..\.python-embed\python.exe -m unittest tests.test_app_manifest tests.test_bigquery_timesfm tests.test_run_manifest tests.test_determinism tests.test_run_bundle
```

The fixed live TimesFM test file is:

`forecast-app/tests/run_manifest_fixtures/timesfm_reference_series.csv`

Production smoke-test expectations:

1. The file is accepted.
2. The provider is shown as TimesFM 2.5 through BigQuery.
3. The forecast completes without a reference-baseline error.
4. Provenance shows the approved reproducibility statement.
5. The run manifest downloads successfully.

## Safe delivery workflow

1. Start from the latest `main` branch.
2. Create `codex/<short-change-name>`.
3. Make the smallest coherent change.
4. Run focused automated tests.
5. Push the branch and use the Vercel Preview.
6. Complete the agreed manual fixture tests.
7. Update this handoff with the build scope, files changed, checks completed, configuration impact, limitations and next starting point.
8. Open a pull request into `main`.
9. Merge only after the Preview is approved.
10. Wait for the Production deployment to become ready.
11. Run the relevant Production smoke test.
12. If the Production result differs from the handoff entry, update the handoff immediately through a follow-up documentation pull request.

## Mandatory handoff maintenance

Every build must leave `PROJECT_HANDOFF.md` accurate enough for another AI system or competent developer to continue without access to the previous conversation.

For every build:

- Review the entire handoff, not only the latest-build entry.
- Update the current position and relevant architecture sections.
- Record user-visible changes and the files responsible for them.
- Record test, Preview and Production status without claiming checks that have not run.
- Record environment-variable changes by name only. Never record secret values.
- Remove or correct stale instructions, links and known limitations.
- State the exact next starting point when work remains. Write a commit hash there only when a specific commit is the evidence, such as the merge recorded for a story. Where the text means wherever we are now, write the current head of `main` instead: a hash written into a file that lives on `main` is stale the moment that file merges.

Do not treat the handoff update as optional documentation. It is part of the build definition of done.

## Operational cautions

- Never guess CSV column meanings when more than one plausible mapping exists.
- Never allow a blocking validation finding to call a forecast model.
- Never silently convert missing demand periods to zero.
- Never silently remove or correct outliers.
- Never overwrite the approved TimesFM canary fingerprint without investigating the new output.
- Never enable the ten-run measurement flag during routine Production use.
- Do not expose Google credentials or Vercel secrets in browser output or downloaded manifests.
- Treat every merge to `main` as a Production release.
- Keep environment variables aligned between the approved Preview and Production when promoting a story.
- Never commit a value for `SILURIAN_ACCESS_PASSWORD`, never log it and never default it. The access gate reads it from the environment only. See `forecast-app/docs/access-gate.md`.

## Known limitations

- The application has no user accounts, database or persistent run history.
- Run and validation records are downloaded by the user rather than stored by the service.
- TimesFM is a managed provider, so its hidden checkpoint and training details are not exposed by Google.
- The stored determinism result describes the measured deployment and options. Re-run the controlled measurement after a material model, provider, precision, region or forecast-option change.
- Portfolio decisions still require planner confirmation of operational context, supply assumptions, returns, units and discontinuations.
- The root design-system documentation contains legacy export material. The working Forecast Diagnostic interface is `forecast-app/static/index.html`.
- The repository contains two independently deployed products. A change at the root affects the marketing site; a change under `forecast-app/` affects the Forecast Diagnostic.
- Story 1.4 exposes deliberate reproduction for validation-only, quality and forecast bundles. Forecast reproduction compares the rerun model series and intervals while retaining Story 1.3 model identity, canary, environment and determinism controls.
- Story 1.6 repairs the previously recorded Story 1.1 fixture mismatches. Story 2.0 adds workspace contract tests without changing the engine. Story 2.1 classifies the portfolio. Story 2.2 records a routing decision per line and deliberately runs no method; method implementation is sprint 3.
- Routing resolutions are captured through the interface and recorded as manifest passes, but a superseded line's history is not chained to its successor, and a launch line has no launch route. Both are sprint 3.
- The resolution form in the SKU drawer inherits the two column grid from the base `form` rule rather than declaring its own layout, and that has now broken twice under small changes: the helper text landed beside the Apply button, and the note label landed in the wrong grid cell once the successor picker appeared. Both were fixed in pull request 52 by spanning the affected rows. Story 5.1 should rebuild that block with its own layout rather than patch it a third time.
- Staleness and discontinuation are measured on the last period present, not the last period with demand, so a line reporting explicit zeros for twelve months is never flagged as discontinued. `RTG-60602` in fixture 31 shows it. This is recorded in the Story 2.2 brief and open questions and needs its own story with a stated precedence against `ZERO_VS_MISSING_AMBIGUOUS`.
- GitHub `main` has no classic branch protection and no repository ruleset. Pull requests and passing checks are process controls rather than enforced repository controls.
- No pull-request workflow runs the Python suite. Vercel deployment readiness is not a substitute for automated engine tests.
- Exact Google Cloud project and service-account identifiers are intentionally external to the repository. Vercel and Google Cloud access are required to administer them.
- Written provider assurance about backup scope for the client security questions remains unanswered. This is owned by the product owner and is not a build-session task.
- Five obsolete local worktrees contain line-ending-only CSV changes. See `forecast-app/docs/final-handoff-audit.md`; deletion requires owner approval.
- Branch inventory at 3 September 2026: 62 remote branches besides `main`, of which 52 are fully merged and 10 are not. Eight of the 10 are unmerged only because the history was rebuilt, and their content is present in `main` today, verified line by line rather than by patch identity. The count moves whenever a branch merges, so treat the figures as of that date and recount rather than trusting them.
- `codex/preview-tex-gyre-heros` is a rejected typography experiment, TeX Gyre Heros. `CLAUDE.md` section 9 fixes the system as Archivo only. It holds the only binary assets in the repository that exist nowhere but on a branch, so deleting it loses them.
- `codex/grey-logo` is a rejected palette experiment, a mid grey stone mark. `main` keeps the fixed charcoal and orange tokens.
- Neither is scheduled for deletion. Both are kept deliberately, not by neglect. Bulk branch deletion was considered and declined: nothing is lost, so the tidying is not worth the time.
- Fixture and expectation bytes are protected by `tests/fixture_hashes.json` and `tests/test_fixture_integrity.py`. Git attributes mark the control directories as `-text`, so Git must not convert CSV or Markdown control bytes, and some CSV fixtures intentionally remain CRLF because line-ending handling is part of their expected validation result. Every JSON control file (`expected_*.json`, the goldens and the schema copies) is pinned to LF, matching the LF copies the specification session holds, so a reissued expectations file hashes the same on both sides. This split is a decision, not a detail: JSON control files are `text eol=lf` so that a line-ending mangle self-corrects on checkout instead of stopping a run on a hash mismatch, while CSV fixtures stay `-text` because on some of them, fixture 01 among others, CRLF is the condition under test and must survive byte for byte. Do not tidy the CSV fixtures into the JSON rule.
- The access gate is one shared password with no user accounts, so there is no record of who entered it and it cannot be revoked for one person. The fixed one second delay on a wrong attempt is not a rate limit, because real rate limiting needs state shared between serverless instances and this application deliberately has none. A long password is the control. Vercel's own deployment protection is stronger and should replace this if the project moves to a paid plan. See `forecast-app/docs/access-gate.md`.
- Panel render order can break a sentence the suite considers passing. In band 2.7 the readiness sentence rendered truncated in the browser while all tests were green, because the quality panel renders before routing and routing owns the counts the sentence states. `test_routing_refreshes_the_sentence_because_routing_owns_the_counts` pins that one ordering; nothing generalises it. Any story that composes text across stages needs a browser check before acceptance, because a green suite does not prove the screen.

## Band 2.7, say it to a planner

Built from `docs/briefs/2.7-build-brief.md` on 3 September 2026. Words and placement only. No decision, threshold, engine behaviour or schema moved, so neither schema version changed.

What it added, and the planner finding each one answers:

| Story | Change | Finding |
|---|---|---|
| 2.7.1 | One readiness sentence above the stage verdicts, which stay underneath | Accept and not usable appeared together with nothing relating them |
| 2.7.2 | The `model_eligible_wide_interval` and `policy_only` action texts rewritten | The two texts the product sells, and both failed |
| 2.7.3 | Cursor, hover, an Open affordance on all three grids, and a hint that retires itself on first use | The detail drawer was not discovered |
| 2.7.4 | The membership rule stated where the open items list is | Five lines were open and the reason those five was invisible |
| 2.7.5 | `forecast-app/glossary.py`, served at `/api/glossary`, rendered by the Glossary tab and the printed method appendix | `caveated` against `not usable` was not operationally clear |
| 2.7.6 | One purpose sentence per panel; terms carry their definition on the control | Vocabulary was never taught |
| 2.7.7 | Four lines before upload: what it checks, tells, refuses, and does with the file | A stranger met a file box |
| 2.7.8 | Source and run identifiers behind a disclosure; routing summary compressed | Provenance too prominent, summary too dense |

Two departures from the brief, both recorded in `docs/2.7-open-questions.md` with the reasoning:

1. The readiness sentence reads seven of fourteen, not the nine the brief gives. `expected_routing.json` v1.1 routes seven lines eligible, five as open items and two as `policy_only`. Nine counts the two policy-only lines as forecastable, which is the conflation story 2.7.4 exists to expose.
2. The sentence gains a third clause naming those two lines, so it accounts for all fourteen. Seven plus five is twelve, and an unreconciled headline is the defect this band fixes rather than a fix for it.

Verification, all local:

- 162 tests pass, up from 125. New: `tests/test_glossary.py` (10) and `tests/test_planner_copy.py` (27).
- Eleven probes proved the new controls fail: an undefined term, an eighth routing decision with no definition, a definition copied into the interface, the report building a second copy, the appendix put back on screen, the old wide-interval wording, a two-sentence purpose line, a grid losing its Open affordance, the membership rule removed, the identifiers back in the open, and the landing state dropping where the data goes. All reverted.
- The run bundle and manifest goldens were regenerated because the action text changed, and their hashes re-recorded in `tests/fixture_hashes.json`. Only three values moved in the manifest golden: the routing output reference and the two integrity hashes chaining from it. No copy reached the manifest, which is the no-client-data rule holding.
- Driven in Chromium against fixture 31 at analysis date 2026-08-01. The readiness sentence read: "Your file was accepted and processed. 7 of 14 lines can be forecast. 5 need an answer from you first, covering 25.39 percent of volume. 2 need a commercial decision rather than a forecast." The glossary tab and the print appendix rendered 37 identical entries from one fetch. The hint appeared once and was gone after a line was opened.
- Panel heights measured before and after at 1400 by 1000: the five workspace panels together went from 6833 to 6837 pixels. The default quality panel went from 1571 to 1615. The sticky run context grew 69 pixels for the readiness sentence and the landing page grew 260 for the pre-upload copy, both deliberate and named in the brief.

Not done, and needed before this band is accepted: the second planner test. Band 2.7 is built, not accepted.

## Next starting point

Sprint 2 is closed. Criterion 16 passed on 2 September 2026 and the record is in `docs/planner-test-findings.md`. Band 2.7 is the remediation it earned, and its own acceptance is the same test run again: a second planner, who has not seen the tool, taken through `docs/planner-test-pack.md`. The bar is that they can state what the run concluded, what is waiting on them, and what to do about one refused line and one policy-only line, without asking a question. That test cannot be run from a build session, and until it is run band 2.7 is built but not accepted. If it finds a twelfth item, the band is not finished. Story 2.2's Production check is complete and passed on 2 September 2026. Story 2.3's Production check is partly done: the resolution picker passed, and three items remain to be checked against Production and recorded here, namely the open items list count, the do this text and the resolution effects. Story 2.6, the staleness gap, and sprint 3 forecasting methods are now unblocked and start once band 2.7 is accepted by a second planner; `docs/2.2-open-questions.md` Q10 describes the staleness story, which measures discontinuation on the last period with demand rather than the last period present.

Superseded note, kept for the record: the previous starting point read "Do not begin Story 2.2 until cold-start handover pull request 44 is merged and Production is green. The local handover work is complete at commit `727ce83`: `CLAUDE.md` was followed, 86 tests passed, fixture 30 passed against Production, fixture hashes were pinned, the guard was proved by a deliberate one-byte failure, both surviving UI defects gained regression coverage, and the missing-information record was added. After merge and Production confirmation, Story 2.2 can start from current `main`. Its three product decisions remain pending: whether not-usable quality forces refusal, whether an override exists and is recorded, and whether fixture 31 is required for refusal paths. The current recommendation is refusal, no override until sprint 3, and a new fixture 31. Preserve Story 2.1 classifications as evidence and implications only until the routing contract is approved.

## End-of-build handoff checklist

Update this file with:

- story status and merge reference
- production deployment status
- user-visible behaviour delivered
- files and components changed
- environment-variable additions, removals or scope changes, without secret values
- automated and manual test results
- approved fixtures and expected outcomes
- known defects, limitations and deferred decisions
- exact next starting point
- current production and repository links
- current marketing-site privacy, cookie and third-party-service position

The handoff is complete only when another competent developer or AI system could continue safely without relying on the previous conversation.
