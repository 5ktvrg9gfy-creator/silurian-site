# Silurian Assay: standing rules for a build session

This file is the permanent context for any session building this repository. Individual build briefs assume it and do not repeat it. If a brief and this file disagree, raise it rather than choosing.

Read `PROJECT_HANDOFF.md` before changing this repository. It is the operational recovery record and names the current Production state, architecture, controls, limitations and next starting point.

Where a rule is enforced by a test, the test is named beside it as **Enforced by**. Those rules are load bearing: break one and the suite fails, so it cannot quietly rot. A rule with no test named against it is advisory and holds only while someone reads this file, so treat it with more care rather than less. Run the suite with `python -m unittest discover -s tests` from `forecast-app/`.

---

## 1. Roles

- **James Stacey is Product Owner and customer proxy.** Twenty years in pharma supply chain and packaging, most recently Director of Project Management at a pharma CDMO. Commercial decisions and product naming stop with him.
- **A separate planning session is specification and test lead.** It writes the build briefs, the acceptance criteria and the fixtures. It does not write implementation code.
- **This session is the developer.** It builds from the brief and pushes back on the brief when the brief is wrong.

James routes every message between the two sessions himself. This is deliberate. **Do not soften a disagreement with the brief to be agreeable.** Every significant defect this project has avoided was found by one side refusing to accept the other side's work: the specification has been wrong at least six times, and each time the builder caught it.

Questions go in `docs/<story>-open-questions.md`, in this format: what it blocks, your recommended default, cost if wrong.

---

## 2. Authority

When sources disagree, use this order:

1. `expected_findings.json`, `expected_quality.json`, `expected_classification.json` and `expected_routing.json` define thresholds and expected behaviour.
2. `run_manifest.schema.json` and `run_bundle.schema.json` define output shape.
3. Build briefs explain intent and reasoning, but they are not authoritative for numbers changed by later answers or expectation files.
4. This file defines standing build rules.

Stop and report a contradiction rather than choosing the convenient source.

---

## 3. Products and deployment boundary

This repository contains two separately deployed products:

- The root is the static Silurian marketing site. **Before writing a site changeset, read section 7 of `docs/masthead-design-record-2026-09-16.md`.** It is the shortest complete statement of what a site change has to satisfy: every colour token that exists, every type step, the raw colour rule, the poster rule, the dash rule and the radius rule, each with the reason it is there. Pointed at from here rather than copied, because a second copy of a list is how the dead neutral ramp survived deletion by two weeks.
- **The marketing site serves only the files listed in `site-allowlist.txt`.** Any new public file, page or asset must be added there and to `PUBLIC_FILES` in `forecast-app/tests/test_marketing_deploy_allowlist.py`, or it answers 404.
- **The marketing site is no longer purely static (notes page, added October 2026).** It now has server functions: a root `api/` folder of six Node routes (`login`, `session`, `notes`, `note`, `labels`, and `journal` since 22 October 2026), a root `package.json` whose only dependency is the official `@vercel/blob` package, and a root `vercel.json` that touches `/notes` and `/journal` and nothing else. They serve one private, password-protected notepad for the product owner at `/notes`, whose page is `notes/index.html`. It is deliberately not a root page, so the pinned list of five marketing pages stays at five. The five pages, `tokens.css` and `assets/` are served exactly as before, and there is still no build step.
  - **The notes gate is its own, not shared with Assay.** It is modelled on `forecast-app/access_gate.py` and lives in `api/_lib/gate.js`. The password is the environment variable `SILURIAN_NOTES_PASSWORD`, unset means everything is refused, and the session cookie is HttpOnly, Secure and SameSite Strict, valid for 30 days, with a signing key derived from the password so changing it signs everyone out. Every route except `login` answers 401 without a valid cookie.
  - **A save never overwrites a newer version.** Every save of an existing note says which version it started from (`X-Base-Updated`). If the note changed or was deleted on another device the API answers 409, writes nothing, and the page keeps the unsaved text on screen with a plain message.
  - **Notes live in a private Vercel Blob store, as revisions that are never overwritten** (22 October 2026, branch `notes-revisions`). Each save of a note's text, labels or archive flag writes a new revision and the newest wins: `notes/<id>.<rev>.json` is one revision of the note's small file (title, last-edited time, label ids, archived, which text file it uses, and what it started from; a removed note is a revision that says so) and `notes/<id>.<token>.txt` is a text file named at random for that save. **The create of the next revision is the version check**: it is refused if that revision exists, whatever a read showed, because Vercel's Blob documentation says an overwritten blob "may take up to 60 seconds to propagate through our cache", so a check made on a read of an overwritten file could pass on an old copy and the save then overwrite a newer one from another device. A caller says which version it started from, and if that is newer than the listing shows, the files after the listing are asked for by their paths. **The same save sent again is recognised** (the newest revision or one of the two before it started from the same version and says the same thing) and is answered as done with no second revision. **A note made before revisions, `notes/<id>.json` with `notes/<id>.txt`, is read as its revision 0 with no migration**; the first save after it makes revision 1. **Old revisions are deleted only once a newer one has been listed for over 60 seconds, and never the newest**; a text file no kept revision uses goes once it is older than the revision that settled or over two minutes old; the last revision of a removed note is kept, a few bytes, so a page that still shows the note learns it is gone (`gone` in the list answer). `notes-index.json` is the one file still overwritten in place: it is only a copy, each entry is tagged with the revision it was made from and every list is checked against a fresh listing. Held by `notes-tests/revisions.test.js` on `notes-tests/stale-sdk.js` (a store that serves an overwritten file as it was for 60 seconds and lists nothing made in the last 60), and by `docs/evidence/notes-page/browser-check-revisions.mjs`. **Connecting the store adds `BLOB_STORE_ID` and no read-write token**, so `@vercel/blob` authenticates with the store ID plus the identity token Vercel's runtime puts on each request (`x-vercel-oidc-token`). The adapter passes no credentials of its own and must not name `BLOB_READ_WRITE_TOKEN`; `notes-tests/blob-auth.test.js` fails if it does or if it needs any variable Vercel does not provide. Corrected 18 October 2026: this line said `BLOB_READ_WRITE_TOKEN`, which attaching the store no longer adds. They are not in the repository, the manifest or the bundle, and Assay never touches them. The page is unlinked, carries noindex and nofollow as a tag and a header, and loads no analytics.
  - **Tests.** The Node tests are in `notes-tests/` and run with `npm ci` then `npm test` at the root. `forecast-app/tests/test_notes_page.py` runs them inside the normal suite (run `npm ci` at the root first), fails rather than skips when it cannot, and holds the page to its own look in section 9c and to the dash rule. **The page is not held to the site's token, type size or radius rules**; section 9c replaces them for `/notes` only. `npm run test:vercel` is an opt-in check that needs the network: it runs `vercel build` locally to show the `api/` functions still deploy with the output directory set to `public`, and runs the route files under Vercel's own Node wrapper.
  - **Sign out, delete from the list and search (notes version 2, 18 October 2026).** Sign out is `DELETE /api/session`, behind the gate like every other route but login, and answers with an expired cookie; the page empties itself so Back and refresh show only sign-in. **The gate cannot revoke a cookie value**: a copy taken before sign out works until its expiry, up to 30 days, or until the password changes. Accepted by the product owner on 18 October 2026 (Q11 in `docs/notes-page-open-questions.md`); if a device is lost, change `SILURIAN_NOTES_PASSWORD` and redeploy. Delete from the list uses the edit view's confirmation and the same `DELETE /api/note`. Search is on `GET /api/notes`: the text travels URI-encoded in an `X-Note-Search` header, never the address, and the server reads every note behind the cookie check and returns only titles and the first matching line, matching a plain case-insensitive substring and never a pattern. Held by `notes-tests/v2.test.js`.
  - **Labels and archive (notes version 4, 20 October 2026; revisions since 22 October 2026).** The label list is a series of private Blob files, `labels/<rev>.json`, outside the `notes/` prefix so the notes listing never sees it, each never overwritten and the newest winning like a note (a `labels.json` made before revisions is revision 0): `{ labels: [{ id, name }], updatedAt }`, where `id` is 32 hex characters and stable and `updatedAt` is the version (the word `none` before the first revision exists). A repeated change is recognised and makes no second revision. `api/labels.js` serves `GET`, `POST` (create), `PUT` (rename) and `DELETE`, **every change carrying `X-Base-Labels`, the version it started from**: a stale one is refused with 409 and the current list, and nothing is written, so two devices never overwrite each other. A name is trimmed, 1 to 50 characters and unique ignoring case. A note's metadata file gains `labels` (a list of label ids) and `archived` (true or false); **a note without those fields has no labels and is not archived, with no migration**. `PATCH /api/note?id=` changes them without rewriting the text, from the note's version in `X-Base-Updated` like a text save, so a change from a stale copy is refused. A text save keeps the labels and the flag. A label or archive change moves the note's version and last-edited time, because the version is that time (Q13 in `docs/notes-page-open-questions.md`). Deleting a label removes it from the labels file only; notes holding its id ignore it and drop it on their next save. `GET /api/notes` takes `?view=notes` (the default, archived left out), `archive`, `label&label=<id>` or `all`; a search ignores the view and covers every note. Held by `notes-tests/v4.test.js`.
  - **Monospace is allowed in the note box only.** A documented exception to the Archivo only rule, recorded in section 9b.
