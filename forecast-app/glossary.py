"""One source for every specialist term the tool uses.

Story 2.7.5. The tool and the report's method appendix both render from this
module, because two copies of a definition drift, which is the same rule as
one implementation of any judgement.

Definitions are written for a planner, not a statistician. A definition that
needs another specialist term to make sense is a definition that failed, so
`test_no_definition_leans_on_an_undefined_term` walks them.

This module holds words only. It computes nothing, decides nothing and is
imported by no engine. Adding a decision, band, class or resolution code
without defining it here fails `test_every_emitted_term_is_defined`.
"""

from typing import Any


GLOSSARY_VERSION = "1.0"

# group, term, the plain reading. The order is the order a planner meets them.
ENTRIES: tuple[dict[str, str], ...] = (
    # Quality bands, defect 4 in the planner test: the operational difference
    # between caveated and not usable was the thing they could not state.
    {
        "group": "Data quality band",
        "term": "Clean",
        "plain": "Nothing found that should change what you do with this line. Use it as it stands.",
    },
    {
        "group": "Data quality band",
        "term": "Caveated",
        "plain": "Usable, with something you should know. The finding is named on the line, and it is your judgement whether it changes what you do.",
    },
    {
        "group": "Data quality band",
        "term": "Not usable",
        "plain": "This line's history cannot support a forecast in this run. Something has to change in the data before a number would mean anything.",
    },
    # Demand states.
    {
        "group": "Demand state",
        "term": "Smooth",
        "plain": "Demand arrives in most periods at a steady size. The easiest kind of line to forecast.",
    },
    {
        "group": "Demand state",
        "term": "Erratic",
        "plain": "Demand arrives in most periods but the size swings widely. The timing is predictable and the quantity is not.",
    },
    {
        "group": "Demand state",
        "term": "Intermittent",
        "plain": "Demand arrives in only some periods, with gaps, but at a fairly consistent size when it does. The timing is the hard part.",
    },
    {
        "group": "Demand state",
        "term": "Lumpy",
        "plain": "Demand arrives rarely and the size varies widely when it does. Both the timing and the quantity are unpredictable, which is why no forecasting method handles it well.",
    },
    {
        "group": "Demand state",
        "term": "Unclassifiable",
        "plain": "Too few periods with demand to say what pattern this line follows. It is a state in its own right, not an error and not a missing value.",
    },
    # Routing decisions.
    {
        "group": "Routing decision",
        "term": "Model eligible",
        "plain": "This line goes into the forecast comparison as it stands.",
    },
    {
        "group": "Routing decision",
        "term": "Model eligible wide interval",
        "plain": "This line can be forecast, but use the range rather than the single number. The range is the useful output.",
    },
    {
        "group": "Routing decision",
        "term": "Intermittent methods",
        "plain": "This line can be forecast, but by a method built for demand that arrives in gaps rather than every period.",
    },
    {
        "group": "Routing decision",
        "term": "Policy only",
        "plain": "No forecasting method will predict this line. The answer is a commercial arrangement rather than a number.",
    },
    {
        "group": "Routing decision",
        "term": "Insufficient evidence",
        "plain": "Too little history to decide anything. Supply more, forecast it by comparison with a similar line, or take it out of scope and say so.",
    },
    {
        "group": "Routing decision",
        "term": "Refused data quality",
        "plain": "The tool will not forecast this line until a question about the data is answered. It is waiting on you, not on a model.",
    },
    {
        "group": "Routing decision",
        "term": "Discontinued confirm status",
        "plain": "This line has stopped ordering for long enough that the tool will not assume it is still live. Confirm the status before anything else.",
    },
    # Resolution codes.
    {
        "group": "Resolution",
        "term": "Discontinued confirmed",
        "plain": "You have confirmed the line is finished. It leaves the forecast scope and the stock is run down.",
    },
    {
        "group": "Resolution",
        "term": "Superseded by SKU",
        "plain": "This line was replaced by another one in the same file. The link is recorded and this line leaves the forecast scope.",
    },
    {
        "group": "Resolution",
        "term": "Still active demand gap",
        "plain": "The line is live and the quiet spell was real. It stays in scope and the gap is treated as genuine.",
    },
    {
        "group": "Resolution",
        "term": "Still active data missing",
        "plain": "The line is live and the quiet spell is a hole in the extract. It stays in scope and the missing rows are owed.",
    },
    {
        "group": "Resolution",
        "term": "Supply longer history",
        "plain": "You have asked for more periods of history. The line stays open until that data arrives.",
    },
    {
        "group": "Resolution",
        "term": "Supply corrected extract",
        "plain": "You have asked for a corrected file. The line stays open until that data arrives.",
    },
    {
        "group": "Resolution",
        "term": "Treat as new line",
        "plain": "You have confirmed the line is genuinely new. It is handled as a launch rather than as a line with a short history.",
    },
    {
        "group": "Resolution",
        "term": "Exclude from scope",
        "plain": "You have taken this line out of the engagement. It is recorded as excluded rather than quietly dropped.",
    },
    {
        "group": "Resolution",
        "term": "Defer",
        "plain": "You have parked this line for now. It stays on the open items list so it is not forgotten.",
    },
    # Metrics.
    {
        "group": "Measure",
        "term": "ADI",
        "plain": "How often demand arrives. 1.0 means every period. 3.0 means roughly one period in three.",
    },
    {
        "group": "Measure",
        "term": "CV squared",
        "plain": "How much order sizes vary when demand does arrive. Low means steady sizes. High means some orders are far larger than others.",
    },
    {
        "group": "Measure",
        "term": "ABC volume class",
        "plain": "Where a line sits by cumulative volume. A is the small group of lines that make up most of the volume, C is the long tail.",
    },
    {
        "group": "Measure",
        "term": "XYZ",
        "plain": "How steady a line's demand is period to period. X is steady, Y moves about, Z jumps around. It is only reported where it means something.",
    },
    {
        "group": "Measure",
        "term": "Volume share",
        "plain": "How much of the portfolio's total demand this line accounts for, as a percentage. It sets the running order, never the decision.",
    },
    {
        "group": "Measure",
        "term": "Coverage",
        "plain": "How many of the periods a line should have are actually present in the file.",
    },
    # Run artefacts.
    {
        "group": "Run artefact",
        "term": "Run",
        "plain": "One assessment of one file at one analysis date. Every number on the screen belongs to a single run.",
    },
    {
        "group": "Run artefact",
        "term": "Manifest",
        "plain": "The record of what the tool did, safe to share. It holds counts, codes and fingerprints, and never your product codes or volumes.",
    },
    {
        "group": "Run artefact",
        "term": "Bundle",
        "plain": "The confidential record of a run, holding your data as well as the result. It stays in your browser and is downloaded only by you.",
    },
    {
        "group": "Run artefact",
        "term": "Pass",
        "plain": "One recorded step through the work. Applying an answer to an open item writes a new pass, so the sequence of decisions is kept rather than overwritten.",
    },
    {
        "group": "Run artefact",
        "term": "Forecast eligible",
        "plain": "The tool is willing to forecast this line. It is not a promise that the forecast will be accurate.",
    },
    {
        "group": "Run artefact",
        "term": "Refusal",
        "plain": "The tool declining to forecast a line until a question is answered. A refusal is always paired with the answers that would lift it.",
    },
    {
        "group": "Run artefact",
        "term": "Open item",
        "plain": "A line whose refusal is unanswered, waiting on data, or parked. These are the lines waiting on you.",
    },
)


def entries() -> list[dict[str, str]]:
    """The glossary as a list, in reading order."""
    return [dict(entry) for entry in ENTRIES]


def payload() -> dict[str, Any]:
    """What the tool and the report's method appendix both render."""
    return {"glossary_version": GLOSSARY_VERSION, "entries": entries()}


def slug(term: str) -> str:
    """The key the interface looks a term up by."""
    return term.lower().replace(" ", "_")


def by_slug() -> dict[str, dict[str, str]]:
    return {slug(entry["term"]): entry for entry in ENTRIES}
