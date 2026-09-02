# Cold-start handover gaps

Audit date: 2 September 2026.

This task changed no engine behaviour. It records information required to prove the replacement build environment that was not available as a reliable repository-controlled instruction.

## Environment gaps

- The ignored `.python-embed/python311._pth` file contained a hard-coded path to the closed build environment's ARM64 virtual environment. That path was loaded before the current repository's AMD64 packages and caused compiled dependency imports to fail. Because `.python-embed/` is ignored, the stale configuration was not visible in Git.
- The embedded Python runtime's packaged dependencies were incomplete. FastAPI and Starlette were absent after the stale path was removed, and the remaining `referencing` package was incompatible with Python 3.11. A clean Codex-provided Python 3.12 runtime with the pinned project dependencies was required to run the suite. The repository did not identify that runtime path.
- The existing Git attributes stored CSV fixtures as LF while the old Windows working tree supplied CRLF to the tests. Several expectations and goldens therefore depended on bytes that were not held in the committed blobs. Restoring every control to its old LF blob caused two existing tests to fail: fixture 02 lost its expected `LINE_ENDINGS_CRLF` finding, and the mixed-portfolio result no longer matched its CRLF-generated bundle golden. The fixture controls are now stored with their working byte forms under `-text`, while the two approved classification controls retain their specified LF hashes.

## Regression-test discovery gaps

- The handoff recorded the browser number-serialisation correction but did not identify the quality-response JSON parsing defect or its exact code path. Git history and `forecast-app/static/index.html` were required to establish that a non-JSON `/api/quality` response must produce controlled copy rather than exposing a native `Unexpected token` error. No regression test existed, so `test_quality_non_json_response_has_a_controlled_error` was added.
- The handoff recorded that a changed bundle was refused but did not name the stale-result display defect or a regression test. Git history showed that a failed reproduction once left the previous successful reproduction visible. No regression test existed, so `test_failed_reproduction_clears_stale_bundle_result` was added to require the stale result to be cleared and hidden.

## Complete repository evidence

- The Production fixture procedure, analysis date, monthly frequency, expected matrix counts and target SKU were complete and required no guess.
- The classification, quality and ABC outputs agreed with the committed expectations.
- No credential, environment-variable value or private cloud identifier was required for this handover task.
