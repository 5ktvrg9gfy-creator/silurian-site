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

**`2.7-build-brief.md`.** The archived copy was the later revision, carrying the
corrected readiness sentence, "7 of 14 lines can be forecast", and a correction note
dated 3 September recording that revision 1.0 said "Nine of fourteen" and why that
was wrong. `docs/briefs/2.7-build-brief.md` was revision 1.0 and still read nine,
which is the exact conflation band 2.7 exists to expose, standing in the live copy
rather than in an archive. It has since been replaced with the corrected revision,
so the two are now the same document and there is still only one copy of it.

**`2.2-build-brief.md`.** Four lines of wording differ, none of them a number or a
decision. The archived copy adds emphasis and says the headline is stated "to two
decimals". The two are the same brief.

**`MANIFEST.md`.** These disagree about fixture 05, and the disagreement is not
cosmetic. The archived copy says the expected verdict is **reject**, on the
conflicting key. The repository copy says **accept with warnings**.

`expected_findings.json` records the verdict for `05_duplicates_and_aliases.csv` as
**reject**. Under the authority order in `CLAUDE.md` section 2 the expectations file
governs, so the archived prose agrees with the authority and the repository's copy of
this manifest is stale on that point. The prose manifest is a description;
`expected_findings.json` is the control, and `test_every_fixture_pass` holds the
engine against it.

A second stale verdict was found in the same file while checking the first.
`07_zeros_versus_gaps.csv` reads "accept with warnings, one per SKU" where the
control records `accept`, because story 1.6 moved those characterisations out of
validation and into the quality stage.

Neither has been corrected. `forecast-app/tests/fixtures/MANIFEST.md` is hash-pinned
by `tests/fixture_hashes.json`, so changing a word in it fails
`test_committed_fixture_hashes_are_unchanged` until the pin is reissued. That is a
deliberate act on a control and it is not the build session's to make alone.
