# Notes page: open questions

Branch `notes-page`. Format per CLAUDE.md section 1: what it blocks, the recommended default, the cost if wrong. Resolved on 18 October 2026 by the product owner's answers: Q1 keep the monospace box (CLAUDE.md section 9b), the overwrite question built as a version check, Q9 moved into the `forecast-app` suite, the line ending, brute-force and sign-out limits accepted as reported, Q5 closed by the allowlist fix. The product owner's message numbered the overwrite question Q3 and the line ending question Q2, the reverse of this file; the content of each answer is unambiguous and is applied by content. Nothing is waiting on a decision.

## Q1. Monospace in the note box, against "Archivo only" (ANSWERED 18 October 2026: keep it, recorded in CLAUDE.md section 9b)

- **Blocks:** nothing built. CLAUDE.md section 9 says Archivo only and "there is no mono in the system". The brief asks for a plain monospace text box. The two disagree and CLAUDE.md says to raise it rather than choose.
- **Default as built:** the note box alone uses the system monospace stack. Every other element is Archivo. `test_archivo_everywhere_but_the_note_box` pins it to exactly one monospace declaration.
- **Cost if wrong:** one CSS line. Pasted scripts lose column alignment if Archivo is chosen, and tabs and indented code read worse.

## Q2. Two devices editing the same note overwrite each other (ANSWERED, built: a version check, 409 and the text kept on screen)

- **Blocks:** nothing built. Saves are last write wins. A stale tab left open on a phone, then typed into, replaces the newer text saved from the desktop.
- **Default as built:** none. Version 1 as briefed.
- **Recommended:** the client sends the last-edited time it holds and the server answers 409 if the stored time differs, with a "this note changed on another device" message. About 30 lines and one test.
- **Cost if wrong:** one overwritten script. Autosave makes it silent.

## Q3. A browser text box turns Windows line endings into Unix ones (ACCEPTED as reported)

- **Blocks:** nothing built. The server and the storage round-trip every byte exactly, including `\r\n` and a lone `\r`, and the tests prove it. A browser `<textarea>` normalises line breaks to `\n` in its value, so a Windows-style script pasted into the page is stored with `\n`.
- **Default as built:** accept it. Scripts that run on Unix or in an editor are unaffected.
- **Cost if wrong:** replacing the text box with a different editor control. Not small.

## Q4. Brute-force protection is a delay only (ACCEPTED as reported)

- **Blocks:** nothing built. A failed login waits one second before answering, as briefed. Many parallel guesses are not limited, because the gate keeps no state.
- **Default as built:** a long random password, which makes the delay enough.
- **Cost if wrong:** a stored attempt counter (Vercel KV or the same Blob store) and lockout rules.

## Q5. Is the whole repository root served publicly? (CLOSED: yes, fixed by `site-public-allowlist`, merge `2d500b6`)

- **Blocks:** not this branch, but it matters more now. The root has no `.vercelignore` and no build output directory, so the static project probably serves every file at its path: `CLAUDE.md`, `PROJECT_HANDOFF.md`, `docs/`, and now `package.json` and `notes-tests/`. This session's network blocks Vercel hosts, so it was not checked.
- **Default as built:** nothing changed. The notes themselves are not in the repository.
- **Check:** open `/CLAUDE.md` on the Production site. If it loads, add a `.vercelignore` as its own small changeset.
- **Cost if wrong:** internal planning documents readable by anyone with the address.

## Q6. No sign-out button (ACCEPTED as reported: no sign-out button)

- **Superseded 18 October 2026:** notes version 2 adds a Sign out button, on branch `notes-v2`. The entry below is left as the record of what was accepted then.

- **Blocks:** nothing. Not in the brief. A shared machine stays signed in for 30 days. Changing the password in Vercel signs everyone out at once.
- **Default as built:** none. **Cost if wrong:** one route and one button.

## Q7. Route style on the Node runtime was not run on Vercel (default applied; now run under Vercel's own wrapper locally, not on Vercel)

- **Blocks:** Preview acceptance. The four route files export `GET`, `POST`, `PUT` and `DELETE` as Web `Request` to `Response` handlers, which Vercel's Node runtime documents. That is why the handlers are testable without a server. No Vercel environment was reachable, so the first real proof is the Preview.
- **Default as built:** Web handlers.
- **Cost if wrong:** rewrite the four wrappers to the older `(req, res)` form. The logic in `api/_lib/notes-api.js` does not change.