- **The journal (22 October 2026).** A second private page for the product owner at `/journal`, installable as an app, whose page is `journal/index.html`. Like the notes page it is deliberately not a root page. Design: `docs/briefs/journal-design-brief.md`, answers in `docs/journal-open-questions.md`, look in section 9e.
  - **Same gate, same cookie.** One password (`SILURIAN_NOTES_PASSWORD`), one cookie, signed in and out together. `api/journal.js` is one route with `GET`, `POST` and `PUT`, and every one answers 401 without a valid cookie before it reads anything. Sign out is the existing `DELETE /api/session`. The limit recorded for notes holds: a copy of the cookie taken before sign out works until it expires or the password changes.
  - **Its own storage prefix, one file per entry revision.** Private Blob, under `journal/` and nowhere else: `journal/e/YYYY-MM/<entry id>.<rev>.json` (one file for each revision of each entry; the month is the month of the list the entry is in), `journal/l/YYYY-MM/<date>.<rev>.json` (one for each revision of a calendar line) and `journal/quick.json` (Quick notes, the one file that is overwritten). **No file is shared by two entries and no entry or line file is ever overwritten.** Adding an entry creates its revision 1 and reads nothing first. A change creates the next revision of that one entry, and a create is refused if that path is taken, so the create is the version check. A removal is a revision with the state `removed`, so another device learns it is gone. A move creates the copy as its own entry, whose id is worked out from the original's id, the revision it was copied at and the destination (`core.copyIdFor`), so the same move sent twice, from the page or another device, makes the same copy; then it creates the original's next revision with the arrow and the destination. A view is built from a listing of a month's entry files and the highest revision of each entry. Notes lists only `notes/`, the notes index is its own file, and search reads only notes, so **a journal entry never appears in the notes list, the notes index or notes search**. The adapter is `api/_lib/journal-store.js`, and `store.js` does not mention the journal. **Rebuilt on 22 October 2026 after the second Preview retest failed on the one-file-per-month design (Q18 in `docs/journal-open-questions.md`, which supersedes Q9 and Q16).**
  - **The version check is the create.** Every change to an existing entry or calendar line names the revision it started from, and the server reads only that entry at that revision (by its path, never by a listing), applies the change with the shared rules and creates the next revision. If that revision already exists the create is refused, nothing is replaced, the server reads what is there and decides again from it: the same change already done is answered as done (so the page may retry safely and makes no second copy), anything else is a 409 with what is there now, and the page keeps the typed text on screen with the plain message and a Reload button. A move that is refused after its copy was made takes the copy back by creating its removed revision, unless someone has changed it since. Different entries do not clash, so two devices open all day do not refuse each other. Quick notes, one block of text, keep the notes rule (`X-Base-Updated`, refuse and keep the text) and are the only place that still waits for the store, up to about six seconds, because they are the one file that is overwritten.
  - **Why entries are never overwritten.** Found on the Preview on 22 October 2026, in two rounds: entries vanished a few seconds after being added and one move showed twice, and after the first fix entries still vanished on a refresh with "Could not save that change". Vercel's Blob documentation says that deleting or overwriting a blob "may take up to 60 seconds to propagate through our cache" (https://vercel.com/docs/vercel-blob; the changelog for consistent reads, https://vercel.com/changelog/vercel-blob-now-supports-consistent-reads-on-private-storage, says readers might see the cached version for up to 60 seconds and adds `useCache: false` to `get()` for a read of the latest write; the documentation recommends treating blobs as immutable). One shared file per month, read, changed and written back, loses a change however the timing is handled, because a change made from the old copy writes the old copy back. A file that is only ever created has no old copy. The adapter still reads with `useCache: false`, and keeps what it has read by path for the life of the instance, because a file's content is fixed once made. **The page puts what the server says together with what it holds, entry by entry (`core.mergeMonth`): the higher revision of each entry and each line wins and nothing is dropped because a read lacks it, so a read that is older, shorter or missing a file the listing has not caught up with never draws over a save.** There are no waits, no remembered revisions and no remembered files in the API for entries. Held by `notes-tests/journal-stale.test.js`, which runs the API against a store that serves an overwritten file as it was for 60 seconds and leaves a file made in the last 60 seconds out of a listing (adding, editing, moving, Bring forward, an undo and a move again, a calendar line, every change to an instance that remembers nothing, and two hundred random changes some of them sent twice, each checked against a model of one device), and by `docs/evidence/journal/browser-check-journal-lag.mjs`, which does the same in a browser in real time past the 60 seconds. **Notes has a similar exposure and is not changed in this branch** (see `docs/evidence/journal-evidence.md`).
  - **One implementation of the rules.** `journal/core.js` holds every rule of an entry (states, moves, undo, the morning strip, the bold and strike-through markers, how a copy is named and how two views are put together) and is used by the API and by the page, which applies each change to its own copy with the same function so it can show it at once. It is served with the page, so it holds nothing private.
  - **Nothing is ever moved, migrated or dropped automatically.** No cron, no timer in the API, no clock in the rules, and no code path from loading, refreshing or the date changing to a change. The morning strip only lists what is waiting. Held by tests named in 9e.
  - **Functions stay in London.** `vercel.json` sets `regions` for the whole project, so `api/journal.js` runs in `lhr1` with the notes routes.
  - **No service worker.** The page never stores journal content, API responses or the page itself, on the device or in a cache: nothing is kept but the theme choice and the last tab, in `localStorage`. Whether Edge offers Install without one is recorded in `docs/evidence/journal-evidence.md`.
