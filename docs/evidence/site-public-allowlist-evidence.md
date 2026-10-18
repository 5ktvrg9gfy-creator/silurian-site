# Site public allowlist: evidence, 17 October 2026

Branch `site-public-allowlist`, cut from `main` at `03ee354`. Not merged. Nothing deployed.

## The problem

`https://www.silurianconsulting.co.uk/CLAUDE.md` was reported served in full on Production. The static project had no build step, no output directory and no ignore file, so Vercel served the whole repository root. That includes `CLAUDE.md`, `PROJECT_HANDOFF.md`, `docs/` and `forecast-app/`, test fixtures and source. This was not fetched from here (this session's network blocks Vercel hosts); the report is the product owner's.

## The fix

`vercel.json` sets `buildCommand` to `node scripts/build-public.mjs` and `outputDirectory` to `public`. The script copies exactly the paths in `site-allowlist.txt` into `public/`, and Vercel serves only that folder. A file not on the list is not deployed and answers 404, so a new file is private by default. A missing allowlisted file, a path with `..`, a wildcard or a leading slash, and an output folder that is the repository all stop the build. `public/` is gitignored.

Public files, 10 in all: the five pages, `tokens.css`, `logo-stone.svg` and the three files in `assets/`. Everything the pages load locally is among them (the only other reference is Vercel's own `/_vercel/insights/script.js`, which Vercel supplies).

## Why the forecast-app project cannot be affected

- `forecast-app/vercel.json` builds `app.py` and routes every path to it. That only works if the Assay project's root is `forecast-app/`, which is what CLAUDE.md section 3 describes. A project rooted there reads files under `forecast-app/` and never the root `vercel.json`.
- The new root `vercel.json`, `scripts/` and `site-allowlist.txt` are all outside `forecast-app/`.
- The one change inside `forecast-app/` is a new test file, `tests/test_marketing_deploy_allowlist.py`. No application code, config or fixture changed, so a Preview of the Assay project should be identical in behaviour. It will still rebuild on this push.
- **Not verified:** the Root Directory setting itself, which lives in the Vercel dashboard (Settings, General). This is inference from the repository. The Assay project's Preview for this branch should be opened once and match Production.

## What ran

- Build run locally: 8 allowlist entries copied, 10 files in `public/`, none of them private.
- `python -m unittest discover -s tests` from `forecast-app/`: **303 before, 311 after, passing.** The eight new tests are `test_marketing_deploy_allowlist.py`. The other suites, including the secret scan, the fixture integrity test and the marketing site token, radius and analytics scans, are unchanged and pass.
- The control was broken three ways and failed each time, then was restored: `CLAUDE.md` added to the allowlist (3 tests failed, naming it), the whole `docs/` directory added (3 failed), and the script changed to copy the whole repository (3 failed, naming `.git` and every private file).

## What was not run

- No Vercel Preview or Production. The build command, the output directory and the 404 behaviour are proved only by running the same script locally.
- No fetch of any live URL. The URL list for the Preview check is in the pull request report.
- Search engines and caches may already hold copies of the exposed files. That cannot be undone from the repository.