## Q8. Handoff record not updated (default applied: the handoff has a notes entry; the Preview evidence waits for the Preview)

- **Blocks:** nothing. CLAUDE.md section 6 step 9 wants `PROJECT_HANDOFF.md` updated with the actual merge and deployment evidence. The brief asked for CLAUDE.md only, and there is no merge or Preview evidence yet.
- **Default as built:** left alone. **Cost if wrong:** a short entry once the Preview has been checked.

## Q9. The Python checks for the notes page live outside forecast-app (ANSWERED, done: moved to `forecast-app/tests/test_notes_page.py`)

- **Blocks:** nothing built. The brief said nothing under `forecast-app/` changes, and CLAUDE.md says the permanent suite is run from `forecast-app/`. `notes-tests/test_notes_page.py` runs the Node suite and holds the page to the site's token, type size, radius and dash scans. It runs with `python -m unittest discover -s notes-tests` from the root, and is not in the normal suite.
- **Recommended:** move it to `forecast-app/tests/` (change one line, `REPOSITORY`, back to `parents[2]`) so a plain `python -m unittest discover -s tests` covers the notes page too. It was proved in that position first: the normal suite went from 303 to 310 and passed.
- **Cost if wrong:** the page rules only run when someone remembers the second command.

## Q10. A missing storage credential logs as a bare "Error" (open, raised 18 October 2026)

- **Blocks:** nothing built, but it decides how fast a failed first Preview save is understood. The API logs only the error's name, deliberately, because a Blob error message can name the store. The package's credential error is a plain `Error`, so a deployment with no identity token logs `notes: storage error Error`, the same as any other storage failure.
- **Recommended default:** log a second fixed line when the package reports no credentials, for example `notes: storage error, no Blob credentials on this deployment`, naming nothing. About five lines and one test.
- **Cost if wrong:** one round trip to the Vercel dashboard to check the identity token setting by elimination.

## Q11. Sign out cannot revoke a copied cookie (ACCEPTED 18 October 2026: a copied cookie stays valid until expiry; if a device is lost, the product owner changes the password and redeploys)

- **Blocks:** nothing built. The gate is stateless, so sign out clears the browser's cookie but cannot revoke the value. A copy taken before sign out works until its expiry, up to 30 days, or until the password is changed. The cookie is HttpOnly, so the page cannot read it to leak it.
- **Recommended default:** accept it. If a device is lost, change `SILURIAN_NOTES_PASSWORD` in Vercel, which signs every device out at once.
- **Cost if wrong:** a revocation list in the Blob store, checked on every request: about 60 lines, one more storage read per request, and a new failure mode when storage is slow.

## Q12. Two records outside the brief's scope go stale at merge (ANSWERED 18 October 2026: done in pull request 150, CLAUDE.md section 3 and the handoff updated)

- **Blocks:** the merge of `notes-v2`, not the build. The brief allowed changes only to the notes page, its routes and their tests. `PROJECT_HANDOFF.md` records "no sign-out button" as an accepted limit, and CLAUDE.md section 3 describes the notes routes without sign out or search. Both are left unchanged on this branch.
- **Recommended default:** update both in the same pull request at merge, as a records-only commit, with the Preview result.
- **Cost if wrong:** the handoff says the page has no sign out after it does, which is the stale-record fault this project has paid for before.

## Note, 18 October 2026: the sign out fix changes one accepted behaviour

Not a question, recorded so the change is visible. Notes version 2 had Sign out with unsaved edits use the existing leave warning, "Leave anyway and lose the unsaved changes?". The product owner's brief for the sign out fix replaced it: Sign out saves first, and if the save fails or hits a conflict it stays on the note with no offer to leave. The edit view's own Back and New note keep the leave warning.

## Notes version 4 (20 October 2026): questions raised while building

None of these blocks the build. Each carries the default that was built.

## Q13. A label or archive change moves a note's last-edited time (ACCEPTED 20 October 2026: the default built is accepted)