- `forecast-app/` is the Forecast Diagnostic FastAPI application.

Both deploy from `main` through separate Vercel projects. A pull request can therefore show two Vercel checks. Confirm the check for the component changed.

---

## 4. What a build session must never do

1. **Never edit a fixture or an `expected_*.json` file.** They are the control. If a test fails, either the code is wrong or the expectation is wrong, and only the planning session changes an expectation. Editing the control to make a build pass is the one unrecoverable move here. Enforced by `test_committed_fixture_hashes_are_unchanged`.
2. **Never weaken a threshold or a detector to make a fixture pass.** If a fixture provokes a finding, the finding is probably correct and the expectation is probably out of date. Say so; do not tune the engine. Enforced by `test_runtime_thresholds_match_authoritative_fixture` and `test_authoritative_fixture_and_thresholds`, which pin the runtime thresholds to the expectation files.
3. **Never widen scope beyond the story.** A brief that names three things wants three things. Improvements you spot go in the questions file.
4. **Keep client identifiers and demand values out of the run manifest.** Hashes, counts, codes and options only. No SKU codes, no volumes, no shares, no source filenames. The bundle holds client data; the manifest does not. This rule has been broken once already, by a source filename that looked harmless. Enforced by `test_manifest_contains_no_source_sku`, `test_manifest_contains_filename_hash_but_not_readable_filename` and `test_quality_records_resolutions_as_passes_without_client_data`.
5. **Never ship a schema change without a version bump.** Both schemas carry `const` versions so an old reader fails loudly rather than reading a new file partially. The loud failure is proved by `test_unknown_bundle_version_is_refused`. Nothing detects a shape change that forgets its bump, so that half is on you.

The non-negotiable controls, which carry the same weight:

- Never guess the meaning of an ambiguous client column, date, unit, total or record type. Enforced by `test_every_fixture_pass`, which holds every validation fixture against `expected_findings.json`.
- Never call a forecast model after a blocking validation finding. Enforced by `test_rejected_file_emits_validation_only_manifest` and `test_rejection_returns_validation_only_manifest`: a rejected run carries a validation stage and nothing else.
- Never fill missing demand periods with zero silently. Enforced by `test_structural_metrics`, since zero filling would move the gap counts and coverage away from the control.
- Never remove or correct an outlier silently. Enforced by `test_required_and_prohibited_findings_and_bands` for the flagging, and `test_structural_metrics` for the volume totals a correction would move.
- Keep validation gates separate from quality characterisation. Enforced by `test_validation_gates_remain_after_characterisations_move` and `test_finding_code_ownership_is_disjoint`.
- Reuse quality ADI and CV-squared values in classification. Do not recompute them. Enforced by `test_metrics_are_consumed_unchanged_from_quality`.
- Routing consumes the demand class and the quality band. It computes no metric of its own, and no routing decision changes because a user asserts something rather than because the data changed. Enforced by `test_routing_recomputes_no_metric` and `test_resolution_effects_match_the_table_and_never_move_a_decision`.
- Keep confidential bundles in the browser. Do not add server-side bundle storage. Enforced by `test_reopen_is_browser_only` and `test_reopen_never_calls_an_engine`.
- Keep BigQuery query caching disabled for managed forecasts and fail closed on a reported cache hit. Enforced by `test_forecast_disables_cache_and_pins_london` and `test_any_production_cache_hit_stops_the_run`.
- Keep Forecast processing in the approved London region. Enforced by `test_forecast_disables_cache_and_pins_london`.
- Never commit credentials, identity tokens, environment variable values or private Google Cloud identifiers. Enforced by `test_no_committed_credential_anywhere_in_the_tree`, which scans every tracked file for private key blocks, service account shapes, bearer and OAuth tokens and literal Google Cloud project, dataset and identity pool identifiers. `test_every_pattern_catches_a_planted_secret` proves each pattern still fires, `test_public_configuration_is_not_a_finding` keeps deployment settings such as `europe-west2` legal, and `test_the_scan_actually_reads_the_repository` and `test_the_scanner_scans_itself` stop the scan passing on nothing or exempting itself.
- Do not change the approved TimesFM canary baseline because a new output differs. Investigate drift first. The detection is enforced by `test_reference_canary_detects_altered_baseline`; the decision not to move the baseline is yours.

---

## 5. Engineering rules that outlive any one story

**Gate against characterisation.** Validation decides whether a run may proceed. Quality describes what the data is. A unit change is a gate, because proceeding produces an answer wrong by the pack factor. A short history is a characterisation, because proceeding produces a valid answer on limited evidence. Nothing does both. Enforced by `test_validation_gates_remain_after_characterisations_move` and `test_finding_code_ownership_is_disjoint`.

**One implementation of any judgement.** Two implementations agree the day they are written and drift apart on the next threshold change. ADI and CV squared are computed once, in the quality engine, and every later stage consumes those values. Where a later stage reports a metric an earlier stage owns, there is a test asserting exact value equality, nulls included. Enforced by `test_metrics_are_consumed_unchanged_from_quality` and `test_routing_recomputes_no_metric`.

**The cross-stage consistency tests are permanent.** No finding code appears in more than one stage. No two stages describe the same SKU in contradictory terms. No code appears twice on the rendered page. These exist because the tool once contradicted itself on one screen, and they have been proven to fail. Enforced by the six tests in `tests/test_stage_consistency.py`.

