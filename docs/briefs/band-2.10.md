# Band 2.10: Second Toughest

Four stories. All of them are re-takes of work that passed its test and failed its purpose.

Band 2.7 stays accepted. These are not a reopening of it. The second planner run on 6 September accepted the band and then produced the same confusions the band existed to remove, which means three acceptance criteria were written to measure the artefact rather than the reader.

**The criteria below are the ones already written. They do not get softened to fit what was built.**

---

## 2.10.1 The drawer, properly this time

**What happened.** Story 2.7.3's acceptance was: a first-time user opens a detail drawer within a minute without being told it exists. Two planners have now failed it. The second asked, in as many words, to see the demand history behind RTG-60403 and did not find it.

**What this rules out.** The cheapest change, an affordance on the row, has been tried and did not work. Do not try a third variation of it.

**Two shapes are acceptable.** Either the row opens on click with nothing else required of the user, or the history comes to the row and there is no drawer to find. Pick one and say why in the pull request.

**Acceptance.** Unchanged from 2.7.3, word for word. A first-time user opens the detail for a named product within a minute, without being told the feature exists.

---

## 2.10.2 Terms explain themselves where they are

**What happened.** Seven terms were still unclear to the second planner:

- ACCEPT appearing beside NOT USABLE DATA
- model eligible, wide interval
- ADI
- CV squared
- Croston family
- policy only
- volume share

**Why the glossary did not help.** The glossary from 2.7.5 exists and passes its test. That test proved coverage, not comprehension. A reference a planner does not open is not an explanation. The criterion was written badly and this story replaces it.

**What is wanted.** Each of the seven explains itself at the point it appears. Not a link, not a page the reader has to leave for. Plain words a planner would use.

**Acceptance.** A first-time planner reads each of the seven in place and can say what it means in their own words, without opening anything else.

---

## 2.10.3 Say what "not usable" applies to

**What happened.** Story 2.7.1 was accepted on the count and failed on scope. The planner said they could not tell whether "not usable" applied to the whole file or only to the problem lines.

**Why the readiness sentence did not cover it.** That sentence answers how much is ready. It does not say what the band label is about.

**Acceptance.** A first-time reader can say, unprompted, whether the label describes the file or the lines.

---

## 2.10.4 One list, two sections

**This is a product owner decision made on 6 September, not a defect.** Two planners reached it independently.

All seven lines appear on one list, grouped under two headings:

- **Waiting on an answer from you**
- **Need a commercial decision rather than a forecast**

**Why the distinction stays.** It is real. A data answer can move a refused line to forecastable. No commercial decision ever moves a policy only line, because no method will predict it.

**Every total belongs to a heading. No combined figure.** A combined total answers a question nobody asked, and it would sit on the same screen as the readiness sentence saying something different. That is story 2.7.9 coming back.

---

## 2.10.5 Advice Assay can stand behind

**Added by the product owner on 9 September 2026, reviewing the preview of 2.10.2.** The in-place glosses are good. The "Do this" advice is not, and the reason is structural rather than four bad sentences.

**The rule.** Assay reports what the data shows. Where it tells a planner to act, it may only tell them to look at something or ask someone. It may never tell them to change a number, because it does not know their lead time, service target or costs. Anything that fails this test comes out.

**Four specific failures, in the product owner's words:**

- "6 periods are robust outlier candidates" is analyst language. He would understand "Six months have unusual demand and need checking".
- "Forecast the range rather than the number" leaves him without a number, and he still needs one for the supply plan. The range is for assessing stock risk around that number, not a replacement for it.
- "Size the buffer from the spread" skips lead time and service target, neither of which Assay has.
- "Chasing the average here adds work and no accuracy" is a claim about the accuracy of a forecast Assay has not run. It cannot be supported.

**His replacement for the "Do this" block, which passes the rule:**

> Check the six flagged months with the account owner before changing the forecast. Use the forecast range to review whether your stock buffer is adequate for your lead time and service target.

**Scope.** Sweep every other "Do this" and advice string in the app against the rule, not only the ones listed. Report how many were found and how many were changed.

**What works and must not be lost:** "How much order sizes vary when demand does arrive", "A promotion, tender, stock build or data error may have changed the observed demand", and the So what line "Demand is frequent but order size varies materially". The ADI gloss is a definition but a useful one, leave it.

---

## Standing rules for this band

- **Every story records its own evidence.** CLAUDE.md section 6. Do not carry evidence across from 2.7.
- **Plain language rule applies to every word that reaches a user.** CLAUDE.md section 8. If a planner would not say it to another planner in the corridor, cut it.
- **"Nine box" remains a banned string** in production code and user-facing copy. It is the portfolio classification matrix.
- **Fixture integrity holds.** If a fixture or expectations file needs to change, say so before changing it.

## Acceptance for the band

A third planner, on the same protocol as the first two, against the criteria written above. Not a walkthrough, not a demo, and not a review by anyone who has seen the screens before.
