# Final task for Codex

Paste this into the Codex chat as its last piece of work. It is a documentation task. **No code changes.**

---

> This is your final task on Silurian Assay. The build is moving to a different environment, and after this the repository is the only thing that survives. Documentation only: do not change engine code, do not refactor, do not tidy anything you have been meaning to tidy. A last day pull request that touches the engine is the worst possible parting gift, because nobody will review it properly.
>
> **1. Audit the repository against this list and tell me what is missing.**
>
> | Item | Where it should live |
> |---|---|
> | Open questions files for stories 1.1 through 2.0, with the answers | `docs/<story>-open-questions.md`, committed |
> | Your reasoning on points where you overrode the specification, for example the manifest hashing rule | The relevant PR description or an ADR |
> | Decisions made in conversation and never written down | `PROJECT_HANDOFF.md` |
> | Uncommitted work in any local or workspace checkout | Committed, or deliberately discarded and said so |
> | Branches never merged and never closed | Merged, or deleted with a note saying why |
> | The drift canary baseline hash and when it was last confirmed | Committed, with the date |
> | Known limitations and anything you flagged as fragile | `PROJECT_HANDOFF.md`, a limitations section |
>
> **2. Fix the authority problem in `PROJECT_HANDOFF.md`.**
>
> The build briefs are no longer authoritative on thresholds. The 1.2, 1.3 and 1.4 briefs understate what production implements, because numbers were settled afterwards in the answers files and in `expected_quality.json`. State the order of authority explicitly:
>
> 1. `expected_findings.json`, `expected_quality.json`, `expected_classification.json` for thresholds and expected behaviour
> 2. `run_manifest.schema.json` and `run_bundle.schema.json` for output shape
> 3. The build briefs for intent and reasoning, but not for numbers
> 4. `CLAUDE.md` for standing rules
>
> Then make sure the handoff also covers, in plain terms: what each API route does and returns, which fixtures exist and what each one is for, how to run the suite, how to run one fixture end to end against the deployed site, what the drift canary is and how to tell when it has tripped, and the current schema versions.
>
> **3. Record the infrastructure inventory, names and locations only. No secret values, no tokens, no keys, no environment variable values.** Vercel project, production domain, which branch deploys to production, and which environment variables exist in which environments. Google Cloud project id, BigQuery dataset and region, and which service account the app authenticates as. Repository, default branch, branch protection, and whether CI runs the suite on a pull request.
>
> **4. Answer this in the chat rather than in a file: what do you know about this project that is not in the repository?** Anything you learned by trial and error, anything that is fragile in a way the code does not show, anything you would tell the next developer in person.
>
> Open one pull request for items 1 to 3 and put the audit result in its description.

---

## Two things to watch when the answer comes back

**Item 4 is the one worth reading carefully, and it is also the one most likely to contain reconstruction rather than recall.** Anything surprising in it should be checked against the repository before it goes into the handoff as fact.

**The definitive test is not this checklist.** It is the first cold start: a new session reads `CLAUDE.md` and the 2.1 brief and builds. Anything it has to ask you that is not a product decision is a hole in the handoff, and that will surface within an hour of starting rather than after an audit.
