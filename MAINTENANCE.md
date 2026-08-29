# Silurian website maintenance

GitHub is the source of truth for this website. Do not replace the repository with a new Claude Design export.

## Current architecture

- Static one-page website
- Entry point: `index.html`
- Main visual asset: `logo-stone.svg`
- No application framework
- No dependency installation or build command
- Vercel deploys the repository directly

## Safe update process

1. Start from the latest `main` branch.
2. Create a branch named `codex/<short-change-name>`.
3. Make the required edits on that branch.
4. Check the automatic Vercel preview on desktop and mobile.
5. Review and update `PROJECT_HANDOFF.md` so it reflects the build, checks, configuration impact and next starting point.
6. Open a pull request into `main`.
7. Merge only after the preview has been approved.

A commit to `main` is a production release because Vercel deploys it automatically.

The handoff update is part of every build, including small wording or layout changes. If Production behaves differently from the approved Preview, correct `PROJECT_HANDOFF.md` immediately through a follow-up documentation pull request.

## Routine content locations

The current public wording is stored directly in `index.html`:

- Page title and search description in `<head>`
- Main heading and introduction in the `#about` section
- Service list in the `#about` section
- Contact email and LinkedIn link in the `#contact` section
- Company number and registered office in the footer

## Claude Design exports

Use Claude Design for concepts or draft layouts only. Compare the exported files with the current repository and transfer the intended changes into a branch. Do not upload the complete ZIP or overwrite the repository root.

## Vercel settings

- Project: `silurian-site`
- Framework preset: Other
- Build command: empty
- Output directory: repository root
- Production branch: `main`

The Vercel project is already connected to this GitHub repository. No manual Vercel deployment is required after an approved merge.
