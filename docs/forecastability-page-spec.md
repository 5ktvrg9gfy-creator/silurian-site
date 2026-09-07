# Forecastability page: build spec

Reference implementation: `Forecast Flow.dc.html`. Live page it links to: `forecast-risk.html`.

Design system: Modernist. Every colour, font and spacing value comes from `styles.css` tokens except the two exceptions listed under Colour.

---

## Global

| Property | Value |
| --- | --- |
| Wrapper | `max-width: 1200px; margin: 0 auto` |
| Wrapper padding | `72px 48px 96px` |
| Background | `var(--color-bg)` |
| Body font | `var(--font-body)` |
| Heading font | `var(--font-heading)`, weight `var(--font-heading-weight)` |
| Ink | `var(--color-text)` |
| Corner radius | 0 everywhere, no exceptions |
| Alignment | Flush left throughout, including inside buttons |

### Type scale

Seven steps only: **12 / 15 / 19 / 25 / 31 / 40 / 56**. No raw size outside this set.

- 56 (poster): used once, the `92.5%` numeral
- 40: page headline, once
- 31: closing statement in the orange field
- 25: section headings, the intro lead, the two pull-out lines
- 19: body copy, node titles, links
- 15: node detail copy, legends, small captions
- 12: uppercase kickers (`letter-spacing: 0.12em`, `font-weight: 600`), source caption

### Spacing

The token scale defines **`--space-1, -2, -3, -4, -6, -8` only**. There is no `--space-5`, `-7`, `-9` or `-10`. Where a larger step is needed, use a literal: `48px` and `72px` for section separation, `96px` for the page's bottom padding.

### Rules

`2px solid` throughout. Never a hairline.

- `var(--color-text)` for structural rules: under kickers, between major sections, above pull-out lines
- `var(--color-neutral-300)` for rules inside a block
- `var(--color-neutral-800)` for node borders
- Full-width section separators: `height: 2px; background: var(--color-text); margin: 72px 0 var(--space-8)`

### Colour

Mono ink on ground, plus one non-system accent:

- **`#ec6917`** (Silurian orange) marks the Assay path only. Used on: the two Assay chart nodes, the closing field, the `92.5%` numeral, and the "can be forecast" swatches. It is not in the Modernist palette.
- **`var(--color-accent-700)`** (system red) appears once, as the border and heading colour of the Today failure outcome. Red means wrong path.
- Text on orange fields is `#ffffff`. Rules inside an orange field are `rgba(255,255,255,0.45)`.
- Everything else is `var(--color-text)` on `var(--color-bg)`, with `var(--color-surface)` fills and `var(--color-neutral-900)` for the ink field.

Two known contrast exceptions, both accepted deliberately:

1. White on `#ec6917` is 3.18:1. It clears the 3:1 large text floor for the 31px statement, and is below 4.5:1 for the 12px kicker and 15px node copy in the same fields.
2. The `92.5%` numeral in `#ec6917` on the ground is 2.85:1, marginally under the 3:1 large text floor.

Do not "fix" either without asking. Ink on orange is 5.25:1 if the decision is ever reversed.

### Links

- Style: `display: inline-flex; align-items: baseline; gap: var(--space-3); white-space: nowrap`, label and arrow in separate `<span>` elements, `border-bottom: 2px solid` on the link.
- The label must not wrap. If it wraps, the underline trails off to a floating arrow.
- Arrow: `&#8594;` with `aria-hidden="true"`.
- Ink links use `var(--color-text)` for both text and rule. Links on the orange field use `#ffffff` for both.

---

## Section order

1. Header block
2. Intro row: text left, statistic figure right
3. Chart
4. "Does this look familiar?"
5. Full width callback
6. Two column argument: forecasting, customer forecasts
7. Two column lists: what you get, what it will not tell you
8. Bridge row: what comes back, plus the output fragment
9. Closing orange field

---

## 1. Header block

Kicker, 12px uppercase: **Silurian Assay**

Headline, 40px, `max-width: 26ch`:

> Not every product can be forecast.

Standfirst, 19px, `max-width: 62ch`:

> Assay reads a demand extract and tells you what is wrong with the file, which products you can forecast, which you never will, and which you have not got the history to judge. Minutes rather than hours, and the same method every cycle.

Then a full width `2px` ink rule.

All copy on this page is signed off verbatim.

---

## 2. Intro row

Grid: `grid-template-columns: minmax(0, 1.6fr) minmax(260px, 1fr); gap: 72px; align-items: start; margin-bottom: 72px`.

Do not pin the text track to a `ch` width. It stops the figure shrinking and the figure grows tall enough to leave a void under the text.

### Left column

Lead, 25px heading font:

> Before a forecast becomes a plan, somebody has to decide whether to believe it.

Body, 19px:

