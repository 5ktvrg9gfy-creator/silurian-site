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
