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

## Vercel Preview check, 18 October 2026

Run by the product owner in a real browser on the branch Preview, `silurian-site-git-notes-page-silurian.vercel.app/notes`, at `f6debe9`. Reported to the build session, which cannot reach Vercel hosts.

- **Sign-in works** with `SILURIAN_NOTES_PASSWORD`, now set for Preview and Production. It was set for Production only at first, which is what caused the earlier wrong-password failures on the Preview. Nothing in the code was wrong.
- **A new note saved**, showed Saved, and survived a page refresh. This is the first proof against a real store that the Blob sign-in works through `BLOB_STORE_ID` and Vercel's runtime identity token, which the section above could only show with a stand-in. It also closes the gap recorded there: Vercel's production runtime does put the identity token on a Node function's request.
- **The note was visible on a second device.**
- **Conflict:** an edit saved on one device, then typing on the other, showed the changed-elsewhere message and kept the text on screen.

Approved to merge by the product owner on 18 October 2026, through pull request 149. Q10 stays open and is not built, by his instruction.

Not run: Production. That follows the merge.

## Production check, 18 October 2026

Merged through pull request 149 by merge commit `88ca998`, from branch head `b58f732`. Run by the product owner on `www.silurianconsulting.co.uk` after the deployment of `88ca998` showed Ready. Reported to the build session, which cannot reach the production domain. All eight items passed:

1. `/notes` shows the sign-in screen and no notes.
2. A wrong password is refused.
3. The right password signs in.
4. A new note saved and survived a refresh.
5. The note shows on a second device.
6. An edit saved on one device, then typing on the other, showed the changed-elsewhere message and kept the typing on screen.
7. `index.html`, `privacy.html` and `delivery.html` are unchanged, and the analytics button on `privacy.html` works.
8. The test note was deleted.

## Version 2: sign out, delete from the list, search, 18 October 2026

Branch `notes-v2`, from `main` at `596d38e`. Not merged. Only the notes page, its `api/` routes and their tests changed, plus this record, the questions file and a second local browser check beside the first.

**What was built.**

- **Sign out.** A Sign out button in the bar, on the list and the edit view. It calls `DELETE /api/session`, which answers 200 with the cookie set empty, `Max-Age=0` and a 1970 expiry, on the same path and flags it was set with. It sits behind the gate like every route but login, so CLAUDE.md's "every route except login answers 401" stays true. Unsaved edits get the existing leave warning first. The page then empties every note from itself, rewrites its address to `/notes` and shows sign-in; a page restored from the back-forward cache checks the session again on arrival.
- **Delete from the list.** A Delete button on each row, with the edit view's own confirmation ("Delete this note? This cannot be undone.", Delete note, Keep) and the same `DELETE /api/note`. The row goes on success. On failure it stays and says "Could not delete this note. Nothing was changed. Try again.", the edit view's sentence.
- **Search.** One box above the list. **Mechanism: the server searches; the list route reads every note in full behind the cookie check and returns each match's title and first matching line, and the page asks a quarter second after typing stops.** The search text travels URI-encoded in an `X-Note-Search` header, not in the address, so it stays out of request logs. Matching is a plain lower-cased substring test per line, never a pattern. A long line is cut to 160 characters around the match. 200 characters at most. Clearing the box restores the list; no match says "No notes contain" and the text.

**Acceptance criterion 1, plainly: the gate is stateless and cannot revoke a cookie.** Sign out returns an expired cookie and the browser drops it, so every route then answers 401 for that browser. A copy of the old value taken before sign out still opens the API until its own expiry, up to 30 days, or until `SILURIAN_NOTES_PASSWORD` is changed, which revokes every cookie at once. The cookie is HttpOnly, so page script cannot read it to copy it. Session storage was not built, as the brief said. The limit is pinned by a test so it cannot change silently, and recorded as Q11.

**Tests.** `notes-tests/v2.test.js`, 14 tests, one or more per criterion. `npm test`: 53 before, 67 after, all passing, the conflict tests included. Two existing tests were extended rather than changed in meaning: the gate's wiring test now counts seven gated handlers, not six, and its route list includes sign out; `vercel-local.check.js` now also calls `DELETE` on the session route. `python -m unittest discover -s tests` from `forecast-app/`: 318 before and after, passing. `npm run test:vercel`: 2 of 2.

**Proved to fail.** Six defects planted in the API, each reverted: the search as a pattern (failed criterion 4), case-sensitive search (criteria 3 and 4), search skipping the cookie check (criteria 1 and 5), a sign-out cookie that does not expire, one on the wrong path (criterion 1 both times), and search reading only the first 50,000 characters (criterion 3).

