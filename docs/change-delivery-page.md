# Change: delivery.html

New page at delivery.html. Copy is James's, verbatim.

## Page copy

H1: Programme and Project Delivery
Lead: Delivery leadership for complex, cross-functional change

Silurian Consulting provides independent project and programme leadership
for pharmaceutical and other regulated organisations.

We take on complex delivery where success depends on coordinating multiple
functions, sites, external partners, systems or markets. This includes
establishing control from the outset, recovering work that has lost
direction, and leading critical projects through implementation.

### Where we add value

Five items, each carrying the #1 to #5 marker from index.html's `.domains
.n` class, same accent colour, same markup shape, heading plus paragraph:

Mobilising delivery
Turning an objective into a structured and deliverable plan, with clear
scope, milestones, responsibilities, dependencies and decision points.

Establishing control
Creating proportionate governance, reporting and escalation so that risks
are visible, decisions are made at the right level and stakeholders have a
reliable view of progress.

Leading execution
Coordinating cross-functional teams across supply chain, manufacturing,
quality, regulatory, commercial, finance, technology and external partners.

Recovering challenged projects
Identifying what is preventing delivery, resetting priorities and
accountabilities, and creating a credible route to completion.

Managing implementation
Taking projects through readiness, go-live, cutover, stabilisation and
handover while protecting operational and supply continuity.

### Typical assignments

Copy the `.gets` rule from forecastability.html into delivery.html as its
own rule block, not a shared stylesheet addition. Top hairline per item, no
bullet mark, full divider ink. Nine items:

- Business and supply chain transformation
- New product introduction and global expansion
- Site and technology transfer
- Operating-model and organisational change
- Systems and process implementation
- Post-acquisition integration
- Programme review and recovery
- Portfolio prioritisation and governance
- Artwork and labelling programmes, including major rebranding and
  regulatory safety updates

### A practical delivery approach

Our approach is structured but proportionate. We establish the controls
needed to deliver the work without creating unnecessary process or
reporting.

Assignments are built around clear outcomes, defined responsibilities and
transparent evidence of progress.

## Nav change

The nav is between the two service lines, not between index and delivery.
On both index.html and delivery.html, the nav holds two links in this
order: "Programme and Project Delivery" (delivery.html), then "AI Forecast
Diagnostic" (forecastability.html). aria-label is "Services" on both pages.

On delivery.html, the delivery link carries aria-current="location", color
var(--color-text), underline with 5px offset. The AI Forecast Diagnostic
link carries color var(--color-text-muted), no underline, border-left: 1px
solid var(--color-divider), padding-left matching the existing link gap.
Neither link on index.html carries aria-current.

The border-left between the two links is a second hairline in the same
masthead as the existing `.mast-rule` element between subline and nav.
Both hairlines hide under the same wrap condition: extend the existing
521px rule so the new border-left is also removed when the nav wraps,
rather than adding a second breakpoint.

## Constraints

- Zero radius, except the existing 40px contact badge in the closing field
- Rules at full --color-divider ink
- --space-1 to --space-4 only for spacing tokens, layout values literal px
- First person plural throughout
- No new component beyond the `.gets` copy and the `.domains .n` reuse
  named above. If anything else needs a treatment the site does not have,
  stop and ask.

Acceptance criteria:
- delivery.html exists, uses the wordmark from
  change-wordmark-silurian-pm.md, contains the copy above verbatim
- nav on both pages shows two links with a hairline between them, both
  hairlines disappear together when the nav wraps
- no route to delivery.html other than the masthead nav
- no radius anywhere on delivery.html except the closing field contact
  badge

Rejected, do not re-propose:
- a typed pipe character between the nav links
- cropping the nav hairline to 1em
- any second route to the delivery page
- promoting `.gets` to a shared stylesheet
