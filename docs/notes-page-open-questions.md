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

## Q11. Sign out cannot revoke a copied cookie (open, raised 18 October 2026, notes version 2)

- **Blocks:** nothing built. The gate is stateless, so sign out clears the browser's cookie but cannot revoke the value. A copy taken before sign out works until its expiry, up to 30 days, or until the password is changed. The cookie is HttpOnly, so the page cannot read it to leak it.
- **Recommended default:** accept it. If a device is lost, change `SILURIAN_NOTES_PASSWORD` in Vercel, which signs every device out at once.
- **Cost if wrong:** a revocation list in the Blob store, checked on every request: about 60 lines, one more storage read per request, and a new failure mode when storage is slow.

## Q12. Two records outside the brief's scope go stale at merge (open, raised 18 October 2026, notes version 2)

- **Blocks:** the merge of `notes-v2`, not the build. The brief allowed changes only to the notes page, its routes and their tests. `PROJECT_HANDOFF.md` records "no sign-out button" as an accepted limit, and CLAUDE.md section 3 describes the notes routes without sign out or search. Both are left unchanged on this branch.
- **Recommended default:** update both in the same pull request at merge, as a records-only commit, with the Preview result.
- **Cost if wrong:** the handoff says the page has no sign out after it does, which is the stale-record fault this project has paid for before.