- **Blocks:** nothing built. The note's version, the thing a stale save is checked against, is its `updatedAt`, which is also the date the list shows and the order "newest edit first" uses. The brief says label and archive changes go through the same version check as text saves, so they take the same version and move it. Ticking a label, or archiving, therefore makes the note the newest in its list and changes its date, although its text did not change.
- **Recommended default:** keep it as built. One version means a label change on one device and a text save on another can never silently overwrite each other, which is the brief's own test. It also means a stale text save after a label change on another device is refused as a conflict, with the existing message and the text still on screen.
- **Cost if wrong:** a second field (`editedAt`, the last time the text changed) used for the date and the order, with the existing version kept for the check. About 20 lines and one more test; old notes fall back to `updatedAt`. The product owner accepted the default on 20 October 2026: archiving or labelling a note moves it to the top of its list, a small oddity to live with and raise again if it annoys.

## Q14. The page header is now sticky (ACCEPTED 20 October 2026: the default built is accepted)

- **Blocks:** nothing built. The brief says the menu bar is "sticky under the header". A sticky menu under a header that scrolls away would leave a gap the height of the header, so the header is sticky too, 65px tall, and the phone menu sits below it at the same height.
- **Recommended default:** keep it. The header is one line at every width now (the phone header holds only the menu button, mark, wordmark and New note).
- **Cost if wrong:** at the cost of a few lines the header can scroll away and the menu bar can start at the top of the window instead.

## Q15. The theme row in the phone menu closes the menu (ACCEPTED 20 October 2026: the default built is accepted)

- **Blocks:** nothing built. The brief lists "choosing an item" as a way to close the menu and calls the theme switch a menu row, so choosing it closes the menu. Pressing it switches the theme and the page behind shows the change at once.
- **Recommended default:** keep it, as written.
- **Cost if wrong:** one attribute on that row to leave the menu open, so the change can be watched.

## Q16. Ticking labels on a note that is not saved yet waits for its first save (ACCEPTED 20 October 2026: the default built is accepted)

- **Blocks:** nothing built. A new note has no id until it has text. Labels ticked before then, or the starting label from a label view, are held on the page and go up with the first save in the same request. A note that is never typed in is never saved, so its ticks are not either, as with the existing "Nothing is saved until you type."
- **Recommended default:** keep it. The strip under the toolbar shows the pending labels, and Archive is disabled until the note exists.
- **Cost if wrong:** creating an empty note at the first tick, which adds an "Untitled" note a user did not ask for.

## Q17. Search shows "Search results" as its heading and clears when a menu item is chosen (ACCEPTED 20 October 2026: the default built is accepted)

- **Blocks:** nothing built. A search covers every note whatever view it started from, so the view's own heading (a label name, Archive) over a list of all matches would be wrong. The brief does not name a heading, so the list reads "Search results" while a search is running, and choosing any menu item leaves the search behind.
- **Recommended default:** keep it.
- **Cost if wrong:** one string and one line.

## Q18. A rename and a delete confirmation can be open on different rows at once (ACCEPTED 20 October 2026: the default built is accepted)

- **Blocks:** nothing built. The brief asks for a screenshot of Edit labels with a rename and a delete confirmation open. Opening a confirmation on another row does not cancel a rename in progress, and the typed text is kept; opening either on the same row replaces the other.
- **Recommended default:** keep it.
- **Cost if wrong:** one line each way to allow only one open at a time.

## Q19. Five functions now, and `PATCH` on `/api/note` (ACCEPTED 20 October 2026: the default built is accepted)

- **Blocks:** the opt-in `npm run test:vercel`, which lists the deployed functions. The brief put every new route behind the existing gate and did not say where it goes. Labels are their own file, `api/labels.js`, and label and archive changes to a note are `PATCH /api/note`, beside the existing `GET`, `PUT` and `DELETE`. That makes five functions, not four. `notes-tests/site.test.js` and `notes-tests/vercel-local.check.js` now name five. The local `vercel build` check was not run here, the network being blocked, so that it lists `labels.func` is unproved until it is.
- **Recommended default:** keep it, and run `npm run test:vercel` once from a machine with network access before the merge. **Answered by the Preview on 20 October 2026:** `/api/labels` answered on the Preview, so the function deploys; the unrun `test:vercel` step is not needed.
- **Cost if wrong:** a function that does not deploy would show as a 404 on `/api/labels` in the Preview, and the page would load with no labels in the menu and no label view.

