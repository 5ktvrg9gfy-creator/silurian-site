# Specification record, sprints 1 and 2

The build briefs, answer sets, fixture notes and test protocols written in the
specification session between 28 August and 3 September 2026, and used to build
everything on `main` up to band 2.7.

Committed on 4 September 2026 so that the reasoning behind the product exists in
the repository rather than in a chat window. Until now it did not.

## What these are, and what they are not

**They are the record of why, not the statement of what.** The authority order in
`CLAUDE.md` section 2 is unchanged by this commit: the expectations files govern
numbers, the tests govern behaviour, `CLAUDE.md` governs the rules, and a brief is
below all three. Several briefs in here are wrong in places, and the corrections
are recorded in the files that superseded them.

**They are historical from the moment they land.** A brief that has already been
built from is a record. Do not go back and edit one to match what was built; where a
brief and the built product disagree, the product is right and the disagreement is
already documented in the pull request that resolved it.

**Nothing here is client-facing.** Not one of these files should be published,
linked from the application, or sent to a client without being rewritten for that
purpose.

## Known corrections carried in these files

The specification session got four things wrong that reached a brief, and each was
caught by someone who could check. They are left in place with their corrections
rather than tidied away, because the pattern is more useful than a clean record.

- Fixture 30 asserted as quality-clean without the engine ever having been run. It
  returns six findings and a caveated band. `expected_classification.json` v1.2
  records them as observed, not specified.
- The eligible share reported as 65.58, by summing per-SKU shares already rounded to
  two places. The exact figure is 65.5687. The same error class returned on the open
  items column and became story 2.7.9.
- The readiness sentence in the 2.7 brief said nine of fourteen, which counted the
  two `policy_only` lines as forecastable. That is the conflation story 2.7.4 exists
  to expose, reproduced inside the sentence written to fix it. The correction and
  the three-clause form are recorded in `2.7-build-brief.md`.
- Sprint 2 acceptance criterion 16 named a line further down the open items list than
  the one the screen puts at the top. The planner went to the top, as designed. The
  criterion was wrong and the screen was right. See `planner-test-findings.md`.

## What is in here

**Build briefs.** `1.1` through `1.6`, `2.0` through `2.3`, and `2.7`. Each one is
the brief as sent, including revisions where a brief was corrected before build.

**Answer sets and amendments.** `1.1-answers.md`, `1.2-answers.md`,
`1.3-amendments.md`, `1.5-map-review.md`. The product owner's decisions on open
questions, which is where most of the product's actual rules were settled.

**Fixture notes.** `2.1-fixture-note.md` and `31-fixture-note.md` describe what was
planted in fixtures 30 and 31 and why. `MANIFEST.md` lists the sprint 1 fixtures.

**Routing table.** `2.2-routing-table.md`, the seven routing decisions and the
precedence rules, approved before build.

**Test protocols.** `planner-test-pack.md` is the protocol for the planner test and
is the acceptance bar for band 2.7. `planner-test-findings.md` is the record of the
first run, on 2 September, which produced band 2.7. `one-minute-test.md` is the
earlier, shorter version of the same protocol.

**Migration record.** `migration-checklist.md`, `codex-shutdown-task.md`,
`migration-first-task.md` and `cold-start-prompt.md` document the move of the build
from ChatGPT Codex to Claude Code on 1 September, including the cold start task used
to prove the handover rather than assume it.

**Provider questions.** `client-security-questions.md` predates band 2.8 and covers
some of the same ground. It is an input to 2.8.1, not an answer to it.

## One standing rule visible throughout

The specification session never holds credentials. `migration-checklist.md` states
it plainly: inventory only, never values. No service account keys, no BigQuery
credentials, no Vercel or GitHub tokens, no environment variable values, no `.env`
files. That rule held for the whole of sprints 1 and 2 and it holds now.