> That work happens every cycle. Tidying up the extract, comparing it to last month, working out from memory which lines never behave. It is not in anyone's process document and it has no name, so it gets done differently every time and the reasoning leaves the building with whoever did it.

> It is also the cheapest place in the whole chain to catch a problem, because nothing has been bought yet.

### Right column: the statistic figure

`<figure>`, in order:

Kicker, 12px uppercase, above a `2px` ink rule: **The largest forecasting contest ever run**

Numeral, 56px, `#ec6917`, `line-height: 0.95`, `letter-spacing: -0.02em`: **92.5%**

19px, immediately below:

> of the teams that entered produced forecasts **less accurate than a basic weighted average**.

Above a `var(--color-neutral-300)` rule, two lines at 15px, bold lead:

> **Two thirds** were less accurate than repeating last year's pattern.

> **Half** were less accurate than assuming next month looks like last month.

Above a `var(--color-text)` rule, 15px:

> People who forecast for a living, trying hard, on clean data.

`<figcaption>`, 12px, `var(--color-neutral-800)`:

> Known as M5. Run on open Walmart sales data with a public leaderboard and prize money, and reported in the *International Journal of Forecasting*, 2022.

The plain description leads and the name follows, so a reader who does not know M5 still gets the significance.

---

## 3. Chart

### Shared entry bar

Full width, `background: var(--color-neutral-900)`, text `var(--color-bg)`, padding `var(--space-6)`.

- 19px, weight 600: **A forecast arrives**
- 15px, `var(--color-neutral-300)`: Yours, or your customer's

### Two columns

`grid-template-columns: 1fr 1fr; gap: 72px`. Each column is `display: flex; flex-direction: column`.

Connectors between nodes are `width: 2px; background: var(--color-text); margin-left: var(--space-8)`, height `var(--space-8)` from the entry bar to the column kicker, `var(--space-6)` between nodes.

**The last connector before the outcome box is `flex: 1; min-height: var(--space-6)`.** This is what makes the two outcome boxes finish level regardless of how much copy sits above them. Nothing else may be added inside either column after the outcome box, or that column shortens and the level finish breaks.

Column kickers are two lines above a `2px` ink rule: a 12px uppercase label, then a 15px sentence case clause with `margin-top: var(--space-2)`. The long clause must not be set in letterspaced uppercase.

#### Left column: THE WORK YOU DO NOW / hours, and an answer nobody can check

Node 1, ground fill, `2px var(--color-neutral-800)` border, padding `var(--space-6)`:

- 19px, weight 600: **Pivot tables, judgement, or both**
- 15px: Tidy up the extract. Compare it to last month.<br>Work out from memory which lines look wrong.
- Above a `var(--color-neutral-300)` rule, 15px: Hours of work. A different answer depending on who did it.

Nodes 2 and 3, `var(--color-surface)` fill, `2px var(--color-neutral-800)` border, padding `var(--space-4) var(--space-6)`, 15px:

- Into the plan
- Agreed, then committed<br>Material bought. Capacity booked.

Outcome, ground fill, `2px var(--color-accent-700)` border, padding `var(--space-6)`:

- 19px, weight 600, `var(--color-accent-700)`: **Stock carried against products nothing could ever predict.**
- 15px ink: Time spent on the wrong products.<br>No way to challenge the forecast you were sent.

#### Right column: THE SAME WORK WITH ASSAY / minutes, and an answer you can show anyone

Node 1, `#ec6917` fill, white text, padding `var(--space-6)`:

- 19px, weight 600: **Upload the extract**
- 15px: What is wrong with the file.<br>Which products you can forecast.<br>Which ones you never will.<br>Which ones you have not got the history to tell.
- Above a `rgba(255,255,255,0.45)` rule, 15px: Minutes. The same method every cycle.

Nodes 2 and 3, same treatment as the left column:

- Into the plan, knowing<br>which numbers to trust
- Agreed, then committed<br>Material bought. Capacity booked.

Outcome, `#ec6917` fill, white text, padding `var(--space-6)`:

- 19px, weight 600: **Stock carried for reasons you can explain.**
- 15px: Time spent where it makes a difference.<br>Evidence to challenge the forecast you were sent.

---

## 4. "Does this look familiar?"

A separate `1fr 1fr` grid row with `gap: 72px` and `margin-top: var(--space-4)`, the line at 15px in the first cell. It sits under the left column but outside it, so it cannot compress the chart's level finish.

---

## 5. Full width callback

Above a `2px` ink rule, `padding-top: var(--space-6); margin-top: var(--space-8)`.

25px heading font, `max-width: 52ch`:

> The 92.5 percent were not bad at forecasting. They were forecasting products nothing could predict, because nobody had told them which ones those were.

19px, `max-width: 62ch`:

> The cost never shows up in the forecast. It shows up later, as stock you cannot sell, service you cannot hold, and an argument with your customer you have no evidence for.