**Local browser run.** `docs/evidence/notes-page/browser-check-v2.mjs`, Chromium through Playwright against the real page and handlers over an in-memory store: 24 of 24. It covers the search cases on screen, the header carrying the search and the address not, the row confirmation, Keep, a failed delete keeping the row, a delete surviving a reload, the leave warning on sign out with an unsaved edit, the cookie gone after sign out, no note text left on the page, every Back step through the history (8 steps, 7 onto a note's own `#n/` address) showing sign-in and no note text, refresh, signing in again, and no sideways scroll at 360px. The first version's check, `browser-check.mjs`, still passes 38 of 38. The first Back check passed on two steps that never reached a note's address; it was tightened before it was accepted.

**Not run.** The Preview, the real Blob store and Production. Search speed on the real store is not measured: each search reads every note, two small requests per note.

## Notes version 2: Vercel Preview check, 18 October 2026

Run by the product owner in a real browser on the branch Preview, `silurian-site-git-notes-v2-silurian.vercel.app/notes`, at `68059ed`. Reported to the build session, which cannot reach Vercel hosts. Nine checks, all passed:

1. The Search box and the Sign out button are shown.
2. Search found a word deep in a note, ignoring case.
3. Search matched `` `npm ci` `` with its backticks.
4. A search with no match showed the no-results message correctly.
5. Clearing the box restored the list.
6. Delete, then Keep, left the note.
7. Delete confirmed removed the note, and it stayed gone after a refresh.
8. After Sign out, Back showed only the sign-in screen.
9. After Sign out, refresh showed only the sign-in screen.

**Not in the reported results**, so not claimed here: the leave warning on Sign out with an unsaved edit, and the second-device conflict check on this branch. Both are covered by the local browser run and the Node suite, not by the Preview.

Decisions the same day: Q11 accepted, a copied cookie stays valid until expiry and a lost device is answered by changing the password; Q12 done in this pull request; Q10 stays open and is not built. Approved to merge through pull request 150.

Not run: Production. That follows the merge.

## Sign out fix: Production items 5 and 6, 18 October 2026

Branch `notes-signout-fix`, from `main` at `8ad059d`. Not merged. The product owner's Production check of `8ad059d` failed two items on `www.silurianconsulting.co.uk/notes`: item 5, typing a change and pressing Sign out at once signed out with no "Saved" and no warning; item 6, after Sign out, Back showed a quick flash of the notes screen before sign in.

**What happened, reproduced on `main`'s page** with `docs/evidence/notes-page/browser-check-signout.mjs`, as a computer and as a phone (Chromium's Pixel 7 emulation: touch, small screen, mobile user agent):

- **Item 5: the edit was saved, not lost.** On `main` a typed change followed at once by Sign out was in storage afterwards, on both, and so was one whose save was slowed to 1.5 seconds; Sign out waited for it with "Saving" on screen. On a normal connection the save takes a fraction of a second and the screen goes straight to sign in, which matches what was seen. Production storage could not be read from here, so the proof for Production is opening that note again, which is in the Preview steps. **The real defect was on the failure path:** when the save failed, `main` offered "Leave anyway and lose the unsaved changes?", and accepting it signed out and lost the text, on both.
- **Item 6: the flash was the empty notes screen, with no title or note text in it.** Back after Sign out moves between the page's own `#n/` addresses inside one page, so no back-forward cache is involved there. `main` showed the list, the New note and Sign out buttons and the editor at once on every step, and only then asked the server and switched to sign in. The recorder saw the list, the buttons and the editor shown, each empty, because sign out had already emptied them. **The back-forward cache was a second, real leak:** with no-store off, standing in for a browser that caches such pages anyway, a page left while signed in and restored after signing out in another tab came back showing the list **with the note titles**, on both, until the session check answered. Chrome on a computer refuses to cache this page, because both the page and its API answers are no-store, and said so: `MainResourceHasCacheControlNoStore` and `JsNetworkRequestReceivedCacheControlNoStoreResource`.

**Why the earlier browser checks passed while Production failed.** They read the screen only after each step had settled, half a second later, so a notes screen shown for a moment and then replaced by sign in was never seen; and Playwright switches the back-forward cache off by default, so no cache restore could ever happen in them. Both gaps are closed: the new check and `browser-check-v2.mjs` now record every time a notes view is shown at all, with what it held, and the new check turns the cache back on and proves a restore happened before judging it.

