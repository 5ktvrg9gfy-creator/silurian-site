# Notes page: evidence, 17 October 2026

Branch `notes-page`, cut from `main` at `03ee354`. Marketing site only. Not merged, not deployed. Nothing under `forecast-app/` changed (`git diff --name-status origin/main` shows two modified files, `.gitignore` and `CLAUDE.md`, and every other path added).

## What ran

- `npm test` at the root: **39 Node tests, 39 pass**, none skipped. Files: `gate.test.js`, `roundtrip.test.js`, `blob-store.test.js`, `no-leak.test.js`, `site.test.js`.
- `python -m unittest discover -s notes-tests` from the root: **7 tests pass.** One runs the whole Node suite and fails, not skips, if Node or `node_modules` is missing. Six hold `notes/index.html` to the site's raw colour, type size, undeclared variable, radius, Archivo and dash rules.
- `python -m unittest discover -s tests` from `forecast-app/`: **303 before, 303 after, passing.** Unchanged, because the Python tests for this work sit outside `forecast-app/` (question Q9). The secret scan (`test_no_committed_credential_anywhere_in_the_tree`) ran with the new files staged and passed. This run needed `pip install -r requirements.txt` first, because the container had no `fastapi`; three modules errored on import until then, on `main` too.
- Browser run, Chromium 1194 through Playwright, `docs/evidence/notes-page/browser-check.mjs`: **29 checks, 29 pass.** It serves the real page and the real API handlers over an in-memory store and a password generated for the run. Covered: login, wrong password, cookie flags, new note, the Not saved / Saved sequence, autosave, reload round trip, copy, edit in place, a failed save and its retry message, the leave-page warning, the 1 MB message with no request sent, delete with Keep and Delete, no sideways scroll at 375px, falling back to login when the cookie is gone. Four screenshots were looked at: login, list at phone width, edit at phone width and at desktop.

## Acceptance criteria

1. Round trip byte for byte, fixture over 50,000 characters with tabs, trailing spaces, blank lines, CRLF, LF and a lone CR in one note, backticks, a code fence, Cyrillic, Arabic, Japanese, emoji, a zero width space and a leading byte order mark: `roundtrip.test.js`, plus fifteen single-character cases. Also through the Blob adapter in `blob-store.test.js`.
2. Exactly 1 MB (1,048,576 bytes) and 1 byte under both save. 1 byte over is refused with 413 and the message. The saved text, title and time are untouched. The limit is on bytes, proved with 600,000 two-byte characters.
3. Six handlers, each with no cookie, a different cookie name, an expired cookie, a cookie signed under another password, and six tamperings: 401 every time, with a store spy proving nothing was reached. Also run against the three real route files.
4. Password unset, empty or whitespace: login fails for every attempt, and no cookie signed under any password opens any route.
5. Eleven kinds of wrong password: 401, no `Set-Cookie`, a one second delay each.
6. Delete removes both files from storage and the note from the list, and leaves a second note alone.
7. `site.test.js`: `vercel.json` holds only `/notes` rules, and no rule matches any of the 11 existing URLs checked. The five pages are not modified (`git diff --name-status origin/main`). Not proved: that Vercel serves them, which needs the Preview.
8. A full session with a failing store, wrong and right logins and every route: the password, cookie value and a stand-in storage token appear in no log line and no response body. The one console call in the API is a fixed line naming no detail, and the test saw it fire.

## Controls proved able to fail

Each was mutated, the suite run, and the file restored. Every one failed the suite except the first, which was an equivalent mutation.

- Unset-password refusal removed in `requestIsSignedIn` only: still refused, because `cookieIsValid` refuses too. Removed in both: failed.
- Expiry check removed, signing key not derived from the password, post-read and declared-length limits each removed, unset password opening login, failure delay removed, delete leaving the metadata file, error message logged, SameSite weakened to Lax, route guard removed: each failed one or more tests.
- On the site checks: adding `cleanUrls`, a rewrite catching `/`, a link to `/notes` in `index.html`, a raw hex colour, the robots tag removed, an analytics script, a 13px font size, an 8px radius and an em dash: each failed.

## What was not run

- **No Vercel Preview and no Production.** This session's network blocks Vercel hosts. The Web handler style on the Node runtime, `vercel.json`, the `/notes` rewrite and the response headers are untested on Vercel (Q7).
- **No real Blob store.** `@vercel/blob` 2.8.2 was installed and its types read, but no store or token exists here. The adapter is tested against an in-memory stand-in for the package. Private access, overwrite in place and `useCache: false` are asserted on the calls made, not observed on a store.
- **No other browser than Chromium**, and no real phone. Phone width was a 375px viewport.
- **The Vercel project settings.** Whether the static project's root directory, framework preset or ignore settings change when a `package.json` appears was not visible from the repository.

## Limits worth knowing

- A browser text box turns Windows line endings into Unix ones on the page (Q3). The API and storage keep every byte.
- A second device editing the same note overwrites it (Q2).
- The repository root is probably served in full by the static project (Q5).

## Rebase onto the allowlist fix, 18 October 2026

The branch was rebased onto `main` at `2d500b6` (the `site-public-allowlist` merge). Conflicts in `.gitignore`, `CLAUDE.md` and `vercel.json` were resolved by keeping both sides. Then: `notes/` added to `site-allowlist.txt` and `PUBLIC_FILES`; the two tests that pinned `vercel.json` now allow the build settings beside the `/notes` rules; the local build puts `notes/index.html` in `public/` and no private file. Removing `notes/` from the allowlist fails the allowlist test. After the rebase: `npm test` 39 of 39, `notes-tests` Python 7 of 7, `forecast-app` suite 311 of 311, browser check 29 of 29.

