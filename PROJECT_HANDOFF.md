# Silurian project handoff

Last updated: 31 August 2026

This is the recovery and transfer document for the Silurian website and Forecast Diagnostic. It must be reviewed and updated as part of every build, including small website changes. A new Codex task or another AI system should read this file before making changes.

## Current position

- Stories 1.1, 1.2, 1.3 and 1.4 are complete and merged into `main`.
- Story 1.5 is complete. Pull request 31 merged at `157b776`, and both Preview and Production acceptance passed.
- Story 1.6 is implemented on branch `codex/story-1-6-stage-consistency`. Local acceptance passes. Pull request, Preview, merge and Production acceptance remain pending.
- Story 1.4 merged in pull request 29 at `86f9b02`. Quality and forecast-bundle Preview acceptance passed, and the Production quality-bundle smoke test passed.
- Production is deployed and working.
- Marketing-site pull request 26 is merged. Archivo is self-hosted, the SIL Open Font Licence is retained in the repository, and a privacy notice is linked from the footer.
- The approved marketing spacing and white contact-section treatment from pull request 28 is present in `main`.
- Marketing preview branch `codex/preview-linkedin-badge` changes the website and privacy-page ink to the logo charcoal `#3f3d3b`. It also replaces the rectangular email and LinkedIn text buttons with matching white circular badges containing orange envelope and `in` symbols, reversing to the same charcoal with white symbols on rollover. The email address remains present in the `mailto:` link and therefore remains machine-readable. Production remains unchanged unless the preview is approved and merged.
- The marketing site does not intentionally use analytics, advertising cookies or non-essential tracking technologies.
- The Forecast Diagnostic accepts single-SKU and portfolio CSV files, validates them before forecasting, assesses portfolio data quality, runs forecasts through TimesFM 2.5 in BigQuery, produces inventory-risk analysis, and creates a downloadable run manifest.
- Production was checked on 29 August 2026 using the fixed TimesFM reference fixture. The file was accepted, the TimesFM forecast completed, and the saved ten-run reproducibility evidence was displayed without errors.
- No application database or object store is used. Uploaded files are processed for the current request and are not deliberately saved by application code. The framework can spool a multipart upload temporarily, and BigQuery uses an anonymous result table for up to 24 hours, so do not make an unqualified no-retention claim.

## Authoritative locations

- GitHub repository: `https://github.com/5ktvrg9gfy-creator/silurian-site`
- Production branch: `main`
- Marketing website: `https://www.silurianconsulting.co.uk/`
- Marketing Vercel project: `silurian-site`
- Production application: `https://silurian-forecast-diagnostic.vercel.app/`
- Forecast Vercel project: `https://vercel.com/silurian/silurian-forecast-diagnostic`
- Local repository: `C:\Users\jksta\OneDrive\Documents\Silurian Consulting Limited\silurian-site-repo`
- Forecast application: `forecast-app/`

The additional domains `silurianconsultinglimited.co.uk` and `silurianconsultingltd.co.uk` redirect to `silurianconsulting.co.uk`.

GitHub is the source of truth. Do not replace the repository with a complete design export or edit Production directly when the same change can be made through the normal branch and pull-request workflow.

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
- `PROJECT_HANDOFF.md`: mandatory build recovery and transfer record

### Forecast Diagnostic

- `forecast-app/app.py`: FastAPI routes and application orchestration
- `forecast-app/static/index.html`: complete browser interface
- `forecast-app/validator.py`: CSV input validation and normalisation
- `forecast-app/quality_engine.py`: portfolio quality metrics and findings
- `forecast-app/forecast_engine.py`: statistical baselines and inventory-risk calculations
- `forecast-app/bigquery_timesfm.py`: BigQuery TimesFM 2.5 provider and Vercel OIDC authentication
- `forecast-app/run_manifest.py`: run-manifest generation, integrity and provenance
- `forecast-app/run_manifest.schema.json`: authoritative manifest schema
- `forecast-app/run_bundle.py`: confidential bundle export, integrity, read-only reopen and reproduction comparison
- `forecast-app/run_bundle.schema.json`: authoritative bundle schema
- `forecast-app/determinism.py`: uncached repeat-run measurement
- `forecast-app/tests/`: automated tests and fixed fixtures
- `forecast-app/docs/`: signed-off contracts, surveys, open questions, amendments and deployment evidence
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

Fixture 07 validates as `accept` with zero findings. Its observed quality output is recorded separately for owner review and is not yet part of `expected_quality.json`. CV squared is explicitly a population estimate and is null below three non-zero observations. The manifest records both choices. Per-SKU trailing periods are exposed against both the portfolio cut-off and analysis date, and `EXTRACT_STALE` follows the portfolio cut-off, so fixture 07 correctly reports that the extract is seven periods stale. `SINGLE_OBSERVATION_SERIES` remains unimplemented because `HISTORY_TOO_SHORT` and the not-usable band already prevent a one-point series from proceeding.

Key references:

- `forecast-app/docs/1.6-verification.md`
- `forecast-app/tests/fixtures/expected_findings.json`
- `forecast-app/tests/test_stage_consistency.py`
- `forecast-app/validator.py`