**Resolution, not override.** A blocking finding carries the decision the user supplies to unblock it, and that decision produces a new pass recorded in the manifest options. Enforced by `test_every_blocking_expectation_has_resolution` and `test_resolution_effects_match_the_table_and_never_move_a_decision`.

**Every new output is a self-contained panel component.** It owns its heading and body and knows nothing about what sits above or below. Prove it by rendering one alone in a test. Enforced by `test_each_output_is_an_independent_panel`, `test_routing_panel_sits_between_classification_and_forecast_and_renders_alone` and `test_open_items_panel_renders_alone_and_is_reachable_twice`.

**Fixture integrity is enforced by test.** Every fixture and every expectations file has its sha256 recorded in the suite. A change to any of them fails the build with a message saying the control was modified. This is not distrust of the builder; it is what makes an approved brief mean something a month later. Enforced by `test_committed_fixture_hashes_are_unchanged`.

---

## 6. Build workflow

1. Start from current `main` and create a focused branch.
2. Read the relevant expectation file, schema, contract and open-question record.
3. Make the smallest coherent change. Do not combine product decisions with migration or handoff work.
4. Run `python -m unittest discover -s tests` from `forecast-app/`.
5. Prove new integrity controls can fail before accepting them.
6. Use the repository fixture files for exact byte-hash assertions. CSV files are pinned to LF by `.gitattributes`.
7. Test the relevant Vercel Preview before merge.
8. Merge only after acceptance, then run the relevant Production smoke test.
9. Update `PROJECT_HANDOFF.md` with the actual merge and deployment evidence.

---

## 7. Product naming, fixed

- **Silurian Assay** is the product. Not the Silurian Forecast Diagnostic, which was the working title.
- **Portfolio classification matrix.** Five demand states crossed with three ABC volume classes, fifteen cells. It is not a nine box, and that phrase must not appear in production code, in manifest or bundle fields, or in user-facing copy.
- **ABC volume class.** ABC is computed on cumulative volume until unit cost arrives at story 4.1. The word **value** must not appear next to ABC anywhere a client can read it.
- **Unclassifiable** is a demand state in its own right, not an error and not a null.
- **Manifest** and **bundle** are precise terms worth keeping, with a plain gloss on first use. **Grain** is data modelling vocabulary and planners say monthly or weekly.

The nine box and ABC value bans are enforced by `test_production_copy_scope_check`, which scans production code, both schemas and the interface. The rest of this section is advisory.

---

## 8. Copy rules

Match the marketing site's register: short, declarative, no hedging. Numbers before adjectives.

Every finding is written in the order **what, so what, do this**. What the data shows, why it matters to a planner, what to do about it.

**No em dashes or en dashes anywhere in user-facing copy.** No em dash, no en dash, no spaced hyphen used as a dash. Standard hyphenation is fine. This is a house rule of the owner's and it applies to the product, not only to documents. Enforced by `test_production_copy_scope_check`, which reads the production files for an em dash or en dash as a character, an HTML entity or an escape, alongside the nine box and ABC value bans.

Absence is a result. An empty state names what was eligible, what was excluded and why, and offers the next action.

**Plain language, everywhere a user can read it.** The test: if a planner would not say it to another planner in the corridor, cut it.

The tell is a vague verb standing in for something concrete. Serve, carry, support, enable, underpin, leverage. "Which products a forecast can serve" means "which products you can forecast". "Knowing what the plan can carry" means "knowing which numbers to trust". The abstraction is always longer and always says less.

The same verb can be either, so the list is a prompt to look rather than a ban. "Five lines carrying 25.39 percent of your volume" is concrete: the volume is measured and the verb is doing that work. "What the plan can carry" is a metaphor standing in for a real word. The test is whether the verb is doing measurable work or standing in for something the writer could not be bothered to name.

Two things follow from it.

**Say what the reader gets, not what the method is.** "Stock sized to what the data supports" describes a method. "Stock carried for reasons you can explain" describes what the reader gets to say when someone asks them why the stock is there.

**Name whose problem it is.** "Insufficient history" is nobody's. "You have not got the history to tell" is theirs, and it points at what to do next.

It applies to everything a user reads: panel headings, findings text, the seven routing decision texts, resolution options, glossary entries, error messages, the readiness sentence and the report. It does not apply to internal names, code identifiers, test names or documentation.

**Plain, not friendly, is the other half of the same rule.** Band 2.7 established the first half: do not soften the register, because the directness is what makes it credible. This is the second half: do not dress it up. Read together they say one thing, which is to use the fewest words that carry the real meaning. Nothing in either licenses the other to be broken.

This is a build rule and not a copy preference because it has already cost something. The second planner did not understand seven terms on the screen, and band 2.10.2 in the product owner's backlog exists to fix them. This rule is what would have prevented them.

Not enforced by a test, deliberately. A banned phrase list would catch the obvious cases and fire on legitimate ones: "carry" appears eleven times in the shipped interface, including the readiness sentence band 2.7 was written to produce, where it is concrete and correct. A control that cries wolf gets ignored, which is worse than none. This one is judgement, and the planner test is what catches it failing.

---

## 9. Design system

Tokens are lifted from `index.html` on the marketing site. Do not re-derive or invent them.

- Charcoal `#3f3d3b`, main orange `#ec6917`, dark orange `#c15613`, warm neutral `#cabfad`, deepest ink `#1a1918`.
- Page ground `#f3f2f2`, surface `#eae9e9`. Panels sit **darker** than the page, which inverts the usual expectation.
- **Archivo only**, weight 800 for display, `font-feature-settings: "tnum" 1` for figures. There is no mono in the system.
- **Zero radius on the marketing site.** Structure is drawn with 2px solid rules on seams and 1px hairlines inside tables, not floated on shadows. This is the single biggest difference from a generic dashboard. Assay is a documented exception, below.
- Orange is spent as a mark or a field, never as a status palette. State is encoded twice on every row, colour and words, so removing colour entirely leaves the screen fully readable.
- No dark mode. The system is print derived and commits to paper. Paint every colour explicitly.

The tokens and the Archivo rule are enforced by `test_workspace_uses_approved_visual_tokens`. The radius bound below is enforced by `test_no_radius_exceeds_the_assay_bound`. The rest of this section is advisory.

### 9a. Assay is a documented exception

Amended by the product owner on 16 September 2026, approving the changeset "Assay app theme and dashboard shell". Before this, the rule was zero radius everywhere and Assay was held to it by test. **This is a decision, not drift.** Do not "fix" Assay back towards the site's rules, and do not propagate Assay's rules back to the site.

