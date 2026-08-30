# Silurian project handoff

Last updated: 29 August 2026

This is the recovery and transfer document for the Silurian website and Forecast Diagnostic. It must be reviewed and updated as part of every build, including small website changes. A new Codex task or another AI system should read this file before making changes.

## Current position

- Stories 1.1, 1.2 and 1.3 are complete and merged into `main`.
- Production is deployed and working.
- Marketing-site pull request 26 is merged. Archivo is self-hosted, the SIL Open Font Licence is retained in the repository, and a privacy notice is linked from the footer.
- Marketing preview branch `codex/preview-tex-gyre-heros` replaces Archivo with self-hosted TeX Gyre Heros on the public site and privacy page for visual comparison only. Production remains on Archivo unless the preview is approved and merged.
- The marketing site does not intentionally use analytics, advertising cookies or non-essential tracking technologies.
- The Forecast Diagnostic accepts single-SKU and portfolio CSV files, validates them before forecasting, assesses portfolio data quality, runs forecasts through TimesFM 2.5 in BigQuery, produces inventory-risk analysis, and creates a downloadable run manifest.
- Production was checked on 29 August 2026 using the fixed TimesFM reference fixture. The file was accepted, the TimesFM forecast completed, and the saved ten-run reproducibility evidence was displayed without errors.
- No database is used. Uploaded files are processed in memory and are not deliberately retained.

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
- `assets/fonts/TeXGyreHeros-Regular.otf` and `assets/fonts/TeXGyreHeros-Bold.otf`: self-hosted comparison typeface used only by the current preview branch
- `assets/fonts/GUST-FONT-LICENSE.txt`: TeX Gyre Heros licence retained with the preview font files
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

## Application routes

- `GET /`: Forecast Diagnostic interface
- `GET /health`: service and selected-provider status
- `GET /sample-data.csv`: single-SKU sample
- `GET /sample-portfolio.csv`: portfolio sample
- `POST /api/validate`: validation-only run
- `POST /api/quality`: portfolio data-quality assessment
- `POST /api/analyse`: single-SKU forecast and risk analysis
- `POST /api/analyse-portfolio`: portfolio forecast and prioritisation

## Marketing-site production configuration

- Vercel project: `silurian-site`
- Framework preset: Other
- Build command: empty
- Output directory: repository root
- Production branch: `main`
- Primary domain: `www.silurianconsulting.co.uk`

The site is static HTML and CSS. It has no application framework, package installation or build command. Routine wording is stored directly in `index.html`. The privacy notice is in `privacy.html`.

Archivo is served from `assets/fonts/Archivo-Variable.ttf`. Do not restore Google Fonts or another third-party font request unless the privacy implications have been reviewed. Keep `assets/fonts/OFL.txt` whenever the font is redistributed with the site.

The current marketing preview branch instead serves TeX Gyre Heros locally from `assets/fonts/`. It adds no third-party browser request, environment variable or deployment-setting change. If the preview is rejected, close the pull request without merging and Production will remain on Archivo.

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

Focused Story 1.3 checks:

```text
python -m unittest tests.test_run_manifest tests.test_determinism
```

On the current Windows machine, the repository's embedded Python can be used when the system `python` command is unavailable:

```text
..\.python-embed\python.exe -m unittest tests.test_run_manifest tests.test_determinism
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

## Next sprint starting point

No Story 1.4 brief has been adopted in this handoff. Before implementation:

1. Obtain the next build brief, fixtures and expected outputs.
2. Review the brief against the current validation, quality and manifest contracts.
3. Record unanswered decisions before changing code.
4. Create the next story branch from current `main`.
5. Keep Story 1.1 to 1.3 behaviour backward-compatible unless the new brief explicitly changes an approved contract.

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
