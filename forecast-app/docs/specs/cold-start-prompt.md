# Cold start prompt

Precondition: merge PR 43 first, so the audit documentation is on `main` before the new session reads the repository.

Paste everything below into the new Claude Code chat, with the repository available.

---

You are the developer on Silurian Assay, taking over an existing codebase from a previous build environment that has now been closed. Read `CLAUDE.md` at the repository root before anything else: it carries the standing rules, the roles, and the things a build session must never do.

This is a handover task, not a feature. **Change no engine behaviour.** If you find something you would like to fix, write it down rather than fixing it.

**1. Prove the environment.**

Run the test suite and report the result. Then run one fixture end to end against the deployed site, `fixtures/30_classification_portfolio.csv`, and give me the classification output: the per SKU table, the class counts, the ABC counts and the portfolio band. If you cannot do either, stop and tell me exactly what is missing rather than working around it.

**2. Add the fixture integrity test, if story 2.1 did not already.**

Record the sha256 of every file in `fixtures/` and every `expected_*.json` in the suite, and fail the build with a clear message if any of them changes. Add a `.gitattributes` entry pinning those files to LF so the hashes are stable across machines. Record the hashes of the files as committed. These two known values must appear:

- `30_classification_portfolio.csv` `49c9cd8d3052b6db072eeb1bb80e9b25ad91957135dfdbe9f6dacf27142e75bc`
- `expected_classification.json` `056a169ea9f25bcfeae675ca9e8afa8eeafdc36d68d043cf89119b5481b9688e`

If either file on disk does not match, **do not update the recorded hash**. Stop and tell me, because it means a control file was modified somewhere between the specification and the repository.

**3. Prove the guard fails.**

Change one byte in a fixture, confirm the build fails with a message naming the file, then revert. A guard nobody has seen fail is not a guard. Say in the pull request that you did this.

**4. Confirm two defects cannot return.**

Two defects were found during story 2.1 testing and fixed, but only concise records survive: a JSON parsing error, and a contradiction in how bundle integrity was displayed. For each one, find whether a regression test exists that fails if the defect comes back. If a test exists, name it. If it does not, write one. The second defect matters most: it is the same family as the story 1.6 problem, where two parts of the system said different things about one fact on one screen, and that class of defect is what the cross-stage consistency tests exist to catch.

**5. Record one known gap.**

Add to the limitations section of `PROJECT_HANDOFF.md`: the provider backup assurance for the client security questions is unanswered and is owned by the product owner, not by a build session. No work beyond recording it.

**6. Write down what was missing.**

As you work, keep a list in `docs/handover-gaps.md` of everything you needed that was not in the repository: anything you had to guess, anything you had to ask for, anything discoverable only by reading the code. **That list is the actual product of this task.** An empty list means the handover is clean. A long list is not a failure, it is the thing we are trying to find.

Open one pull request for items 2 to 5, with the audit result and the environment results in the description.