The reasoning is the changeset's and worth keeping: the site is a poster, read once at arm's length and meant to persuade. The app is a tool, read daily at close range and meant to be scanned and clicked. The site's 2px rules and hard edges give the marketing pages their authority, and applied to a dense table they fight the reader, because every row division shouts at the volume of the section containing it.

In Assay, and in Assay only:

- **4px on cards, buttons and inputs. 3px on badges. Never higher than 4px.** The six badges, named because a category with no list is not a rule: `.validation-badge`, `.ai-chip`, `.stage-tag`, `.band-label.not_usable`, `.decision-label.ineligible` and `.run-pill`. **`.run-pill` is a badge although two of its three instances are `<button>` elements**, because a status pill is a badge whatever tag it is written as. That is ruling 3's principle again: the marker follows the job, not the element. The bound is the load bearing half. A future screen wanting a larger radius is a new decision and belongs in a new changeset.

  **A card is a bounded surface holding one kind of output.** Amended by the product owner on 16 September 2026, correcting his own earlier ruling. The first version named the eight workspace panels as cards, before it was known they have no fill, no border and no bounded surface at all. **An unbounded panel is not a card however much it looks like a section.** A radius on nothing and a shadow around nothing buy nothing, so the eight stay flat.

  **Correct the definition rather than invent a fill.** The two fills available are both wrong: `--surface` merges a panel with the tables inside it, and `--paper` is lighter than the page, which breaks the panels-darker-than-the-page rule above. A third value picked to make a rule fit is how the palette grew last time.
- **One card elevation step, the values in the approved changeset, and no second step.** A second card elevation is a new decision. **The sticky run context bar is outside this rule and keeps its own shadow.** Its shadow marks where a bar scrolling over content ends, which is a different job from lifting a card off the page, so it is not the second step and removing it would be a regression bought to satisfy a rule written about cards. Ruled by the product owner on 16 September 2026, closing Q8.
- **1px rules inside the app**, in three categories. The rule was corrected twice on 16 September 2026, both times because a seam count showed it was wrong, and both corrections are kept because the reasoning is what stops the next one.

  **Dividers drop to 1px.** A rule that separates one block from the next, whatever weight it carries now. The 2px ink rule is retained on the page header only, as the tie back to the site.

  **A surface the user acts on keeps its heavier marker**, in whatever colour it already carries. That is `form` and `.resolution-form`. **The marker follows the job, not the colour**: `.resolution-form` is marked in ink rather than accent, which is why colour cannot be the test. A panel that only displays drops to 1px however it is marked, which is `.analysis-panel`, `.quality-hero` and `.routing-headline`. An accent border on a panel that only displays is the loudest thing on screen doing the least work.

  **A border whose colour changes with state is a state marker, not a divider. It is outside the seam rule entirely, at whatever weight it already carries. A hairline that changes colour is a rule with a tint, not a verdict.** That is `.validation-panel` at 5px, whose border is the verdict itself, red on a reject, amber on accept with warnings and green on accept; `.quality-exception` at 4px, amber and red; and `.bundle-warning` at 5px, held by name. Section 9 wants state encoded twice, colour and words. A state marker thinned to 1px leaves the words carrying it alone, which is one and a half. **`.bundle-warning` is the honest exception in the group**: its colour does not vary, it is always `--warn`, so it is a fixed status marker rather than a varying one and it is held by name rather than by the rule. Enforced by `test_state_markers_keep_their_width`, `test_the_varying_state_markers_still_vary` and `test_the_fixed_status_marker_is_recorded_as_fixed`.

Everything else in section 9 applies to Assay unchanged: Archivo only, panels darker than the page, orange as a mark or a field and never a status palette, no dark mode, and every colour painted explicitly.

**App only tokens, permitted by name.** Section 9 says tokens are lifted from the marketing site and not invented. Assay may add tokens for surfaces the site has no equivalent for, and only these, each named here because a category with no list is not a rule: `--row-rule`, `--row-hover`, `--control-border` and `--accent-pressed`, adopted in theme pass 1, and `--slate-tint`, adopted in pass 2. A table header needs a fill the site has no value for, because the site has no tables.

**`--slate-tint`'s job here is narrower than the changeset defines it, deliberately.** The changeset gives it three: table header fill, chart gridlines and hovers. Those sit on three different grounds, so one value cannot be right for all three: re-derived against `--surface` it is correct for the header fill and wrong for a gridline on `--paper`, where the changeset's own `#e8eaed` is correct as drawn. **In Assay it has one job, the table header fill.** A gridline gets its own token when something needs one, derived against the ground it actually sits on. Ruled by the product owner on 16 September 2026: one token that is right on `--surface` and wrong on `--paper` is a defect waiting to be found by whoever builds the chart. **The rest of the changeset's slate family is ruled out**: `--slate`, `--slate-mid`, `--slate-soft` and `--slate-text` paint a sidebar that does not exist, and `--slate-deep` would move every heading and figure off `--ink-deep` to a cooler value nobody asked for. A sixth token is a new decision.

**Re-derive, do not copy.** Every colour in the changeset was chosen against a white card, and Assay's panels are darker than the page by standing rule. **Any value whose job is defined by its relationship to what sits behind it gets re-derived against `--surface`, not copied across.** Ruled by the product owner on 16 September 2026.

The method, in three steps: measure the changeset's value against the ground it was drawn on, hold that ratio and that direction, and solve for the value that reproduces it against Assay's ground. Hold the deliberate part of the hue too, which for the slate is the cool cast that makes it recede behind the accent.

**The worked example is `--row-rule`.** The changeset's `#eeebe9` is 1.19:1 and darker than its white card. Copied onto `--surface` it is 1.02:1 and **lighter** than the surface it divides, and the row divisions did not go faint, they went away. Re-derived it is `#dcd9d7`, 1.16:1 and darker, which is the same rule doing the same job. Built both ways and looked at before the value was chosen.

This bites hardest on a value that sits close to its ground, because that is where a small luminance error flips the sign. It does not bite on `--row-hover`: a hover should be lighter than the row it lifts, so lighter is the correct side and `#f7f6f6` stands as given.

**What the tests hold and what they do not.**

`test_no_radius_exceeds_the_assay_bound` holds the 4px bound and nothing else. It cannot tell a card from a badge, so 3px on badges is advisory.

`test_no_shadow_beyond_one_card_step_and_the_sticky_bar` holds both halves of the shadow rule: no value other than the approved card elevation and the sticky bar's own, and at most one distinct card elevation. It cannot tell a card from anything else, so it would not catch the card elevation being reused on something that is not a card, and it permits the sticky bar's value by name rather than by where it is applied.

