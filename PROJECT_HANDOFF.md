# Silurian project handoff

Last updated: 3 September 2026

This is the recovery and transfer document for the Silurian website and Forecast Diagnostic. It must be reviewed and updated as part of every build, including small website changes. A new Codex task or another AI system should read this file before making changes.

## Current position

- Marketing header update, 3 September 2026: released through pull request 67, merge `1e076271427e7a283d32933ae5f088e38da0c1a6`. AI Demand Forecasting sits beside the company name and opens a dropdown linking to `https://assay.silurianconsulting.co.uk/` in a new tab. The label and Assay link match the live service list at 15.5px. Local and public Production browser checks passed at 1440, 768, 390 and 320px for sizing, overflow, click, keyboard, Escape, outside click and destination.

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
- The approved deep charcoal is `#1a1918`, exposed as `--color-charcoal-deep`. It is used in the logo and is available for future design work.
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
- `styles.css`, `ds-styles.css` and `ds-base.js`: shared visual system
- `logo-stone.svg`: main logo asset
- `privacy.html`: public privacy notice
- `assets/fonts/Archivo-Variable.ttf`: self-hosted Archivo variable font
- `assets/fonts/OFL.txt`: Archivo's SIL Open Font Licence
- `MAINTENANCE.md`: marketing-site maintenance notes
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
