# Client security and procurement question set

Silurian Consulting. Prepared answers for the questions a client's IT, security, data protection and procurement functions ask before they will let a supplier touch demand data.

**How to use this.** Fill in every answer once, from the story 1.5 data map, not from memory. Keep it current as the product changes. Answer from this document during a live engagement rather than improvising, and never answer a question you have not verified.

**Status markers.** Every answer is marked `VERIFIED`, `NEEDS CHECK` or `NOT APPLICABLE YET`. An answer that is not `VERIFIED` does not go to a client.

**The rule that matters.** A short honest answer beats a long reassuring one. Security reviewers are practised at spotting padding, and a supplier who says "we do not do that yet, and here is what we do instead" is trusted more than one who is vague. You will be asked follow-ups. Assume every claim is checkable.

---

## A. Data flow and scope

1. What data do you need from us, at what grain, and why that grain?
2. Do you need SKU descriptions or customer names, or only codes and quantities?
3. Can the engagement run on pseudonymised identifiers, and what is lost if it does?
4. Where does our data physically go, from upload to deletion? Name every system.
5. Which of those systems are yours and which belong to third parties?
6. Does our data leave the UK or EEA at any point?
7. Is any data processed outside your direct control?

## B. Sub-processors

8. List every sub-processor, what each does, and which region it runs in.
9. Is Google a sub-processor for the forecasting step, and under what terms?
10. How are we notified if a sub-processor changes?
11. Do you use any AI or machine learning service that could retain our data or use it for training?
12. Can you evidence that our data is not used to train any model?

## C. Retention and deletion

13. How long is our data held at each point in the flow?
14. What is deleted automatically, what is deleted explicitly, and what evidence do you keep of deletion?
15. Is anything cached, and for how long?
16. What is retained after an engagement ends?
17. Can we request deletion, and how quickly can you confirm it?
18. Is any of our data present in your logs, error reports or monitoring?
19. What happens to our data if a run fails halfway?

## D. Access and security

20. Who at Silurian can access our data, and how is that access controlled?
21. Is data encrypted in transit and at rest, and by what means?
22. How do you authenticate to your own infrastructure?
23. Do you hold ISO 27001, SOC 2 or Cyber Essentials?
24. Do you carry professional indemnity and cyber insurance, and at what level?
25. What is your process if you suspect a breach, and how quickly would we be told?

## E. Outputs and evidence

26. What do we receive at the end of an engagement, and in what format?
27. Does anything you keep afterwards contain our data?
28. If we dispute a figure in six months, can you show what produced it?
29. Who owns the outputs and any derived analysis?
30. Can our data or findings be used in your marketing, anonymised or otherwise?

## F. The tool itself

31. Is this a product we are buying, or a tool you use to deliver a service?
32. Does anyone outside our organisation see our results?
33. What happens if the forecasting model changes between our runs?
34. Can you reproduce a run, and how would you prove it?
35. What are the known limitations of the method, and where is it weak?

## G. Commercial and contractual

36. Are you the controller or the processor for our data?
37. Do you have a data processing agreement we can review?
38. Will you sign our supplier terms, and what would you need changed?
39. What are your payment terms and what happens if the engagement stops early?
40. Who is the named individual accountable for this engagement?

---

## Answers that need a decision rather than a fact

These four cannot be answered by auditing the system. They are commercial or legal positions to settle before the first engagement.

- **Question 30, marketing use.** The honest default is no. A case study needs explicit written permission and a review of the text by the client. Deciding this in advance avoids an awkward conversation when you want a reference.
- **Questions 36 and 37, controller and processor, and the DPA.** Needs qualified review. Do not draft this from a template found online, and do not let an AI draft it either.
- **Question 24, insurance.** Professional indemnity is normally required before a pharma client will contract at all. Worth confirming the level your policy carries against what clients typically ask for.
- **Question 23, certification.** The truthful answer today is that you hold none. Cyber Essentials is the cheapest credible step if procurement keeps stalling on it, and it is worth knowing what it costs before a client asks rather than after.

---

## Answers that are already strong, and worth leading with

Three positions from sprint 1 are unusual for a small supplier, and they answer several questions at once. Lead with them rather than waiting to be asked.

- **The proof carries no client data.** The run manifest records what produced every number using hashes, counts and settings, with no SKU identifiers and no values. It can be kept indefinitely by both sides without holding anything of yours. That answers questions 27, 28 and part of 17 in one move.
- **The evidence belongs to the client.** The run bundle, which does contain your data, is downloaded to you and is not stored by us. That is a stronger answer to question 16 than any retention schedule.
- **The method states its own limits.** Every run records which series were excluded and why, whether the forecast is reproducible, and what has not been measured. That answers question 35 with evidence rather than assurance, and it is the answer most suppliers cannot give.

---

*Version 0.1, draft. No answer in this document has been client-tested. Complete it from the story 1.5 data map before use.*
