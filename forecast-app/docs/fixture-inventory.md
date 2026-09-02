# Forecast Diagnostic fixture inventory

Repository fixtures are synthetic. Exact byte checks must use the committed files. CSV line endings, the JSON goldens and schema copies under the `tests/*_fixtures` directories, and the two runtime schemas are pinned to LF by the root `.gitattributes`. The `expected_*.json` files and the validation fixture directory stay byte-exact under `-text`.

## Validation fixtures

Authoritative expectations: `tests/fixtures/expected_findings.json` version 1.2.

| File | Purpose |
|---|---|
| `00_clean_control.csv` | Clean monthly control with no validation finding. |
| `01_excel_export_furniture.csv` | Excel furniture, preamble, blank rows, total and footer. |
| `02_date_disorder.csv` | Mixed and invalid date forms, Excel serial date, missing date and future date. |
| `03_numeric_disorder.csv` | Thousands separators, decimal ambiguity, accounting negatives, null tokens and scientific notation. |
| `04_pivoted_wide.csv` | Periods in columns, quoted descriptions and total row or column ambiguity. |
| `05_duplicates_and_aliases.csv` | Exact and conflicting duplicate keys, SKU aliases, whitespace and reversal rows. |
| `06_semicolon_latin1.csv` | Latin-1, semicolon delimiter, decimal comma and multiline quoted description. |
| `07_zeros_versus_gaps.csv` | Validation accepts the file; quality owns the planted zero, gap, lifecycle and spike conditions. |
| `08_unit_change_midhistory.csv` | Suspected and explicit unit changes that must block until resolved. |
| `09_mixed_granularity_subtotals.csv` | Mixed dimension depth and subtotal double-counting risk. |
| `10_header_variants_order_book.csv` | Raw order book with ambiguous quantity, deletion, return and sales-organisation fields. |
| `11_actuals_and_forecast_mixed.csv` | Actual, forecast, budget and plan rows mixed in one file. |
| `12_wrong_file_inventory_snapshot.csv` | Inventory snapshot presented where demand history is required. |

`tests/fixtures/MANIFEST.md` contains the full planted-condition narrative. `tests/fixtures/1.1-answers.md` records the settled decisions.

## Quality fixtures

Authoritative expectations: `tests/quality_fixtures/expected_quality.json` version 1.2.

| File | Purpose |
|---|---|
| `00_clean_control.csv` | Four clean series and no quality findings. Uses analysis date 1 January 2026. |
| `20_portfolio_mixed.csv` | Flagship 12-SKU portfolio with quality, coverage, lifecycle, long-tail and zero-versus-missing cases. |
| `21_stale_extract.csv` | Every series ends together four periods early. Must produce one portfolio `EXTRACT_STALE` finding rather than repeated SKU findings. |
| `22_outliers_and_shift.csv` | Seasonal peak that must not flag, true spike, sustained level shift and suspect zero. |
| `07_zeros_versus_gaps.csv` | The validation fixture is also asserted by the quality suite for structural metrics, bands, findings and null CV squared. |

## Classification fixtures

Authoritative expectations: `tests/classification_fixtures/expected_classification.json` version 1.2.

| File | Purpose |
|---|---|
| `30_classification_portfolio.csv` | Fifteen SKUs covering all four statistical demand quadrants, unclassifiable refusals, ABC volume bands, XYZ boundaries and the material lumpy line `PKG-50301`. |

Approved hashes:

- `30_classification_portfolio.csv`: `49c9cd8d3052b6db072eeb1bb80e9b25ad91957135dfdbe9f6dacf27142e75bc`
- `expected_classification.json`: `056a169ea9f25bcfeae675ca9e8afa8eeafdc36d68d043cf89119b5481b9688e`

## Routing fixtures

Authoritative expectations: `tests/fixtures/expected_routing.json` version 1.1, with the observed quality inputs recorded inside it. Version 1.1 supersedes 1.0 and computes portfolio shares from unit volumes.

| File | Purpose |
|---|---|
| `31_routing_portfolio.csv` | Fourteen SKUs, 390 rows, monthly from 2023-09 to 2026-07, analysis date 2026-08-01. Validates as accept with no findings, bands the portfolio not usable at 55.27 percent flagged volume, and exercises every routing decision and both precedence boundaries: `RTG-60403` (discontinued beats not usable), `RTG-60502` (not usable beats unclassifiable), `RTG-60501` (a clean line refused on evidence), `RTG-60601` and `RTG-60301` (a caveat never reroutes), and `RTG-60401` (the material refusal offering `TREAT_AS_NEW_LINE`). |

Approved hashes:

- `31_routing_portfolio.csv`: `2c55f4f7c30e6f708c7389a2df3850a8fb7947b1187f19c95531b4aaca9601f6`
- `expected_routing.json` v1.1: `7fea85d2ec16ed57781e37a74957d18af3313ca58afc4fad59f086e2f69bc607`

## Manifest and bundle fixtures

| File | Purpose |
|---|---|
| `tests/run_manifest_fixtures/02_date_disorder.csv` | Rejected validation-only manifest. |
| `tests/run_manifest_fixtures/20_portfolio_mixed.csv` | Accepted multi-stage manifest input. |
| `tests/run_manifest_fixtures/timesfm_reference_series.csv` | Fixed synthetic TimesFM drift canary input. |
| `tests/run_manifest_fixtures/run_manifest.golden.json` | Current accepted manifest golden. |
| `tests/run_manifest_fixtures/run_manifest.golden.rejected.json` | Rejected-run manifest golden. |
| `tests/run_bundle_fixtures/run_bundle.golden.json` | Confidential bundle golden generated by the real engines, including the routing stage, and checked against independent quality expectations. |

## End-to-end deployed check

Use the committed `30_classification_portfolio.csv` against `https://silurian-forecast-diagnostic.vercel.app/`:

1. Upload the file in the portfolio section.
2. Set the analysis date to `2026-08-01`.
3. Select monthly frequency.
4. Assess data quality and open Classification.
5. Confirm 15 lines, 17.7 percent lumpy volume, two unclassifiable lines, 11 populated matrix cells and four disabled empty cells.
6. Select the A and lumpy cell. Confirm only `PKG-50301` remains, with 13.86 percent volume, caveated quality and `OUTLIER_CANDIDATE`.

For a deployed end-to-end routing check, upload the committed `31_routing_portfolio.csv` the same way:

1. Set the analysis date to `2026-08-01` and select monthly frequency.
2. Assess data quality and open Routing.
3. Confirm the headline reads 65.57 percent of volume forecast eligible and 34.43 percent not, with seven decisions in the split by reason.
4. Filter by `refused data quality`. Confirm only `RTG-60401`, `RTG-60402` and `RTG-60502` remain.
5. Open `RTG-60403`. Confirm the decision is `discontinued confirm status`, not `refused data quality`, despite its not usable band.
6. Open `RTG-60301`. Confirm `policy only`, not eligible, with no refusal block and the `OUTLIER_CANDIDATE` caveat shown.

This check sends the synthetic fixture to the deployed application. Use synthetic or anonymised data only.