## Application routes

- `GET /`: Forecast Diagnostic interface
- `GET /health`: service and selected-provider status
- `GET /sample-data.csv`: single-SKU sample
- `GET /sample-portfolio.csv`: portfolio sample
- `POST /api/validate`: validation-only run
- `POST /api/quality`: portfolio data-quality assessment
- `POST /api/analyse`: single-SKU forecast and risk analysis
- `POST /api/analyse-portfolio`: portfolio forecast and prioritisation
- `POST /api/reproduce-bundle`: rerun validation or quality from a supplied source and compare it with a bundle

Recorded bundles reopen entirely in the browser. There is no server reopen route.

## Marketing-site production configuration

- Vercel project: `silurian-site`
- Framework preset: Other
- Build command: empty
- Output directory: repository root
- Production branch: `main`
- Primary domain: `www.silurianconsulting.co.uk`

The site is static HTML and CSS. It has no application framework, package installation or build command. Routine wording is stored directly in `index.html`. The privacy notice is in `privacy.html`.

Archivo is served from `assets/fonts/Archivo-Variable.ttf`. Do not restore Google Fonts or another third-party font request unless the privacy implications have been reviewed. Keep `assets/fonts/OFL.txt` whenever the font is redistributed with the site.

The current marketing preview changes only spacing and contact-section colours in `index.html`. It adds no asset, third-party request, environment variable or deployment-setting change. The white contact text is a visual sample and should be reviewed for readability before merge.

The main repository is connected to both Vercel projects. Pull requests may therefore show checks for `silurian-site` and `silurian-forecast-diagnostic`. Confirm the check relevant to the changed component, and investigate any unexpected failure before merging.

## Forecast production configuration

The Vercel project uses the `forecast-app` Python application. Production is connected to `main`, and merging to `main` starts a Production deployment automatically.

Required Production environment variables:

- `FORECAST_PROVIDER=bigquery_timesfm`
- `GOOGLE_CLOUD_PROJECT`
- `GCP_PROJECT_NUMBER`
- `GCP_WORKLOAD_IDENTITY_POOL_ID`
- `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- `BIGQUERY_LOCATION`
- `BIGQUERY_MAX_BYTES_BILLED`
- `TIMESFM_REFERENCE_BASELINE_SHA256`
- `TIMESFM_DETERMINISM_JSON`
- `APP_VERSION`

The Google Cloud values and the complete determinism JSON belong in Vercel, not in this repository. Never copy credentials, identity tokens or private Google Cloud identifiers into source files, commits, issues, manifests or this handoff.

`BIGQUERY_LOCATION` must select the London BigQuery region in both Preview and Production. Story 1.5 live acceptance verified both Preview and Production jobs in `europe-west2`. Recheck the first Production forecast after any future change that affects deployment settings.

`TIMESFM_MEASURE_DETERMINISM` is a temporary controlled-measurement flag. It must not remain enabled in Production. When enabled in an isolated Preview, each forecast request runs TimesFM ten times and incurs additional time and BigQuery usage.

## Authentication and model path

- Vercel obtains a short-lived identity token through its OIDC integration.
- Google Workload Identity Federation exchanges that token for restricted Google credentials.
- The application impersonates the configured service account.
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

Focused Story 1.3, 1.4, 1.5 and 1.6 checks:

```text
python -m unittest tests.test_app_manifest tests.test_bigquery_timesfm tests.test_run_manifest tests.test_determinism tests.test_run_bundle tests.test_stage_consistency tests.test_validator
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
- State the exact next starting point when work remains.

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

## Known limitations

- The application has no user accounts, database or persistent run history.
- Run and validation records are downloaded by the user rather than stored by the service.
- TimesFM is a managed provider, so its hidden checkpoint and training details are not exposed by Google.
- The stored determinism result describes the measured deployment and options. Re-run the controlled measurement after a material model, provider, precision, region or forecast-option change.
- Portfolio decisions still require planner confirmation of operational context, supply assumptions, returns, units and discontinuations.
- The root design-system documentation contains legacy export material. The working Forecast Diagnostic interface is `forecast-app/static/index.html`.
- The repository contains two independently deployed products. A change at the root affects the marketing site; a change under `forecast-app/` affects the Forecast Diagnostic.
- Story 1.4 exposes deliberate reproduction for validation-only, quality and forecast bundles. Forecast reproduction compares the rerun model series and intervals while retaining Story 1.3 model identity, canary, environment and determinism controls.
- Story 1.6 repairs the previously recorded Story 1.1 fixture mismatches. Full local discovery passes 67 tests.

## Next starting point

Story 1.6 is implemented but not yet released:

1. Push the owner-review corrections to pull request 37 and wait for its checks and refreshed Preview.
2. Repeat Preview acceptance for fixture 07, including null CV squared, explicit trailing measures and `EXTRACT_STALE`.
3. Merge only after Preview approval, wait for Production, then repeat the mixed-portfolio check and update this handoff with the merge and deployment evidence.
5. Preserve Story 1.5 controls: London processing, cache-hit rejection, metadata-only logging, browser-only bundle reopening and manifest filename hashing.

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
