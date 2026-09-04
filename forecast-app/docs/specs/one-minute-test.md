# The one minute test

Sprint 2 acceptance criterion 16. The last thing standing between the current position and a closed sprint, and the only test in this project neither of us can run for the other.

It takes about ten minutes of someone else's time.

---

## Who

One person who works in supply chain, demand planning or inventory, who has not seen this tool and did not help build it. A planner is better than a director, because a planner is the person who would actually use it.

**Not you.** You designed the fixture and you know where the answer is. That is exactly what the test controls for.

One person is enough to learn something. Two is better. Ten is a research project you do not need yet.

---

## Setup

1. Open https://silurian-forecast-diagnostic.vercel.app/ and upload `31_routing_portfolio.csv`, analysis date 2026-08-01, monthly.
2. Land on the Routing panel.
3. Hand it over.

Say only this: **"This is a demand portfolio. Take a look."**

Nothing else. No explanation of what the tool does, no tour, no mention of lumpy, routing, classification or forecastability. If they ask what something means, say "whatever you think it means" and let them work it out. What they do without help is the result.

---

## The two questions

After about a minute, ask:

1. **Which line would you look at first?**
2. **What would you do about it?**

That is the whole test.

---

## What counts

**Pass.** They name RTG-60301, the lumpy A-volume line, and their answer to the second question is some version of a conversation with the customer: order patterns, lead times, a stocking agreement, minimum order quantities, or accepting the buffer knowingly.

**Fail.** They land on a different line and cannot say why, or they answer the second question with a better forecast, a different model, or more data.

**Also a fail, and the most likely one.** They can see the line is a problem but cannot say what to do next. That means the decision reads but the action does not, which is precisely what story 2.3 was built to fix.

---

## What to write down

Four things, in their words rather than yours:

1. Which line they picked, and how long it took.
2. What they said they would do.
3. Anything they misread, or a word they had to ask about.
4. Anything they went looking for and could not find.

Items 3 and 4 are worth more than the pass or fail. A planner asking "what does caveated mean" or looking for a column that is not there tells us more about the next sprint than a clean pass does.

---

## Two things to resist

**Do not explain the answer afterwards to make the tool look better.** If they got lost, that is the finding.

**Do not defend the design in the room.** Write down the objection and argue with it later, in the backlog.

---

## When it is done

Send me the four notes. I will tell you whether it passes, and either close sprint 2 or write the remediation story it earns.

If it fails, that is not a bad outcome. It is the cheapest failure available: a screen, one person, ten minutes, before a single client has seen it.