**The fix, `notes/index.html` only.**

- Sign out saves unsaved edits first, then signs out. If that save fails, is refused as a conflict or the note is over 1 MB, it does not sign out and offers no "Leave anyway": the user stays on the note with the text and the existing plain message. The edit view's own Back and New note keep their existing behaviour.
- A navigation never shows the list or the editor until the server has answered for it: the list after `/api/notes`, a note after `/api/note`, a new note after `/api/session`. Until then the screen stays as it was, which after sign out is sign in. Each navigation is numbered so a slow answer cannot paint over a later one. A note that cannot be opened no longer rewrites the address when the page is already on sign in.
- The page empties itself on `pagehide`, so whatever a back-forward cache keeps holds no note and shows only the wordmark and "Loading."; on return it asks the server before showing anything.
- Already true and now held by test: every API answer and the page are `Cache-Control: no-store`.

**Tests.**

- `notes-tests/no-store.test.js`, 3 tests: every API answer across 200, 201, 400, 401, 404, 409, 413 and 500, sign out included, says no-store; `/notes` and `/notes/(.*)` are served no-store; the page empties itself on `pagehide`. `npm test` 67 before, 70 after, all passing. Proved to fail: against `main`'s page the `pagehide` test fails, and a planted `no-cache` on the API fails the first.
- `browser-check-signout.mjs`, 26 checks, 13 as a computer and 13 as a phone. **On `main`'s page: 16 of 26.** Failing there: the failed save keeping the user signed in on the note, the session still valid after it, the conflict case, Back never showing the notes screen, and the cache restore showing no view and no title, each on both. On the fixed page: 26 of 26. The two item 5 success checks pass on `main` as well, because `main` already saved before signing out; that is the finding above, not a check that cannot fail.
- `browser-check-v2.mjs`: the sign out with a failed save check now expects the new behaviour, and a check that no Back step shows the notes screen even for a moment was added. 25 of 25 on the fixed page; on `main`'s page it fails the sign out checks. `browser-check.mjs`: 38 of 38.
- The `forecast-app` suite: 318, passing. `npm run test:vercel`: 2 of 2.

**Not run.** The Preview, Production and the real Blob store. A real phone: the phone runs are Chromium's emulation, not Safari on an iPhone or Chrome on Android, and Safari's back-forward cache rules differ from Chrome's.

## Sign out fix: Vercel Preview check, 19 October 2026

Run by the product owner on the branch Preview, `silurian-site-git-notes-signout-fix-silurian.vercel.app/notes`, at `c0629ca`, on a phone and on a computer. Reported to the build session, which cannot reach Vercel hosts. All six steps passed, as reported:

1. A word typed at the end of a note, then Sign out straight away, landed on the sign-in screen.
2. Signed in again, the word was in the note. This also answers Production item 5: the save before sign out works on a real device.
3. Back, pressed several times after Sign out, stayed on the sign-in screen with no flash of the notes screen, and then left the site for the browser's home page, which is normal browser behaviour. Forward from there, and opening the notes address directly, both showed sign in, so the session had ended.
4. Forward and refresh after Sign out showed only sign in.
5. Signed in on the list, left for another page, signed out elsewhere, then Back: sign in, never the list or a title.
6. With the network off, Sign out kept the user on the note with the text and "Not saved".

The report did not say which phone or browser was used, so a specific browser is not claimed here.

Not run: Production. That follows the merge.

## Sign out fix: Production check, 19 October 2026

Run by the product owner on `www.silurianconsulting.co.uk` after pull request 151 merged (merge commit `e657105`). Reported to the build session, which cannot reach Vercel hosts. **Items 5 and 6 and the homepage spot-check all passed.** Item 5 is the typed change followed at once by Sign out, with the word still in the note on signing in again; item 6 is Back after Sign out showing no notes screen. Recorded here on the `notes-v3` branch, not as a separate push to `main`.

The report did not say which phone or browser was used, so a specific browser is not claimed here. Nothing outstanding on the sign out fix.

## Notes version 3: Production check, 20 October 2026

Run by the product owner on `www.silurianconsulting.co.uk` after pull request 152 merged (merge commit `1af386e`, from branch head `235bf2a`). Reported to the build session, which cannot reach Vercel hosts. **The check passed.** The report did not say which phone or browser was used, so a specific browser is not claimed here. Recorded on the `notes-v4` branch, not as a separate push to `main`. Nothing outstanding on version 3.

