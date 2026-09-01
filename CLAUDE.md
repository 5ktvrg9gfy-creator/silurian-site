# Silurian Assay standing rules

Read `PROJECT_HANDOFF.md` before changing this repository. It is the operational recovery record and names the current Production state, architecture, controls, limitations and next starting point.

## Authority

When sources disagree, use this order:

1. `expected_findings.json`, `expected_quality.json` and `expected_classification.json` define thresholds and expected behaviour.
2. `run_manifest.schema.json` and `run_bundle.schema.json` define output shape.
3. Build briefs explain intent and reasoning, but they are not authoritative for numbers changed by later answers or expectation files.
4. This file defines standing build rules.

Stop and report a contradiction rather than choosing the convenient source.

## Products and deployment boundary

This repository contains two separately deployed products:

- The root is the static Silurian marketing site.
- `forecast-app/` is the Forecast Diagnostic FastAPI application.

Both deploy from `main` through separate Vercel projects. A pull request can therefore show two Vercel checks. Confirm the check for the component changed.

## Non-negotiable controls

- Never guess the meaning of an ambiguous client column, date, unit, total or record type.
- Never call a forecast model after a blocking validation finding.
- Never fill missing demand periods with zero silently.
- Never remove or correct an outlier silently.
- Keep validation gates separate from quality characterisation.
- Reuse quality ADI and CV-squared values in classification. Do not recompute them.
- Treat classification as evidence and implication only until a routing contract is approved.
- Keep client identifiers and demand values out of the run manifest.
- Keep confidential bundles in the browser. Do not add server-side bundle storage.
- Keep BigQuery query caching disabled for managed forecasts and fail closed on a reported cache hit.
- Keep Forecast processing in the approved London region.
- Never commit credentials, identity tokens, environment variable values or private Google Cloud identifiers.
- Do not change the approved TimesFM canary baseline because a new output differs. Investigate drift first.

## Build workflow

1. Start from current `main` and create a focused branch.
2. Read the relevant expectation file, schema, contract and open-question record.
3. Make the smallest coherent change. Do not combine product decisions with migration or handoff work.
4. Run `python -m unittest discover -s tests` from `forecast-app/`.
5. Prove new integrity controls can fail before accepting them.
6. Use the repository fixture files for exact byte-hash assertions. CSV files are pinned to LF by `.gitattributes`.
7. Test the relevant Vercel Preview before merge.
8. Merge only after acceptance, then run the relevant Production smoke test.
9. Update `PROJECT_HANDOFF.md` with the actual merge and deployment evidence.

## Documentation rule

Every build must leave enough committed evidence for a new developer or AI system to continue without the previous conversation. Record decisions, limitations, configuration names, test evidence and the exact next starting point. Never claim a Preview or Production check that did not run.
