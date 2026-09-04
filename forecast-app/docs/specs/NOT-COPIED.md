# Documents in the specification archive that are not in this directory

`README.md` in this directory describes the whole specification archive, including
thirteen documents that were already in the repository when it was committed. Those
were not copied, because two copies of a document drift, which is the same rule as
one implementation of any judgement.

This file exists so that a reader following `README.md` to a document that is not
here finds out where it is, rather than concluding it was lost.

Nothing here corrects anything. Where an existing copy and the archived copy differ,
the difference is recorded and neither file was edited.

| Document | Where the repository's copy lives |
|---|---|
| `1.1-answers.md` | `forecast-app/tests/fixtures/1.1-answers.md` |
| `1.1-build-brief.md` | `forecast-app/tests/fixtures/1.1-build-brief.md` |
| `1.2-answers.md` | `forecast-app/tests/quality_fixtures/1.2-answers.md` |
| `1.2-build-brief.md` | `forecast-app/tests/quality_fixtures/1.2-build-brief.md` |
| `1.3-amendments.md` | `forecast-app/docs/1.3-amendments.md` |
| `1.3-build-brief.md` | `forecast-app/tests/run_manifest_fixtures/1.3-build-brief.md` |
| `2.1-fixture-note.md` | `forecast-app/docs/2.1-fixture-note.md` |
| `2.2-build-brief.md` | `docs/briefs/2.2-build-brief.md` |
| `2.3-build-brief.md` | `docs/briefs/2.3-build-brief.md` |
| `2.7-build-brief.md` | `docs/briefs/2.7-build-brief.md` |
| `MANIFEST.md` | `forecast-app/tests/fixtures/MANIFEST.md` |
| `planner-test-findings.md` | `docs/planner-test-findings.md` |
| `planner-test-pack.md` | `docs/planner-test-pack.md` |

Six of the thirteen are byte-identical once trailing whitespace is normalised, and
four are byte-identical outright. Three differ, and the differences are worth
knowing.

## Where the two copies differ

**`2.7-build-brief.md`.** The archived copy is the later revision. It carries the
corrected readiness sentence, "7 of 14 lines can be forecast", and a correction note
dated 3 September recording that revision 1.0 said "Nine of fourteen" and why that
was wrong. The repository copy is revision 1.0 and still reads nine. Nothing is lost
by not copying the later one: the correction is recorded in full in
`docs/2.7-open-questions.md` Q1 and Q2, and the built product says seven.

**`2.2-build-brief.md`.** Four lines of wording differ, none of them a number or a
decision. The archived copy adds emphasis and says the headline is stated "to two
decimals". The two are the same brief.

**`MANIFEST.md`.** These disagree about fixture 05, and the disagreement is not
cosmetic. The archived copy says the expected verdict is **reject**, on the
conflicting key. The repository copy says **accept with warnings**.

`expected_findings.json` records the verdict for `05_duplicates_and_aliases.csv` as
**reject**. Under the authority order in `CLAUDE.md` section 2 the expectations file
governs, so the archived prose agrees with the authority and the repository's copy of
this manifest is stale on that point. Neither file was edited here. The prose
manifest is a description; `expected_findings.json` is the control, and
`test_every_fixture_pass` holds the engine against it.
