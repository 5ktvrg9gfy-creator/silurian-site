# Fixture and expectations tooling

These eleven scripts produced the test fixtures and expectations files that the
Silurian Assay suite pins by sha256, plus the independent checkers used to verify
them and to verify a real production run.

They were written and run in the specification session, not in the application.
None of them is part of the product and none of them should ever be imported by it.

Committed here on 4 September 2026 for one reason: the fixture integrity test
fails the build if a fixture or an expectations file changes, so a file that ever
needs regenerating cannot be regenerated if the script that made it is gone. Until
now these existed in one chat window only.

## The rule that governs all of them

**The committed fixture and expectations files are authoritative. These scripts are
not.**

If a script's output ever differs from the committed file, the committed file wins.
Investigate the difference, do not overwrite the file to make the script agree.
The suite pins the file, the client-facing numbers were verified against the file,
and a hash that changes because someone re-ran a generator is the failure the
integrity test exists to catch.

## What must not happen to them

- Do not wire any of them into the test suite. They are not tests and they are not
  fixtures. They are the provenance of both.
- Do not run a generator as part of a build, a hook, or CI.
- Do not edit a generator to change a fixture. A fixture change is a story with a
  brief, an updated hash in the integrity manifest, and reissued expectations.

## The scripts

### Generators

| Script | Produced |
|---|---|
| `make_fixtures.py` | The twelve sprint 1 validation fixtures, `00` to `12` |
| `make_quality_fixtures.py` | The three data quality fixtures, `20` to `22` |
| `make_sprint2_fixture.py` | `30_classification_portfolio.csv` |
| `make_fixture31.py` | `31_routing_portfolio.csv` |
| `make_expected_classification.py` | `expected_classification.json` |
| `make_expected_routing.py` | `expected_routing.json` |
| `make_golden_manifest.py` | The golden run manifest and its rejected variant |
| `make_golden_bundle.py` | The golden run bundle |

Every generator that uses randomness seeds it explicitly, so output is
deterministic: 1972, 4419, 20260831 and 20260902 respectively.

### Checkers

| Script | Checks |
|---|---|
| `verify_expected_classification.py` | Recomputes ADI, CV squared, the demand state, the ABC class and every share from `30_classification_portfolio.csv`, then checks the expectations file's claims about itself. Includes the dash-character scan and the banned "nine box" string. |
| `verify_expected_routing.py` | The same for `31_routing_portfolio.csv` and `expected_routing.json`, including the routing precedence and the volume shares. |
| `verify_2.1_production.py` | Takes a JSON response from a real run plus the expectations file and reports acceptance criteria 1 to 11 and 15 from build brief 2.1 revision 1.2, one line each. Exit 0 means every check passed. |

## Paths

The scripts were written against one flat directory in the specification session.
The repository splits the fixtures across five directories, so every script now
takes its paths as arguments, under one rule:

**Reads default to the repository copy. Writes have no default and must be named.**

A read defaults to the committed file, resolved from the script's own location, so
a checker can be run with no arguments at all. A write is always an explicit
`--out`, so a stray run of a generator cannot overwrite a committed fixture. That
guard exists because the rule above says the committed file wins, and a default
output path would point every generator straight at the file it must not touch.
`--out` names a directory for scripts that write several files and a file for the
two that write one.

Where the committed copies live:

| Script | Writes | Committed copies |
|---|---|---|
| `make_fixtures.py` | 13 CSVs | `tests/fixtures/` |
| `make_quality_fixtures.py` | 3 CSVs and `expected_quality.json` | `tests/quality_fixtures/` |
| `make_sprint2_fixture.py` | `30_classification_portfolio.csv` | `tests/classification_fixtures/` |
| `make_fixture31.py` | `31_routing_portfolio.csv` | `tests/fixtures/` |
| `make_expected_classification.py` | `expected_classification.json` | `tests/classification_fixtures/` |
| `make_expected_routing.py` | `expected_routing.json` | `tests/fixtures/` |
| `make_golden_manifest.py` | 2 golden manifests | `tests/run_manifest_fixtures/` |
| `make_golden_bundle.py` | `run_bundle.golden.json` | `tests/run_bundle_fixtures/` |

The three checkers write nothing.

### Two scripts run in pairs

`make_sprint2_fixture.py` and `make_fixture31.py` each compute per-SKU metrics
while building their fixture and hand them to the matching expectations
generator. In the specification session that handoff was a file in `/tmp`. It is
now `--metrics-out` on the producer and `--metrics` on the consumer, so the pairing
is visible rather than implied:

```
make_sprint2_fixture.py --out DIR --metrics-out FILE
make_expected_classification.py --metrics FILE --out FILE

make_fixture31.py --out DIR --metrics-out FILE
make_expected_routing.py --metrics FILE --out FILE
```

Neither expectations generator can run without its handoff, so the fixture is
always regenerated first and the two cannot drift apart.

## Requirements

Python 3, standard library only. No third-party packages, no network access, no
credentials. `verify_2.1_production.py` reads a run response from a file you supply;
it does not call the deployed application, which is now behind a password anyway.

## The correction worth reading

`make_expected_routing.py` carries a comment recording the error that produced
version 1.0 of the expectations file: volume shares were computed by summing
per-SKU shares that had already been rounded to two decimal places, giving an
eligible share of 65.58 where the exact figure is 65.5687. Shares are computed from
the fixture in units. The build session caught it, and the same class of error
came back on the open items column and became story 2.7.9.
