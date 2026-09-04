# Closing Codex down cleanly

Run this before the Codex chat is closed, not after. The failure mode is not the repository. It is the decisions that only ever existed in that conversation.

---

## 1. Do not send me connection details

I should not hold credentials, and this is worth being blunt about.

Do not paste, upload or route through me: Google Cloud service account keys or JSON key files, BigQuery credentials, Vercel tokens, GitHub tokens or SSH keys, environment variable **values**, or any `.env` file.

What I need is the **inventory**, not the values. Names, locations and owners: which environment variables exist, which project and dataset the BigQuery calls run against, which Vercel project and which environments have which variables set. That is enough for me to tell you whether the handoff is complete, and none of it is a secret.

The session that needs real access is the **build session**, and it gets that from your machine and your already authenticated CLIs. Not from anything typed into a chat.

If any credential has ever been pasted into the Codex chat, treat it as exposed and rotate it as part of the shutdown. That is the one item on this list with a deadline.

---

## 2. What dies with the Codex chat unless you extract it first

Everything below has existed only in that conversation at some point. Check each against the repository.

| Item | Where it should live |
|---|---|
| Open questions files for every story, 1.1 through 2.0, with the answers | `docs/<story>-open-questions.md`, committed |
| Codex's own reasoning on contested points, for example the manifest hashing rule that overrode mine | The relevant PR description or an ADR |
| Any decision made in chat and never written down | `PROJECT_HANDOFF.md` |
| Uncommitted work on the local machine or in a Codex workspace | Committed or deliberately discarded |
| Branches that were never merged and never closed | Merged, or deleted with a note saying why |
| The drift canary baseline hash and when it was last confirmed | Committed, with the date |
| Anything Codex flagged as a known limitation | `PROJECT_HANDOFF.md`, a limitations section |

The one I would check first is the open questions files. Those carry the reasoning behind settled decisions, and a decision without its reasoning gets silently reversed by the next person who finds it inconvenient.

---

## 3. What `PROJECT_HANDOFF.md` must say, and currently does not

I flagged this before 2.0 and it was never actioned, so it goes here.

**The briefs are no longer authoritative on thresholds.** The 1.2, 1.3 and 1.4 briefs understate what production actually implements, because thresholds were settled in the answers files and in `expected_quality.json` after those briefs were written. A new session reading the briefs alone will build to stale numbers.

`PROJECT_HANDOFF.md` must state the order of authority explicitly:

1. `expected_quality.json`, `expected_classification.json` and `expected_findings.json` for thresholds and expected behaviour.
2. `run_manifest.schema.json` and `run_bundle.schema.json` for output shape.
3. The build briefs for intent and reasoning, but not for numbers.
4. `CLAUDE.md` for standing rules.

It also needs, in plain terms: what each API route does and what it returns, which fixtures exist and what each one is for, how to run the suite, how to run one fixture end to end against the deployed site, what the drift canary is and how to tell when it has tripped, and the current schema versions.

---

## 4. Infrastructure inventory, values omitted

Confirm each of these is written down somewhere a cold session can find it. Names and locations only.

- **Vercel**: project name, production domain, which branch deploys to production, which environment variables are set in which environments, and who owns the account.
- **Google Cloud**: project id, BigQuery dataset and region, `europe-west2`, and which service account the app authenticates as.
- **Model**: managed TimesFM 2.5 through `AI.FORECAST`, context window pinned to 512, confidence level 0.9. Written down as configuration rather than as folklore, because a managed model can change behind an unchanged version string.
- **GitHub**: repository, default branch, branch protection, and whether CI runs the suite on a PR.

If any of these lives only in your head or only in the Vercel dashboard, it is not in the handoff.

---

## 5. What I hold, so you can check the repository has it

Forty two files, about 470KB, all of which I can re-deliver at any time. This is a backup, not the source of truth. The repository should carry all of it.

**Fixtures**: thirteen validation fixtures `00` to `12`, three quality fixtures `20` to `22`, the classification fixture `30`.

**Expectations**: `expected_findings.json` v1.2, `expected_quality.json` v1.2, `expected_classification.json` v1.2.

**Schemas and goldens**: `run_manifest.schema.json`, `run_bundle.schema.json`, `run_manifest.golden.json`, `run_manifest.golden.rejected.json`, `run_bundle.golden.json`. Note that my manifest schema copy is at 1.1 while production advanced it to 1.3, so the repository's copy is the real one and mine is out of date. Worth reconciling as part of the migration rather than after it.

**Briefs and answers**: 1.1 through 1.6, 2.0, 2.1, plus `1.1-answers.md`, `1.2-answers.md`, `1.3-amendments.md`, `1.5-map-review.md`.

**Other**: `MANIFEST.md` describing the fixture set, `client-security-questions.md` with the forty questions a client's IT function will ask, `CLAUDE.md`, `2.1-kickoff.md`, and the workspace mock.

---

## 6. The last thing to do before closing the chat

Ask Codex directly: **what do you know about this project that is not in the repository?**

It is a fair question, it costs one message, and it is the only way to surface the things neither of us thought to ask about. Send me the answer and I will tell you what needs writing down.
