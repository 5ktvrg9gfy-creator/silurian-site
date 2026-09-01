# Final Codex handoff audit

Audit date: 1 September 2026.

Scope: repository documentation, local worktrees, branch refs and deployment configuration names. No engine code changed.

## Result

| Control | Result | Action |
|---|---|---|
| Standing rules at repository root | Missing | Added `CLAUDE.md`. |
| Story open-question records through 2.0 | Missing for 1.4, 1.5 and 1.6 | Added answered records. Existing 1.1, 1.2, 1.3 and 2.0 records retained. |
| Manifest hashing override reasoning | Not held in one durable decision record | Added `ADR-001-manifest-integrity-hashing.md`. |
| Conversation decisions | Substantially present | Added explicit authority, route, fixture, infrastructure and schema sections to `PROJECT_HANDOFF.md`. |
| Fixture purpose and deployed check | Fragmented across briefs and notes | Added `fixture-inventory.md`. |
| Drift canary hash and confirmation date | Present | Hash and 29 August 2026 confirmation remain in `PROJECT_HANDOFF.md`. |
| Known limitations | Present | Expanded with repository protection, CI and external-configuration gaps. |
| Pull-request test workflow | Missing | No `.github/workflows` directory. Vercel deploy checks run, but the Python suite does not run automatically on pull requests. Recorded as a limitation. |
| Branch protection | Missing | GitHub shows no classic branch protection and no ruleset for `main`. Recorded as a limitation. |
| Exact Google project and service-account identifiers | Deliberately absent | Values remain in protected Vercel configuration. The repository records the variable names and approved region, not private identifiers. |
| Named BigQuery dataset | Not applicable to current code | The provider uses parameterised queries and anonymous query-result storage. No application dataset is configured. |
| Classification expectation byte stability | Incomplete | The committed blob matches approved SHA-256 `056a169e...b9688e`, but this Windows checkout produces `7b73d3bb...d7675` because JSON is not pinned to LF. CSV is already pinned. The migration task must add the expected JSON paths to `.gitattributes` before adding disk-hash enforcement. |

## Local worktrees

The primary worktree was clean at audit start. Five obsolete worktrees each report the same three CSV files as modified:

- `silurian-site-story-1-5`
- `silurian-site-story-1-5-handoff`
- `silurian-site-story-1-6`
- `silurian-site-story-2-0`
- `silurian-site-story-2-0-closeout`

The reported changes are CRLF versus LF line endings in `forecast-app/sample-data.csv`, `forecast-app/sample-portfolio.csv` and `forecast-app/tests/fixtures/01_excel_export_furniture.csv`. No semantic row change was identified. They were not discarded because cleaning an old worktree is destructive and requires explicit owner approval.

## Unmerged branch refs

No pull request was open at audit time. These refs are not ancestors of `main`:

- local and remote `codex/preview-tex-gyre-heros`
- local `codex/story-1-2-data-quality`
- remote `codex/bold-industry-intro`
- remote `codex/forecast-app-foundation`
- remote `codex/grey-logo`
- remote `codex/header-logo-after-text`

The Story 1.2 and forecast-foundation work was superseded by later merged implementation. The remaining branches are abandoned design previews. They were not deleted because local and remote branch deletion is destructive and requires explicit owner approval.

## Infrastructure evidence boundary

The audit inspected Vercel variable names and environment scopes without revealing values. The exact Google Cloud project identifier and service-account email cannot be reconstructed from source and should not be copied into the repository under the existing data-handling rule. A new operator needs Vercel and Google Cloud access to manage those values.

## Residual actions requiring owner authority

- Approve removal of the five obsolete worktrees after discarding their line-ending-only changes.
- Approve deletion of the seven obsolete local or remote branch refs listed above.
- Decide whether to add branch protection for `main`.
- Decide whether to add a GitHub Actions workflow that runs the Python suite on every pull request.
- Pin the expectation JSON files to LF and add the separately specified fixture-integrity test. Prove it fails after a one-byte fixture change, then revert the change.
- Obtain written provider confirmation on backup scope before strengthening the client retention statement.
