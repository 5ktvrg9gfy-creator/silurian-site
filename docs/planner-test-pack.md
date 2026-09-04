# Planner test pack

Sprint 2, acceptance criterion 16. Everything needed to run it: who to ask, what we are trying to learn, what to say, and what to write down.

Read sections 1 to 3 yourself. Section 6 is the only part the participant sees, and it is deliberately thin.

---

## 1. What we are trying to achieve

**The question.** Can a supply chain professional who has never seen this tool, and who is given no explanation, find the single most important finding in a portfolio and say what they would do about it?

That is the whole test. Everything else in sprint 2 has been verified by tests we wrote for ourselves, by expectations I wrote, and by you checking production against numbers I supplied. All three of those share one blind spot: none of us is a stranger to the tool.

**Why it matters commercially.** The product's claim is that it tells a client which lines a forecast will never fix, and what to do instead. If a planner cannot reach that conclusion from the screen without a consultant standing next to them, then the finding lives in the consultant rather than in the tool, and what you would be selling is your time rather than a product.

**What we are testing.**

- Whether attention lands on the right line.
- Whether the action is understood, specifically that a lumpy A-volume line needs a customer conversation rather than a better model.
- Which words fail. Anything they have to ask about is a copy defect.
- What they look for and cannot find. That is sprint 3 and 4 backlog, gathered free.

**What we are not testing.** The visual design, which is deliberately unfinished until story 5.1. The numbers, which are already verified. Whether they like it, which is not a measurable thing and not the point.

---

## 2. The profile

**Role.** A demand planner, supply planner, S&OP analyst or inventory analyst. Someone who touches a forecast or a stock policy in their actual week.

**Experience.** Roughly two to ten years. Long enough to have opinions, not so long that they have stopped looking at screens properly.

**They must:**

- work with demand data at SKU or item level
- recognise safety stock, lead time, minimum order quantity and service level without being told what they mean
- have never seen this tool or heard the pitch

**Sector.** Pharma or a CDMO is closest to the client you are aiming at. Any manufacturer or distributor with SKU-level demand is fine, and arguably a better test, because if the screen only works for someone who already thinks in pharma packaging terms it is not a product.

**Who to avoid, and why.**

- **Data scientists and analysts.** They will evaluate the maths, which is not what is being tested, and they will forgive a bad screen because they can read past it.
- **Consultants.** They will evaluate the artefact as a deliverable and tell you how to sell it. Also not the test.
- **Senior directors.** They will be polite. You want someone who says "I have no idea what that means" without worrying about your feelings.
- **Anyone who has heard you talk about Silurian.** They already know the answer you want.

**How many.** One is enough to learn something real. Two or three, run separately, is better and turns one person's quirk into a pattern. Do not build a research programme. You need a signal, not a sample.

---

## 3. One thing to be careful about

Your own network is the right source: former colleagues, planners from previous roles, industry contacts, LinkedIn connections, someone from a professional body. If you are currently employed anywhere, keep this off their time and off their equipment. Testing your own commercial product using an employer's staff and hours is easy to explain in advance and very hard to explain afterwards.

**The data is genuinely synthetic.** `31_routing_portfolio.csv` is a portfolio I generated. It contains no client data and nothing confidential from any employer, past or present. That is worth saying when you ask, because it removes the main reason a planner would hesitate.

One more line to hold. **This is a test, not a pitch.** If it turns into a demonstration you have lost the result, because you cannot un-explain something. Sell to them another day if they are interested. Today they are the instrument.

---

## 4. Setup, before they arrive

1. Open https://assay.silurianconsulting.co.uk in a clean browser tab. The older
   https://silurian-forecast-diagnostic.vercel.app/ address still works and reaches the same application.
2. The tool is behind a password. Enter it yourself before the planner arrives, so they never see the gate.
   One entry lasts twelve hours. If you are handing them the tab on their own machine, they will need the
   password from you.
3. Upload `31_routing_portfolio.csv`, which is in your Google Drive.
4. Analysis date **2026-08-01**, frequency **monthly**.
5. Let it finish, then land on the **Routing** panel.
6. Have a notebook. Do not sit where you can point at the screen.

Ten minutes of their time. Fifteen if they talk.

---

## 5. Running it

**Hand it over and say only this:**

> "This is a demand portfolio for a manufacturer. Have a look."

Then stop talking. Say nothing about forecasting, classification, routing, lumpy demand or what the tool is for. If they ask what something means, say **"whatever you think it means"** and let them work it out. Their confusion is data.

**After about a minute, ask the two questions:**

1. **Which line would you look at first?**
2. **What would you do about it?**

Write the answers down before you say anything else. That is the result, and everything after it is bonus.

**Then, and only then, the follow-ups:**

3. What do you think this tool is for?
4. Was there anything on the screen you did not understand?
5. Was there anything you went looking for and could not find?
6. Would you put this in front of your boss? What would they ask you?
7. There is a list of open items. What would you do with it?

**Two things to resist.**

Do not explain the answer afterwards to make the tool look better. If they got lost, that is the finding, and it is worth more than a compliment.

Do not defend the design in the room. Write the objection down and argue with it in the backlog, where it costs nothing.

---

## 6. What to send them beforehand

Copy this into an email or a message. It gives them enough to say yes and not enough to prepare, which is the point.

> Can I borrow ten minutes of your brain?
>
> I have built a demand forecasting diagnostic tool as part of a consultancy I am setting up. Before I put it in front of anyone who might pay for it, I want someone who actually plans for a living to look at a screen and tell me whether it makes sense.
>
> There is nothing to prepare and no right answer. I will show you a screen, ask you two questions, and write down what you say. It is a synthetic portfolio I generated myself, so there is no client data and nothing confidential involved.
>
> Ten minutes, whenever suits. It would genuinely help.

---

## 7. What to write down

In their words, not yours.

| | |
|---|---|
| Which line they picked | |
| How long it took | |
| What they said they would do about it | |
| Words they had to ask about | |
| Things they looked for and could not find | |
| What they thought the tool was for | |
| Anything they said that surprised you | |

Verbatim beats paraphrase. "I don't know what caveated means" is worth more than "some terminology confusion".

---

## 8. How it is scored

**Pass.** They land on RTG-60301, the lumpy A-volume line, and their answer to the second question is some form of customer conversation: order patterns, lead times, a stocking agreement, minimum order quantities, or knowingly carrying the buffer.

**Fail.** They pick a different line and cannot say why, or they answer the second question with a better forecast, a different model, or more data.

**Also a fail, and the likeliest one.** They can see the line is a problem but cannot say what to do next. That means the decision reads and the action does not, which is exactly what story 2.3 was built to prevent.

**A failure here is the cheapest one available.** One screen, one person, ten minutes, before a client has ever seen it. If it fails I will write the remediation story it earns, the same way story 1.6 came out of running the fixtures through production.

---

## 9. When you are done

Send me the table from section 7 and I will either close sprint 2 or write what comes next.

Items 4 and 5, the words they stumbled on and the things they could not find, are worth more to sprint 3 than the pass or fail itself.
