# Planner test, findings

Sprint 2 acceptance criterion 16, run 2 September 2026 with one supply chain planner who did not build the tool and was given no explanation.

---

## Verdict

**Criterion 16 passes on substance. The criterion as I wrote it was wrong, and the tool was right.**

Sprint 2 closes.

---

## 1. What actually happened

**First line chosen: RTG-60403**, not RTG-60301 as my criterion predicted. Their reasoning: 12.85 percent of volume, discontinued after 14 periods, and a wrong discontinued call would distort both the forecast and the inventory position.

That is correct, and my criterion was not. RTG-60403 is rank two by volume, RTG-60301 is rank six. **The open items list is ranked by volume, so the screen put RTG-60403 at the top and the planner went there.** The tool did exactly what it was designed to do. I then wrote an acceptance criterion naming a smaller line further down the same list. The screen and the criterion disagreed, and the screen was right.

**Their action on RTG-60403** was to confirm status with the commercial or product owner, then take one of three routes: confirmed discontinued and run down the stock, temporarily inactive and manage by event, or incomplete history and rerun. Those are `DISCONTINUED_CONFIRMED`, `STILL_ACTIVE_DEMAND_GAP` and `STILL_ACTIVE_DATA_MISSING`, reproduced independently by someone who had never seen the vocabulary. They also refused to forecast until status was confirmed, unprompted.

**On RTG-60301, asked separately**, they said: do not use a conventional monthly point forecast, manage through known orders, commercial intelligence and an agreed inventory policy, check whether demand ties to specific customers, campaigns or tenders, and review lead time, MOQ and service requirement.

That is the customer conversation answer. **The lumpy insight lands.**

---

## 2. What this validates

- The volume ranking on the open items list directs attention correctly, with no explanation given.
- The resolution vocabulary matches how a planner actually thinks. They generated three of the five discontinued options from scratch.
- The refusal principle is understood and endorsed. They would not forecast a line whose status is unconfirmed, which is the behaviour the whole refusal design exists to support.
- They described the product accurately without being told: "a forecast-readiness and exception-management tool, rather than a forecasting tool alone." That is a better one-line description than anything in our own documents, and it should go on the marketing site.

---

## 3. Defects found, ranked

**1. `accept` and `not usable` appear together with no explanation.** They could not tell whether the portfolio had been accepted, rejected or partly accepted. This is the story 1.6 defect class in a new form: two stages stating verdicts side by side with nothing saying how they relate. Validation accepted the file; quality banded the portfolio not usable. Both are correct and the screen never reconciles them.

**2. Two of the seven action texts failed, and they are the two that matter most.** On `model_eligible_wide_interval` they understood the uncertainty and not what to do differently. On `policy_only` they inferred the meaning and could not see the next action. I wrote in the 2.3 brief that those two rows carry the most weight because they say the uncomfortable thing. Both failed to land.

**3. The detail drawer was not discovered.** They asked for "a way to open a SKU-level detail view" showing history, findings and resolution options together. That drawer exists and has since story 2.1. Either it is not discoverable or nothing invited the click.

**4. `caveated` against `not usable` is not operationally clear.** They understood neither the difference nor what each requires of them.

**5. The open items membership rule is invisible.** They understood five lines needed attention but not why those five and not the other ineligible lines. This is the refusal against not-eligible distinction that I got wrong myself in the 2.3 brief. If I got it wrong, a planner will.

**6. Provenance is too prominent and too technical.** The name hash and run identifier "did not help me make a planning decision." Reproducibility matters to a consultant defending a run, not to a planner working it.

**7. The routing summary paragraph is too dense.** They said they would skip it.

---

## 4. What they went looking for and could not find

Not defects. Backlog, and it maps cleanly onto sprints already planned.

| Wanted | Where it belongs |
|---|---|
| A clear recommended action per line | Remediation, defect 2 above |
| SKU context: description, customer, market, unit of measure, lifecycle | New, sprint 3 or 4 |
| Inventory and supply exposure: stock, inbound, safety stock, excess or shortage | Sprint 6, the inventory policy engine |
| Financial impact and working capital at risk | Sprint 4, error into money |
| Owner and due date on each open item | Sprint 5, exception list with owner and action |
| A plain portfolio readiness statement | Remediation, related to defect 1 |

**Their closing line on RTG-60301 is the strategic finding of the whole exercise:** "The screen tells me not to trust a statistical forecast, but it does not provide enough inventory or supply information to choose the actual stock policy."

The tool correctly refuses, then points at an action the planner cannot take with what is on the screen. That is not a flaw in sprint 2. It is the argument for sprints 4 and 6 existing, stated by a planner rather than by us.

---

## 5. The boss questions

Asked what their manager would say, they produced ten questions. Business impact, which SKUs need a decision today, service or stock exposure, inventory value at risk, why 34.43 percent is not eligible, whether the planning cycle can complete without those lines, who owns each open item, what changed since the last run, what decision is needed, and how confident we are that the discontinued line is genuinely discontinued.

Two of those are not yet anywhere in the backlog:

- **What changed since the last run.** Run-to-run comparison. A planner runs this monthly and the delta is the story.
- **Can we complete the planning cycle with those lines excluded.** A go or no-go statement on the portfolio, not just per line.

They also said they would not put the screen in front of their manager without summarising it first. That is story 5.2, the auto-drafted executive summary, validated before it is built.

---

## 6. What I got wrong

Third time today, and worth recording as a pattern rather than an incident.

I wrote an acceptance criterion that contradicted the screen I had specified. I built an open items list ranked by volume, put a 12.85 percent line at its head, then wrote down that the right answer was an 8.28 percent line further down. Nobody would have caught that except a stranger, because both of us knew which line was the interesting one.

The same shape as asserting the fixture was quality-clean without running the engine, and as summing rounded shares to get 65.58. Each time the correction came from someone who could actually check.

**Criterion 16 should have read:** the planner names a line in the top three of the open items list and gives an action that matches its decision. That is what the tool actually promises.