The statistic stays at the top of the page and its payoff sits here, so the reader travels the whole graphic. Do not move the statistic down.

---

## 6. Two column argument

Full width `2px` ink separator, then `grid-template-columns: 1fr 1fr; gap: 72px; align-items: start`. Headings 25px, body 19px.

### Better forecasting is not the answer for every product

> The competition above tells you something the leaderboard does not. The gains available on sparse, irregular products were close to nothing: around three percent at the level individual products are actually planned at, against forty percent higher up the aggregation.

> The products that make your forecast look bad are the products where trying harder helps least.

> The lesson is not that forecasting is pointless. It is that effort spent on the wrong products produces nothing, and nobody is telling you which products those are.

### When the forecast comes from your customer

> Read the supply agreement. Beyond the first few months it almost certainly says the forecast creates no binding obligation and is provided for planning purposes only.

> Your customer has told you in writing not to rely on it. You buy material against it anyway.

> There is a reason those numbers run high, and it is not dishonesty. A customer who wants capacity held has every reason to ask for more than they need, and it costs them nothing to do it.

> So you are committing money against a number that is not binding, produced by someone with a reason to round it up, and checked by nobody.

Final line as a pull-out: 25px heading font above a `2px` ink rule, `padding-top: var(--space-6)`:

> Ask how often those forecasts turned into orders last year. Most companies cannot answer, because nobody has ever counted.

---

## 7. Two column lists

Full width `2px` ink separator, then `1fr 1fr`, `gap: 72px`. Headings 25px.

### What you get

Unstyled `<ul>`, `list-style: none`, `display: flex; flex-direction: column; gap: var(--space-4)`. Each item 19px with `padding-top: var(--space-4); border-top: 2px solid var(--color-neutral-300)`. No bullet glyphs, the rules do the work.

- What is wrong with your file, in plain terms, before anything else happens
- Which products you can forecast, which you never will, and which you have not got the history to tell
- How much of your volume sits in each group
- A short list of products to raise with whoever sent you the forecast, with their own history as the evidence
- A record of the run you can repeat next month and get the same answer

### What it will not tell you

> It will not tell you what stock to hold. It tells you which products need an arrangement with a customer rather than a number, and stops there.

> It will not improve a forecast. It tells you where improving one is worth the effort, and where it never will be.

> And it will not tell you what you want to hear. Every company selling forecasting software has a reason to say your whole portfolio is forecastable. This is the opposite service.

---

## 8. Bridge row

Above a `2px` ink rule, `padding-top: var(--space-6); margin-top: 72px`. Grid: `minmax(0, 1.4fr) minmax(280px, 1fr); gap: 72px; align-items: start`.

### Left column

Kicker, 12px uppercase: **What comes back**

25px heading font, `max-width: 34ch`:

> Your portfolio, split three ways, with the volume in each group.

19px, `max-width: 52ch`:

> One page you can put in front of a customer, and a record of the run you can repeat next month and get the same answer.

Link, 19px weight 600, to `forecast-risk.html`:

> See a sample analysis →

### Right column: the output fragment

Kicker above the bar, 12px uppercase, above a `2px` ink rule: **Percent of volume**

A single stacked bar, `height: 28px`, three segments as flex children with `flex: 55 / 20 / 25`:

1. `#ec6917` fill
2. `var(--color-neutral-900)` fill
3. `2px solid var(--color-neutral-500)` border, no fill

Legend below, three 15px rows, each above a `var(--color-neutral-300)` rule, each with a `12px` swatch matching its segment:

- **55%** can be forecast
- **20%** never will be, and need an arrangement instead
- **25%** not enough history to judge

12px caption, `var(--color-neutral-800)`:

> Illustrative split. Every portfolio comes back different.

The split is illustrative and the caption says so. Do not present it as measured data.

---

## 9. Closing orange field

`background: #ec6917`, text `#ffffff`, `padding: var(--space-8) var(--space-8) 48px`, `margin-top: 72px`.

Kicker, 12px uppercase: **Next**

31px heading font, `max-width: 34ch`:

> Send a demand extract and get the assessment back on your own products. Or look at the [sample analysis first. →](forecast-risk.html)

"sample analysis first." is the link, white text with a white `2px` underline and the same arrow as the bridge link.

---

## Settled

- All copy signed off verbatim, including the headline and standfirst.
- The 55/20/25 split is illustrative, captioned as such, and stays.

- `forecast-risk.html` is the sample analysis page. Both links point at it and the labels match the destination.
- The site header strapline reads "AI Forecast Diagnostic", not "AI Demand Forecasting". That header lives outside this project, so the change is made wherever the live header is served from.
- The last line of "what it will not tell you" stays as written.
- Both contrast exceptions stand as recorded under Colour.