**The marketing site.** `MarketingSiteKeepsZeroRadius` enforces zero radius there, built 17 September 2026 as the site session's work. Nothing enforced it before, because the test named against the rule only ever read the Assay page. The documented exception is **four rules, six rendered elements, because the homepage rule and the delivery page rule each dress an email badge and a LinkedIn badge**: `.close .contact-badge` on `index.html`, on `delivery.html` and on `forecast-risk.html`, and `.mail-badge` on `forecastability.html`. **`delivery.html` was added on 18 September 2026**, when the product owner ruled that the new delivery page reuses the homepage's closing field and its headline verbatim. It was three rules and four elements before that, and the count is measured rather than counted by hand: 64 elements read on `index.html` and 2 rounded, 90 and 2 on `delivery.html`, 173 and 1 on `forecast-risk.html`, 174 and 1 on `forecastability.html`, 41 and 0 on `privacy.html`. **The scan allows them by selector and never by value**, so `50%` on anything else is a finding. It counts rules because it reads rules. Ruled by the product owner on 16 September 2026, closing Q9, and the count corrected by him on 17 September 2026, closing Q3 in `docs/marketing-site-open-questions.md`. Recorded in full in `docs/assay-theme-open-questions.md`, and the scan's evidence is in `docs/evidence/radius-scan-evidence.md`.

### 9b. The notes page note box is a documented exception to Archivo only

Ruled by the product owner on 18 October 2026, closing Q1 in `docs/notes-page-open-questions.md`. Section 9 says Archivo only and that there is no mono in the system. The private notes page at `/notes` holds scripts, which read right only in a fixed-width face, so **the note box, and only the note box, uses the system monospace stack.** Everything else on the page is Archivo. **This is a decision, not drift.** Do not add mono elsewhere on the site or in Assay, and do not "fix" the note box back to Archivo.

Enforced by `test_monospace_only_in_the_note_box` in `forecast-app/tests/test_notes_page.py`, which allows exactly one monospace declaration on the page. Renamed on 19 October 2026 from `test_archivo_everywhere_but_the_note_box`, because section 9c now sets the page in system UI type and the old name no longer described it; the check itself is unchanged. The sentence above saying everything else on the page is Archivo is amended by 9c: it is system UI type, with Archivo on the wordmark only.

### 9c. The notes page follows the Spud Notes look, light and dark

The notes page follows the Spud Notes look, light and dark. Ruled by the product owner on 19 October 2026. `/notes` only: its own palette declared in the page in two themes, a theme switch remembered on the device, 8px and 6px corners, system UI type with Archivo on the wordmark, six inline line icons (twelve since notes version 4, section 9d, thirteen since the journal, section 9e). The 9b note box ruling stands. This is a decision, not drift. None of it propagates to the marketing pages or Assay, which stay single-theme.

For `/notes` this is the authority over any line in this file or any test that says otherwise: the page is not held to the site's tokens, zero radius, 2px rules, Archivo only or uppercase labels. It still loads `tokens.css`, but only for the Archivo font face the wordmark uses, and it still carries the dash rule.

Enforced by these tests in `forecast-app/tests/test_notes_page.py`, class `NotesPageFollowsTheSpudNotesLook`: `test_raw_colours_only_inside_the_three_theme_blocks`, `test_px_font_sizes_only_inside_root`, `test_the_dark_blocks_match_and_cover_the_light_block`, `test_color_scheme_follows_the_device_and_the_choice`, `test_every_variable_it_reads_is_declared`, `test_contrast_in_both_themes` (computed from the declared values, both themes, 4.5:1) with `test_the_contrast_check_can_fail`, `test_the_retired_grey_is_gone`, `test_no_uppercase_and_no_positive_tracking`, `test_archivo_only_on_the_wordmark`, `test_monospace_only_in_the_note_box`, `test_corners_are_six_or_eight_and_nothing_casts_a_shadow`, `test_borders_are_one_pixel_and_outlines_are_two`, `test_exactly_twelve_icon_shapes_all_stroked_in_the_current_colour` (six until notes version 4, renamed when section 9d added six), `test_every_icon_button_in_the_script_names_what_it_acts_on` (the row delete test until version 4), `test_the_header_and_the_theme_switch` and `test_the_theme_script_wraps_storage_in_try_catch_and_runs_before_the_stylesheet`. The theme switch behaviour, including with storage blocked, is held by `notes-tests/theme.test.js`. The theme choice is held on the device only: it is not a note, is not sent to the server and is not cleared by Sign out.

### 9d. Notes version 4: menu bar, labels and archive

Notes version 4: menu bar, labels and archive. Ruled by the product owner on 20 October 2026. `/notes` only. Twelve icons. One added palette pair, `--notes-selected` and `--notes-scrim`. Not in scope: reminders, bin, colours, pinning. Section 9c stays in force: same palette variables, type size variables, 8px and 6px corners, 1px borders, 2px accent focus outline, no shadows, no uppercase, light and dark. The 9b note box ruling stands. This is a decision, not drift, and none of it reaches the marketing pages or Assay.

What it is. A menu bar 240px wide, flush left under the header above 760px, and a menu that opens over the page at 760px and below, with a scrim and no animation. Items: Notes, one per label alphabetically, Edit labels, Archive. Addresses `#archive`, `#labels` and `#l/<labelId>` join `#n/<id>` and `#new`. Label chips on rows (3 above 760px, 2 at and below, then `+N`), a Labels panel in the edit view, an Edit labels screen, and Archive and Unarchive with a message bar and Undo. Signed out at 760px and below there is no menu and the theme switch stays in the header.

Storage. The labels file and the two new metadata fields are described in section 3. The new palette pair is declared in all three theme blocks, with `--notes-scrim` as the only rgba value on the page. **Only `--notes-strong`, `--notes-ink` and `--notes-icon` may sit on `--notes-selected`, never `--notes-muted`.**

Enforced by these tests in `forecast-app/tests/test_notes_page.py`: `test_raw_colours_only_inside_the_three_theme_blocks` (now covering rgba), `test_contrast_on_the_selected_fill_in_both_themes`, `test_muted_is_never_set_on_the_selected_fill`, `test_exactly_twelve_icon_shapes_all_stroked_in_the_current_colour`, `test_every_icon_button_in_the_script_names_what_it_acts_on` and, in class `NotesPageVersionFourMenuLabelsAndArchive`, `test_the_menu_is_a_nav_with_the_items_in_order_and_no_headings`, `test_the_menu_is_sized_and_placed_as_briefed`, `test_the_menu_button_and_new_note_button_at_phone_width`, `test_chip_shape_and_limits`, `test_every_empty_state_says_exactly_what_the_brief_says`, `test_the_addresses_are_in_the_page` and `test_the_new_files_are_not_public`. The API is held by `notes-tests/v4.test.js` (labels, the version checks, archive, search, old metadata, the gate on every new route, the Blob adapter and the phone menu script), and the theme row in the menu by `notes-tests/theme.test.js`.

---

