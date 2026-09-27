# Analytics opt-out: evidence, 27 September 2026

Branch `claude/analytics-opt-out`. Marketing site only. Assay is out of scope and loads no analytics.

## What was run

- `python -m unittest discover -s tests` from `forecast-app/`: 294 tests OK on `main` (9bba55a), 303 OK on this branch. The nine new tests are in `tests/test_marketing_site_analytics.py`.
- The new control was proved to fail: with `globalPrivacyControl === true` replaced by `false` in `delivery.html`, `test_every_page_loading_analytics_registers_the_opt_out_first` failed naming `delivery.html`. File restored afterwards.
- Local browser run, Chromium 1194 through Playwright, pages served by `python3 -m http.server` from the repository root. Script: `docs/evidence/analytics-opt-out/local-browser-check.mjs`.

## The limit of the local run

Vercel's real `/_vercel/insights/script.js` could not be fetched: vercel.com, va.vercel-scripts.com and every *.vercel.app host are blocked by this session's network policy. The browser run replaces that script with a stand-in that reads the `window.vaq` queue, applies the registered `beforeSend` and posts one page view. It proves the pages' own code. It does not prove Vercel's script honours `beforeSend`. That half rests on Vercel's `@vercel/analytics` 2.0.1 package, fetched from npm, which registers the same hook as `window.va("beforeSend", fn)` and types it as returning the event or `null` to cancel it.

**No Vercel Preview was opened.**

## Local results, page views sent per page load

| Case | index | delivery | forecast-risk | forecastability | privacy |
|---|---|---|---|---|---|
| Analytics on | 1 | 1 | 1 | 1 | 1 |
| After Turn off | 0 | 0 | 0 | 0 | 0 |
| After Turn on | 1 | 1 | 1 | 1 | 1 |
| Global Privacy Control on | 0 | 0 | 0 | 0 | 0 |
| Storage blocked, no signal | 1 | 1 | 1 | 1 | 1 |
| Storage blocked, signal on | 0 | 0 | 0 | 0 | 0 |

The script file loaded once on every one of those 30 page loads.

## privacy.html states read in the browser

| Case | Button | Status |
|---|---|---|
| First load | Turn off analytics in this browser | Analytics is on in this browser. |
| After Turn off, and after a reload | Turn on analytics in this browser | Analytics is off in this browser. |
| After Turn on, and after a reload | Turn off analytics in this browser | Analytics is on in this browser. |
| Global Privacy Control on | disabled | Analytics is off in this browser because it sends a Global Privacy Control signal. |
| Storage blocked | hidden | Your browser settings prevent saving this choice. |

Button corner radius read through `getComputedStyle`: 0px in every case.

## Still to do

Run the four checks in a real Vercel Preview in a browser that can reach it, using the Network tab: a request to `/_vercel/insights/view` on a normal load, none after pressing the button, one again after pressing it a second time, and the status text after a reload.

Done on the same day: see the next section.

## Vercel Preview check, 27 September 2026

Run by the product owner in a real browser on the pull request 148 Preview, `silurian-site-16zch009u-silurian.vercel.app`, against Vercel's own `/_vercel/insights/script.js`. Reported to the build session, which could not reach the Preview itself.

- **a. Analytics on:** `POST /_vercel/insights/view` sent.
- **b. After pressing the button:** no `/view` request on `index.html`, `delivery.html`, `forecast-risk.html`, `forecastability.html` or `privacy.html`. `script.js` still loaded.
- **c. After pressing it again:** `/view` requests returned.
- **d. Status text after a reload:** correct in both states.

This closes the gap the local run left open: Vercel's real script honours the `beforeSend` check.
