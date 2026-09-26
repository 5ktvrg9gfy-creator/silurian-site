# Planner test, findings, run 3

Band 2.10 acceptance, run 26 September 2026 with one supply chain planner who had not seen the screens. Fixture 31, analysis date 2026-08-01, monthly. Protocol `docs/planner-test-pack.md`, the same as the first two runs.

---

## Verdict

**Three of the four criteria pass, and the fourth was found unaided but not timed. Band 2.10 is not accepted.**

The test found new items, which is the bar the band set for itself: if the test finds a twelfth item, the band is not finished. All three are now fixed: one in pull request 140, two in pull request 142.

---

## 1. Scorecard

| Criterion | Result | What happened |
|---|---|---|
| Core | **Pass** | Picked `RTG-60403`, top of the open items list at 12.85 percent of volume, in about a minute. |
| 2.10.1 | **Found unaided, not timed** | Opened the demand history unaided from the Routing table. Time not recorded. |
| 2.10.2 | **Pass** | All seven terms explained in their own words without opening anything else. |
| 2.10.3 | **Pass** | Said unprompted what the label describes. |

**Core.** Their action on `RTG-60403`: confirm with the product owner whether it is discontinued, superseded or still active; check orders, shipments, stock and inbound; if active, correct history and rerun; if discontinued, review stock and stop replenishment.

**2.10.1 is recorded as "found unaided, not timed", not as a pass against the one-minute criterion.** The criterion has a clock in it and nobody ran the clock. Finding it unaided is half the criterion; the other half was not measured, so it is not claimed.

**2.10.2.** They were pointed to each term in step 5. They did not ask about them first. So the terms explained themselves in place when a reader looked at them, which is what the story promised, but this run does not show whether a reader would have stopped on them unprompted.

**2.10.3.** Unprompted: "the file was accepted and processed; the portfolio was judged not usable for forecasting as a whole". They also noted that `ACCEPT` beside `PORTFOLIO: NOT USABLE` was initially easy to misread. The label worked; the first glance still stumbles.

---

## 2. New items found

Band 2.10 is therefore not accepted.

**1. "Do this" as a heading.** The planner asked what it meant. **Fixed in pull request 142**, merge commit `a082997`: renamed "Next step" in all 4 places it appears.

**2. The two open items headings.** "Waiting on an answer from you" and "Need a commercial decision rather than a forecast": the planner asked for the difference. **Fixed in pull request 142**, merge commit `a082997`: renamed "Answer these and they can be forecast" and "No forecast will work: these need a commercial arrangement".

**3. Wide interval contradiction on `RTG-60101`.** The erratic reason said "the interval is the useful output and the point number is not", against the glossary and the 9 September ruling. **Fixed in pull request 140**, merge commit `07f8426`. The reason now reads "so the forecast is still a number to plan from, but it could move a long way either side."

---

## 3. What they went looking for and could not find

Not defects. Backlog.

| Wanted | Note |
|---|---|
| A table of the exact monthly quantities behind the demand history chart | Backlog |
| Why demand stopped on `RTG-60403` | Out of scope. The tool's answer, ask the product owner, is correct |

---

## 4. Observed by the product owner on the Preview, not yet actioned

Seen while checking pull request 140, not by the planner.

- **The glossary line and the erratic reason now make the same point back to back.** Padding.
- **CV squared shows 1.00 in the metric box and 0.998 in the reason.** Same figure, two roundings. The metric box formats it to two decimal places and the reason to three.
