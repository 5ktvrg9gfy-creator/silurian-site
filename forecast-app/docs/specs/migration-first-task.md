# Migration: first task for the new build session

2.2 is not the right first job. There is no brief for it yet, and a migration should not be proved by a story that also has product risk in it.

The first job is a cold start with no product decisions in it. It is small, it is entirely verifiable, and if the handoff is incomplete it fails within the hour rather than three days into a story.

**Do not close Codex until this comes back green.** Keep it open and idle. Closing the old environment before the new one has built, tested and deployed anything is the one avoidable way to lose a week.

---

## Order

1. Start the new session and give it the message below. It does not need Codex for any of it.
2. In parallel, send Codex the shutdown task from `codex-shutdown-task.md`.
3. When the new session has a merged PR and a green deploy, close Codex.

---

## The message

Paste this into the new chat with the repository available.

> You are the developer on Silurian Assay, taking over an existing codebase. Read `CLAUDE.md` at the repository root first: it carries the standing rules, the roles and the things a build session must never do.
>
> This is a handover task, not a feature. **Change no engine behaviour.** If you find something you would like to fix, write it down rather than fixing it.
>
> **1. Prove the environment.** Run the test suite and report the result. Then run one fixture end to end against the deployed site, `fixtures/30_classification_portfolio.csv`, and show me the classification output. If you cannot do either, stop and tell me exactly what is missing rather than working around it.
>
> **2. Add the fixture integrity test, if story 2.1 did not already.** Record the sha256 of every file in `fixtures/` and every `expected_*.json` in the suite, and fail the build with a clear message if any of them changes. Add a `.gitattributes` entry pinning those files to LF so the hashes are stable across machines. Record the hashes of the files as committed. These two known values should appear in it:
>
> - `30_classification_portfolio.csv` `49c9cd8d3052b6db072eeb1bb80e9b25ad91957135dfdbe9f6dacf27142e75bc`
> - `expected_classification.json` `056a169ea9f25bcfeae675ca9e8afa8eeafdc36d68d043cf89119b5481b9688e`
>
> If either file on disk does not match, do not update the recorded hash. Stop and tell me, because it means a control file was modified somewhere between the specification and the repository.
>
> **3. Prove the test fails.** Change one byte in a fixture, confirm the build fails with a message naming the file, then revert. A guard nobody has seen fail is not a guard. Say in the PR that you did this.
>
> **4. Write down what was missing.** As you work, keep a list in `docs/handover-gaps.md` of everything you needed that was not in the repository: anything you had to guess, anything you had to ask for, anything only discoverable by reading the code. That list is the actual product of this task. An empty list means the handoff is clean; a long list is not a failure, it is the thing we wanted to find.
>
> Open one pull request for items 2 and 3, with the audit and the environment results in the description.

---

## What I need back

The PR description, `docs/handover-gaps.md`, and the classification output from step 1 so I can run it through `verify_2.1_production.py`. That closes the 2.1 verification independently at the same time as proving the new environment, which is two jobs for one run.

---

## Parked until you decide

Three decisions block the 2.2 brief. They can wait until the migration is proved, but not longer:

1. Does a not-usable quality band force a routing refusal?
2. Can a user override a routing decision, and is the override recorded?
3. Do I build fixture 31 for the refusal paths, since no line in fixture 30 carries a not-usable band?

My recommendations are refusal on not usable, no override until sprint 3, and yes to fixture 31. I will write the brief the moment you confirm or change them.
