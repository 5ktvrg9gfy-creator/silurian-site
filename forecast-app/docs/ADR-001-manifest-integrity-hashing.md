# ADR 001: run manifest integrity hashing

Status: accepted and implemented.

## Context

The Story 1.3 brief described one manifest hash but also expected timestamp-independent comparison. One hash cannot be both an exact run identity and stable when run identity and timings move. The first Story 1.4 golden generator also cleared both integrity fields for both calculations, which meant the exact manifest hash did not cover the recorded fingerprint.

## Decision

The manifest carries two hashes with different purposes:

- `content_fingerprint_sha256` identifies calculation-equivalent content across run and deployment identity changes.
- `manifest_sha256` identifies the exact manifest and covers the real content fingerprint.

Calculate them in this order:

1. Set both integrity hash fields to empty.
2. Remove run identity, timings, source filename identity and deployment-only identity.
3. Calculate and write `content_fingerprint_sha256`.
4. Leave the real fingerprint in place and set only `manifest_sha256` to empty.
5. Calculate and write `manifest_sha256`.

The content fingerprint retains source byte identity, effective options, stage outputs, model identity, key calculation libraries and region. It excludes application version, Git commit and container image identity because those can move without changing the calculation.

## Consequences

- A changed recorded fingerprint always changes the exact manifest hash.
- Two equivalent calculations can share a content fingerprint while retaining distinct exact manifests.
- The dependency graph remains a separate integrity check.
- Any future schema change must preserve this order or deliberately version the contract.

## Evidence

The implemented functions are `content_fingerprint` and `exact_manifest_hash` in `run_manifest.py`. Tests cover timestamp stability, deployment-only identity exclusions, exact-hash movement and corrupted integrity refusal.