Still not run: the Vercel Preview, a real Blob store, and whether root `api/` functions deploy with `outputDirectory` set to `public` (Q2 in the allowlist questions file).

## Version check, Python move and the api deployment proof, 18 October 2026

- **Version check.** `conflict.test.js` (8 tests) and two more in `blob-store.test.js`. A stale save, a save of a note deleted elsewhere and a save with no version all write nothing; two saves in the same millisecond still get different versions; the adapter checks the version with a `head` of the text and a read of the small metadata file and never downloads the note. Five mutations each failed the suite: version comparison removed, deleted-elsewhere check removed, same-millisecond floor removed, missing version accepted, adapter reading the text. `npm test`: 50 of 50.
- **Browser run** now also covers the conflict: another device saves, the page refuses, shows "your edits were not saved" with the text still on screen, stops retrying, still copies, asks before leaving, and after reopening saves normally. 38 of 38. Screenshot of the conflict state was looked at.
- **Python move.** `forecast-app/tests/test_notes_page.py`, seven tests, in the normal suite. The suite was 311 with the allowlist work and is 318 with these. It runs the Node suite and needs `npm ci` at the root first.
- **Do the `api/` functions deploy with the output directory set to `public`?** Shown locally, not on Vercel. `npm run test:vercel` (`notes-tests/vercel-local.check.js`, needs the network, not part of `npm test`) runs `vercel build` pinned to CLI 64.5.0 on a copy of the repository with the real `vercel.json`. Result: four functions (`login`, `note`, `notes`, `session`, Node 22), the `_lib` folder is not a route, the static folder holds exactly the eleven allowlisted files, and the routes send `/notes` to its page and everything else to the 404 page. The same check installs `@vercel/node` 24.0.3 and runs each route file under its wrapper: every method export answers through the handler, a wrong password gets 401 with no cookie, the right one gets a Secure HttpOnly SameSite Strict cookie, and that cookie opens the session route. The check was broken twice and failed each time: `CLAUDE.md` added to the allowlist, and `GET` renamed in `api/session.js`.
- **Not shown:** Vercel's production launcher (the wrapper run is Vercel's own dev server code, which shares the Web handler code but is not the production process), the Preview, and a real Blob store.

## Blob credentials, 18 October 2026

The private store was connected to `silurian-site` for Preview and Production. Vercel added `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` and no `BLOB_READ_WRITE_TOKEN`. `SILURIAN_NOTES_PASSWORD` is added by the product owner separately.

**How the package authenticates, read from source.** `@vercel/blob` 2.8.2, the current `latest` on npm, was unpacked and `resolveBlobAuth` read. In order: an explicit `token` option; otherwise an identity token, either passed as `oidcToken` or read by `@vercel/oidc` from the `x-vercel-oidc-token` header in Vercel's request context (falling back to `VERCEL_OIDC_TOKEN`), paired with a `storeId` option or `BLOB_STORE_ID`; otherwise `BLOB_READ_WRITE_TOKEN`; otherwise "No blob credentials found". API calls send the token as `Authorization: Bearer` and the store as `x-vercel-blob-store-id`, and private reads go to `<store id>.private.blob.vercel-storage.com` with the same bearer token. The package changelog dates identity token support to 2.4.0 and the refreshing read to a later 2.x release. **No version change is needed; 2.8.2 stays pinned.** Vercel's documentation site could not be read: vercel.com, unpkg and jsdelivr are blocked from this environment. The README and changelog were read from the package's GitHub source.

**What changed.** The adapter already passed no credentials, so the package found the identity token by itself. The code change is a comment in `api/_lib/store.js` saying so and forbidding a token option, plus corrections to the two records that named `BLOB_READ_WRITE_TOKEN`: CLAUDE.md section 3 and the handoff entry.

**The new test, `notes-tests/blob-auth.test.js`, three tests.** It sets exactly `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY` and `SILURIAN_NOTES_PASSWORD`, removes `BLOB_READ_WRITE_TOKEN` and `VERCEL_OIDC_TOKEN`, puts an identity token in a stand-in for Vercel's request context, and drives the real adapter over the real package through write, list, read, stamp and remove, with every HTTP request caught by an `undici` mock before it leaves the process. Every request carried the identity token, and every API request named the store. A second test proves the first depends on `BLOB_STORE_ID`. A third fails if any file in `api/` names `BLOB_READ_WRITE_TOKEN` or passes a `token` option in code; comments are stripped first so the adapter can say why it does not, and the stripper is itself checked so it cannot pass the scan by deleting code.

**Proved to fail.** Three changes to `api/_lib/store.js`, each reverted: refusing to start without `BLOB_READ_WRITE_TOKEN` failed all three tests; passing `token: process.env.BLOB_READ_WRITE_TOKEN` failed the scan; passing a fixed token failed all three. The mock's own first version answered `head` with the list handler, so `head` was never really exercised; it was caught because the stamp after a delete went wrong, fixed, and the test now asserts a `head` request was made.

**Suites.** `npm test`: 50 before, 53 after, all passing. `python -m unittest discover -s tests` from `forecast-app/`: 318 before and after, all passing.

**Not shown.** That Vercel's production runtime puts the identity token on a Node function's request context. Vercel's published `@vercel/node` 24.0.3 contains only the development server, which sets the request context without headers, so this could not be read. The same header is what the Assay project's Python functions already read in Production to reach Google Cloud. The first save on the Preview is the proof. Not run: the Preview, the real store.
