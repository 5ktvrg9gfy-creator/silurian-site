# Fixture 31, routing portfolio

Silurian Assay, story 2.2. Revision 1.1. **One file, and a request for one run before I write the expectations.**

`31_routing_portfolio.csv`, 14 SKUs, 390 rows, 35 monthly periods from 2023-09 to 2026-07, as_of 2026-08-01.
sha256 `2c55f4f7c30e6f708c7389a2df3850a8fb7947b1187f19c95531b4aaca9601f6`.

**This replaces the file issued earlier today.** The first version had two lines whose trailing gaps came out of the random draw rather than by design, and under the new discontinuation rule both would have done the wrong job. Hash `3962955d...` is void and must not be committed.

---

## Why there is no expectations file yet

A routing decision depends on two inputs: the demand class, which I can compute exactly, and the quality band, which only the engine can tell me.

I got that wrong on fixture 30. I asserted quality behaviour I had not run and it cost a revision. So the order this time is:

1. You have this fixture, and it is final. The hash above is the file.
2. The build session runs it through validation, quality and classification, and reports what comes back.
3. I write `expected_routing.json` from the observed bands and the approved table, exact rather than predicted.
4. Then the 2.2 brief.

Step 2 is one run and no code. The instruction to paste is at the foot of this note.

---

## What is in the file

Classification metrics are exact, computed from the data. Trailing is periods since the last period with demand, which is what discontinuation is measured on.

| SKU | Rank | Present | Span | Non-zero | Coverage | Trailing | CV² | Class | ABC | Volume |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|---:|
| RTG-60001 | 1 | 35 | 35 | 35 | 100% | 0 | 0.0073 | smooth | A | 26.74% |
| RTG-60403 | 2 | 21 | 21 | 21 | 100% | 14 | 0.0032 | smooth | A | 12.85% |
| RTG-60101 | 3 | 35 | 35 | 35 | 100% | 0 | 0.9976 | erratic | A | 11.84% |
| RTG-60002 | 4 | 35 | 35 | 35 | 100% | 0 | 0.0044 | smooth | A | 10.45% |
| RTG-60601 | 5 | 35 | 35 | 35 | 100% | 0 | 0.0879 | smooth | A | 9.20% |
| RTG-60301 | 6 | 35 | 35 | 12 | 100% | 0 | 1.1715 | lumpy | A | 8.28% |
| RTG-60401 | 7 | 5 | 5 | 5 | 100% | 0 | 0.0035 | smooth | B | 6.59% |
| RTG-60201 | 8 | 35 | 35 | 12 | 100% | 1 | 0.0021 | intermittent | B | 5.61% |
| RTG-60402 | 9 | 12 | 31 | 12 | 38.7% | 1 | 0.0032 | smooth | C | 4.34% |
| RTG-60502 | 10 | 2 | 2 | 2 | 100% | 1 | null | unclassifiable | C | 1.40% |
| RTG-60702 | 11 | 35 | 35 | 35 | 100% | 0 | 0.0068 | smooth | C | 1.16% |
| RTG-60701 | 12 | 35 | 35 | 12 | 100% | 1 | 0.6454 | lumpy | C | 0.76% |
| RTG-60602 | 13 | 35 | 35 | 9 | 100% | 4 | 0.0493 | intermittent | C | 0.58% |
| RTG-60501 | 14 | 35 | 35 | 2 | 100% | 1 | null | unclassifiable | C | 0.20% |

Class counts: 7 smooth, 1 erratic, 2 intermittent, 2 lumpy, 2 unclassifiable.

---

## What each line is for

**The discontinued exception, now its own decision.**

- **RTG-60403.** Twenty one clean periods, then no demand for fourteen, 12.85 percent of volume and rank two. Data is fine, demand is gone. Expect `discontinued_confirm_status`. This is the line that made the exception necessary.

**The material refusals, which are why this fixture exists at all.**

- **RTG-60401**, a recent launch. Five periods of strong demand and nothing before, 6.59 percent of volume. Span is below the six period not-usable threshold. Fixture 30's only refusal was 0.49 percent, which proves the mechanism and nothing else. This one you would have to defend to the person whose product it is.
- **RTG-60402**, sparse coverage. Twelve periods present across a thirty one period span, coverage 38.7 percent against a 50 percent threshold, and it transacted last month. Tests that refusal follows coverage rather than age.
- **RTG-60502**, the precedence case, 1.40 percent. Two recent periods, so unclassifiable on evidence and expected not usable on span at once. Not discontinued, so the answer is `refused_data_quality`.

**The boundaries.**

- **RTG-60501**, two non-zero observations across a full span, the most recent one period back. Neither stale nor discontinued, and the data is clean, so it must return `insufficient_evidence`. It is the pair to RTG-60502 and together they prove the precedence rule rather than assuming it.
- **RTG-60602**, four trailing periods. Stale but inside the six period discontinuation threshold, so the decision stays `intermittent_methods` and the staleness is a caveat. One period further and it would flip, which is the point.
- **RTG-60601**, smooth with two spikes sized to raise outlier candidates while leaving CV squared at 0.088. A caveated band must leave the decision at `model_eligible`.

**The rest of the table.**

- **RTG-60101**, erratic and material at 11.84 percent, A class. The line that decides whether `model_eligible_wide_interval` earns its separate existence.
- **RTG-60301** at 8.28 percent and **RTG-60701** at 0.76 percent, both lumpy, both to `policy_only`. RTG-60301 has a guaranteed order in the final period so it stays live rather than drifting into the discontinued rule.
- **RTG-60201** and **RTG-60602**, intermittent, to `intermittent_methods`.
- **RTG-60001**, **RTG-60002**, **RTG-60702** and **RTG-60601**, the smooth backbone at 47.55 percent.

If the predicted bands hold, **65.58 percent of volume is forecast eligible and 34.42 percent is not**, split across four different reasons. A third of a portfolio that no forecasting method will help, with the lines named and the reason given for each.

---

## Instruction to paste into the build session

> One run, no code changes, no pull request.
>
> Add `fixtures/31_routing_portfolio.csv` to the repository, sha256 `2c55f4f7c30e6f708c7389a2df3850a8fb7947b1187f19c95531b4aaca9601f6`, and add it to the fixture integrity test with that hash. Do not modify the file. If the hash does not match after committing, stop and say so rather than re-recording it. If you were given an earlier version of this fixture with a different hash, discard it: it is superseded.
>
> Then run it through validation, quality and classification at analysis date 2026-08-01 and report back:
>
> 1. The validation verdict and any findings.
> 2. The portfolio quality band.
> 3. For every one of the 14 SKUs: the quality band and every quality finding code raised against it.
> 4. The classification output per SKU: demand class, ADI, CV squared, ABC volume class.
>
> Raw JSON is preferable to a table if that is easy. No routing work yet: story 2.2 is not briefed, and the expectations file is written from this run.