### 9e. The journal: five panels, entries and the morning strip

The journal at `/journal`. Ruled by the product owner on 22 October 2026, from `docs/briefs/journal-design-brief.md` and the answers in `docs/journal-open-questions.md`. `/journal` only. It follows sections 9c and 9d: the same palette variables in the same three theme blocks, the same type size variables, 8px and 6px corners, 1px borders, a 2px accent focus outline, no shadows, no uppercase, light and dark, and **no new colour variable**. The 9b note box ruling does not reach it: there is no monospace on the journal. Its own sprite holds twelve icons (the bin, with the notes bin shape, added 23 October 2026), and the notes sprite gains a thirteenth, `i-journal`, for a last menu item, Journal, after Archive, which is a plain link. This is a decision, not drift, and none of it reaches the marketing pages or Assay.

What it is. Five panels in one window. **From 1000px up, three columns at every width, as the product owner's sticky notes sit: Month full height on the left, Today above Tomorrow in the middle, Migrate above Quick notes on the right. There is no five column layout.** From 761 to 999px Month is a sticky column on the left and the other four stack on the right. At 760px and below, one panel at a time with five text tabs (Month, Today, Tomorrow, Migrate, Quick) along the bottom. Bullets: task (dot), event (circle), note (dash); a task ticked is a cross and struck through; migrated is a right arrow and scheduled a left arrow, and **a moved entry is kept in storage with its arrow and where it went, and is not shown in the list. A quiet line at the bottom of each panel, "N moved", shown only when N is 1 or more, opens and closes the moved entries, greyed by colour (never opacity) with their arrows. It is closed by default. Ruled by the product owner on 22 October 2026, after the Preview, replacing the first design in which they stayed in the list. The copy goes to the bottom of the target list**. A dropped task is struck and stays in the list. Month's count chip counts what the log shows, which is the entries that are not moved. Each entry moves to Today, Tomorrow, Migrate or a date, from a More button (always for a finger, and for a mouse in a panel narrower than 440px) or from four buttons at the right of the row on hover (a mouse in a wide panel). Bold and strike-through only (`Ctrl+B`, `Ctrl+Shift+X`); the type of a new entry is chosen with `Alt+1`, `Alt+2`, `Alt+3`, the three buttons, or a typed prefix (`. `, `o `, `- `) that Backspace gives back. A calendar line is free text kept apart from that date's log, and Month shows it, then that date's event entries, and a count (Q1 and Q8). Dates are London's, sent by the page, never decided by the server. **A move to a day says which day in the message bar, in full, "Moved to Wednesday 28 October.", with Undo and an Open day button (added 22 October 2026 after the second Preview retest, where a moved entry could not be found).** **Three rulings, product owner, 23 October 2026.** (1) **Delete.** Each entry has a bin button (the notes bin shape, quiet, turning `--notes-bad` on hover and focus, named "Delete entry: " and the entry text) that deletes at once with no question: a new revision marked removed, and the message bar says "Entry deleted." with Undo for ten seconds, which makes the entry again as a new one. (2) **Spell check.** The browser's spell check is on, in UK English (`lang="en-GB"`), for entry text, the new entry line, calendar lines and Quick notes. Notes is unchanged. (3) **Drag and drop, mouse only.** With a mouse, an entry is dragged onto Today, Tomorrow, Migrate or a date line from today on in Month, and the drop does exactly what the matching move button does (the Date picker's move for a date line): the same revision files, the same arrow on the original, the same message with Undo. The target takes the `--notes-selected` fill while the pointer is over it, and no new colour. Dropping on the list the entry is already in does nothing. **The move buttons no longer show on mouse hover, so they never cover entry text, and a mouse has no More button; they show on keyboard focus (after Tab), so every move stays possible without a mouse.** A finger keeps the More button and the move buttons unchanged and nothing is draggable. A drag starts anywhere on the row except in the text while that text is being edited, so selecting words still works. Held by `test_each_entry_has_a_bin_that_deletes_at_once_with_an_undo`, `test_spell_check_is_on_for_entries_calendar_lines_and_quick_notes_in_uk_english`, `test_a_drag_does_what_the_move_button_does_to_each_target_and_nothing_to_the_same_list`, `test_a_drop_target_takes_the_selected_fill_and_no_new_colour` and `test_a_mouse_drags_so_the_moves_are_not_offered_on_hover_and_they_show_on_keyboard_focus`, and in a browser by `docs/evidence/journal/browser-check-journal.mjs` (section 7b) and, under the 60 second stand-in, `browser-check-journal-lag.mjs`.  **Every target a finger lands on is 44px under a coarse pointer.**

The morning strip. At the top of Today, when something is waiting: open tasks from the most recent earlier day that has any (Friday's on Monday), each with Bring forward and Drop, and Bring all forward when there are several, and never a Drop all. On the first open of a new month, last month's open Migrate tasks appear in the same strip as a second group and Bring forward puts them at the bottom of the new month's Migrate. **It never acts by itself.** Bring forward and Drop both keep the original, and both offer an Undo that lasts ten seconds.

Install. Named Journal, installed from Edge or Chrome on Windows or from the home screen on an iPad. The manifest, the five PNG icons and `core.js` are public and ungated because a browser fetches them without the cookie, and they hold nothing private. The theme colour is the page ground, light `#faf8f5` and dark `#262422`, in two `theme-color` tags that a test reads against the variables. Raw colour is allowed in those two tags and nowhere else outside the theme blocks.

Enforced by these tests in `forecast-app/tests/test_journal_page.py`. Class `JournalPageIsOutsideTheSiteRules`: `test_the_page_is_not_a_root_marketing_page` and `test_no_dash_in_anything_a_user_reads`. Class `JournalPageFollowsTheNotesLook`: `test_the_journal_declares_exactly_the_notes_palette_and_adds_none`, `test_raw_colours_only_inside_the_three_theme_blocks_and_the_two_theme_tags`, `test_the_theme_tags_carry_the_page_ground_in_each_theme`, `test_px_font_sizes_only_inside_root`, `test_color_scheme_follows_the_device_and_the_choice`, `test_every_variable_it_reads_is_declared`, `test_contrast_for_every_pair_the_journal_uses_in_both_themes` with `test_the_contrast_check_can_fail`, `test_muted_is_never_set_on_the_selected_fill`, `test_no_uppercase_and_no_positive_tracking`, `test_archivo_only_on_the_wordmark_and_no_monospace_anywhere`, `test_corners_are_six_or_eight_and_nothing_casts_a_shadow_or_moves`, `test_borders_are_one_pixel_and_outlines_are_two`, `test_exactly_twelve_icon_shapes_all_stroked_in_the_current_colour`, `test_the_shapes_are_the_ones_in_the_brief`, `test_every_control_the_script_makes_names_what_it_acts_on`, `test_every_target_a_finger_lands_on_is_44px_under_a_coarse_pointer`, `test_five_panels_in_the_brief_s_order_and_names`, `test_the_layout_at_each_width`, `test_today_and_tomorrow_are_marked_in_month_by_a_fill_and_a_word`, `test_moved_entries_are_hidden_behind_a_quiet_line_that_opens_and_closes_them`, `test_each_panel_draws_itself_and_is_skipped_when_it_is_not_there` (the shape that lets the browser check draw each panel alone), `test_the_header_the_theme_switch_and_what_is_hidden_signed_out`, `test_sign_in_uses_the_notes_words` and `test_the_theme_script_wraps_storage_in_try_catch_and_runs_before_the_stylesheet`. Class `JournalPageKeepsItsPromises`: `test_the_page_applies_changes_with_the_shared_rules_and_does_not_work_out_revisions`, `test_dates_are_londons_and_the_server_never_decides_what_today_is`, `test_the_strip_offers_bring_all_forward_and_never_a_drop_all`, `test_a_refresh_never_replaces_or_drops_what_the_page_holds`, `test_the_page_says_when_an_entry_was_made_and_never_chooses_a_copy_id`, `test_undo_of_a_delete_makes_a_new_entry_because_a_removed_entry_keeps_its_id`, `test_a_move_to_a_day_says_which_day_and_offers_to_open_it`, `test_a_change_that_could_not_be_sent_is_sent_again_as_the_very_same_change`, `test_nothing_is_moved_migrated_or_dropped_by_a_timer_or_by_loading`, `test_memory_is_dropped_on_sign_out_on_a_401_and_when_the_page_is_left`, `test_nothing_is_painted_before_the_session_is_confirmed`, `test_the_device_holds_the_theme_and_the_last_tab_and_nothing_else`, `test_no_service_worker_and_the_files_that_install_it_are_public`, `test_install_tags_and_the_manifest`, `test_the_shortcuts_the_brief_names`, `test_every_empty_state_and_message_says_exactly_what_the_brief_says`, `test_a_clash_keeps_the_typed_text_and_offers_reload_never_replaces_it` and `test_a_message_with_an_undo_lasts_ten_seconds_and_a_clash_stays_until_dismissed`. In `test_notes_page.py`, `test_exactly_thirteen_icon_shapes_all_stroked_in_the_current_colour` (renamed from twelve, which section 9d names) and `test_the_menu_is_a_nav_with_the_items_in_order_and_no_headings` now hold the Journal item. The rules are held by `notes-tests/journal-core.test.js` (every state, move, undo, the strip, the markers, a damaged entry or line file, how a copy is named, how two views are put together, what a change writes, and that no rule reads a clock) and the API by `notes-tests/journal-stale.test.js` (the stand-in for the 60 seconds, then each change under it) and `notes-tests/journal-api.test.js` (the gate on every route and every kind of bad cookie, no-store on every answer, that an add reads nothing and an edit reads one file and creates one, the version checks, two devices, a move across months and its rollback, nothing written by reading, storage kept apart from notes, the Blob adapter, a damaged file, and quick notes) and `notes-tests/blob-auth.test.js` (the adapter against the real package). The page's behaviour in a browser, with every width, both themes, a mouse and a finger, is `docs/evidence/journal/browser-check-journal.mjs`, which is run by hand and is not part of either suite.

## 10. Stack

The Forecast Diagnostic is a **FastAPI application on Python**, deployed to Vercel by the `@vercel/python` builder from `forecast-app/app.py`. The marketing site at the repository root is static.

Forecasting through Google BigQuery `AI.FORECAST` using managed TimesFM 2.5, London region `europe-west2`, context window pinned to 512, confidence level 0.9 giving interval bounds at 0.05 and 0.95.

The managed model can change behind an unchanged version string, so a drift canary runs a fixed synthetic series and hashes the result against a baseline.

---

## 11. Working with the product owner

He is not a developer and does not want to be one. Two rules carried over from the previous build session, because they were learned the hard way and are worth inheriting.

**Explain an unfamiliar technical step plainly, before doing it.** One or two sentences on what it does and why, in the language of the problem rather than the language of the tool.

**Give one direct recommendation, not a menu.** When there is a decision to make, say what you would do and why, then let him overturn it. A list of options with balanced trade-offs and no recommendation reads as evasion and costs him a round trip. This applies to merges especially: say merge or do not merge, and give the reason.

### 11a. The six-line format

Every build reports back in six lines, in this order. Written down on 16 September 2026 at the product owner's instruction, because until then it lived only in his messages.

1. **Built.** What shipped, and where: the branch and the pull request.
2. **Not built.** Anything the brief asked for that is not in the diff, and why in one clause.
3. **Tests.** The suite count before and after, and the named controls the brief listed.
4. **Checked.** The specific things the brief said must not break, each with its result.
5. **Evidence.** Where the evidence file is, what was actually run, and what was not run.
6. **Questions.** The open questions file and how many questions are waiting.

Six lines, always. A line with nothing to report says so rather than being dropped, because a missing line reads as an oversight and a line saying "none" reads as an answer. Detail goes underneath, and the direct recommendation goes last, as above.

**Line 5 is the one that rots.** Never claim a check that did not run. Section 13 says this already and this line is where it gets broken, because the honest version is longer than the flattering one.

---

## 12. Definition of done, every story

1. Acceptance criteria in the brief all pass, with nothing softened to get there.
2. Cross-stage consistency tests pass.
3. Fixture integrity test passes.
4. Any new panel renders in isolation in a test.
5. Manifest and bundle schemas bumped if their shape changed, and golden files regenerated with verifying hashes.
6. No client data in the manifest.
7. No banned string in production code, manifest fields or user-facing copy.
8. Nothing in the diff that the brief did not ask for.

---

## 13. Documentation rule

Every build must leave enough committed evidence for a new developer or AI system to continue without the previous conversation. Record decisions, limitations, configuration names, test evidence and the exact next starting point. Never claim a Preview or Production check that did not run.

**A check that reports zero observations has not passed, it has not run.** `.stage-tag` returned zero across all eight tabs during the theme band, which read as a clean result and was an empty one: it renders only inside an open line detail, and opening one found five. This is the same family as a control that shares the defect's blind spot, so the first question of any check is whether it saw anything at all, and the count belongs in the evidence beside the result.

**A correction to the record stays on the record.** Q19 was deleted by accident while Q18 was being corrected in place, and the loss shipped before it was caught. The note in `docs/assay-theme-open-questions.md` saying what happened and how it was found stays there and is not tidied away later. Ruled by the product owner on 16 September 2026: a question that disappeared and was noticed is evidence the method works, and one that disappeared quietly would be the opposite.
