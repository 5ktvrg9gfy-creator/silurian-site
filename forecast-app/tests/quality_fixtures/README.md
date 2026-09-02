# Quality fixtures

`20_portfolio_mixed.csv` in this directory is the canonical Story 1.2 to 1.5 portfolio fixture. Exact byte-hash assertions must use this repository file. The repository pins CSV files to LF line endings so the bytes remain stable across checkouts. Copies passed through browsers or document systems can be re-serialised while preserving the same rows, so they are suitable for content checks but not exact source-hash checks.
