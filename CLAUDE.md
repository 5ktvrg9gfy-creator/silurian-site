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

- The root is the static Silurian marketing site.
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
- Never commit credentials, identity tokens, environment variable values or private Google Cloud identifiers.
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

**No em dashes or en dashes anywhere in user-facing copy.** No em dash, no en dash, no spaced hyphen used as a dash. Standard hyphenation is fine. This is a house rule of the owner's and it applies to the product, not only to documents.

Absence is a result. An empty state names what was eligible, what was excluded and why, and offers the next action.

---

## 9. Design system

Tokens are lifted from `index.html` on the marketing site. Do not re-derive or invent them.

- Charcoal `#3f3d3b`, main orange `#ec6917`, dark orange `#c15613`, warm neutral `#cabfad`, deepest ink `#1a1918`.
- Page ground `#f3f2f2`, surface `#eae9e9`. Panels sit **darker** than the page, which inverts the usual expectation.
- **Archivo only**, weight 800 for display, `font-feature-settings: "tnum" 1` for figures. There is no mono in the system.
- **Zero radius everywhere.** Structure is drawn with 2px solid rules on seams and 1px hairlines inside tables, not floated on shadows. This is the single biggest difference from a generic dashboard.
- Orange is spent as a mark or a field, never as a status palette. State is encoded twice on every row, colour and words, so removing colour entirely leaves the screen fully readable.
- No dark mode. The system is print derived and commits to paper. Paint every colour explicitly.

The tokens, the Archivo rule and the zero radius rule are enforced by `test_workspace_uses_approved_visual_tokens`. The rest of this section is advisory.

---

## 10. Stack

The Forecast Diagnostic is a **FastAPI application on Python**, deployed to Vercel by the `@vercel/python` builder from `forecast-app/app.py`. The marketing site at the repository root is static.

Forecasting through Google BigQuery `AI.FORECAST` using managed TimesFM 2.5, London region `europe-west2`, context window pinned to 512, confidence level 0.9 giving interval bounds at 0.05 and 0.95.

The managed model can change behind an unchanged version string, so a drift canary runs a fixed synthetic series and hashes the result against a baseline.

---

## 11. Working with the product owner

He is not a developer and does not want to be one. Two rules carried over from the previous build session, because they were learned the hard way and are worth inheriting.

**Explain an unfamiliar technical step plainly, before doing it.** One or two sentences on what it does and why, in the language of the problem rather than the language of the tool.

**Give one direct recommendation, not a menu.** When there is a decision to make, say what you would do and why, then let him overturn it. A list of options with balanced trade-offs and no recommendation reads as evasion and costs him a round trip. This applies to merges especially: say merge or do not merge, and give the reason.

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
