# Messy client CSV fixtures

Test set for story 1.1, strict input contract and validation, on the Silurian Forecast Diagnostic.

Thirteen files. One clean control and twelve failure modes drawn from real ERP and planner exports. Every file uses the same four anonymised SKUs so results stay comparable across fixtures.

The point of the set is not that files fail to parse. Two of them do. The dangerous ten parse cleanly and are silently wrong, which is how a diagnostic produces a confident number from nonsense and loses a client.

## Baseline behaviour today

Naive `pandas.read_csv` with defaults on this set:

- Hard failure: `01`, `06`
- Parses without complaint but is wrong: `02`, `03`, `04`, `05`, `07`, `08`, `09`, `10`, `11`, `12`
- Correct: `00` only

That ratio is the argument for building 1.1 before anything else.

## The files

### 00_clean_control.csv
Three years of monthly history, four SKUs, mild seasonality and trend. The only file that should pass with zero findings. Use it to prove the validator does not raise false positives.

### 01_excel_export_furniture.csv
Saved from Excel by a planner. UTF-8 BOM, four title rows above the header, a trailing comma on every row, blank rows between SKU blocks, a `Grand Total` line, a `Page 1 of 1` footer, and CRLF line endings.
**Expect:** reject with a message naming the header row it found and offering to skip the preamble.

### 02_date_disorder.csv
Eight date formats in one column. DD/MM and MM/DD ambiguity that resolves differently per SKU, an Excel serial number, `Jun-25`, SAP `01-JUL-2025`, an ISO week, a timestamp, a date that does not exist (31 April), a missing date and a far future row.
**Expect:** reject. Never guess a date order silently. Ask the user to confirm, and state the evidence for each candidate.

### 03_numeric_disorder.csv
Quantity column carrying thousands separators, a space separator, a European decimal that is genuinely ambiguous, an accounting negative in brackets, padded whitespace, `n/a`, `-`, `#N/A`, `NULL`, scientific notation, a currency symbol and `244 units`. UOM values vary in case and synonym.
**Expect:** reject on the ambiguous `1.240`. Auto-handle the unambiguous cases but report every coercion made.

### 04_pivoted_wide.csv
Months as columns, the format planners actually send. Quoted descriptions containing commas, quoted thousands separators, an `FY Total` column and a `Total` row.
**Expect:** detect wide format, offer to unpivot, exclude the total column and row, and confirm the reshape with the user before proceeding.

### 05_duplicates_and_aliases.csv
Exact duplicate rows, a conflicting duplicate for the same SKU and period, case variants, leading and trailing whitespace, a dropped separator, a revision suffix appearing mid-history, an underscore variant, and a negative reversal line posted separately.
**Expect:** accept with warnings. De-duplicate exact matches silently, escalate the conflicting key, and surface suspected aliases for the user to confirm or reject. Never merge aliases automatically.

### 06_semicolon_latin1.csv
German export. Semicolon delimited, latin-1 encoded, German date format, decimal comma, and a quoted description running across a line break.
**Expect:** reject on encoding, then re-offer with detected encoding and delimiter. This one exposes assumptions rather than logic.

### 07_zeros_versus_gaps.csv
Five SKUs, each a different history problem. Explicit zeros, the same pattern with zero months simply absent, a series discontinued mid-year with no end-of-life flag, a new introduction with four periods, and a single spike.
**Expect:** accept with warnings, one per SKU, each naming the specific risk. This file is where the sprint 2 forecastability screen gets its requirements.

### 08_unit_change_midhistory.csv
Quantities drop by roughly a factor of twelve partway through. On the first SKU the UOM column still says `EA`, so only the level break reveals it. On the second SKU the UOM column changes honestly.
**Expect:** flag the level break as a suspected unit change and refuse to forecast that series until confirmed. Missing this produces a forecast that is wrong by an order of magnitude, which is the single worst outcome in the set.

### 09_mixed_granularity_subtotals.csv
Rows at SKU, SKU by customer, and SKU by customer by site, plus two different subtotal conventions and a `Subtotal PKG-10518` label in the SKU column.
**Expect:** reject. Double counting here inflates demand silently. Ask the user to choose the level before proceeding.

### 10_header_variants_order_book.csv
A raw SAP order book rather than demand history. Unrecognised column names, three candidate quantity columns, a deletion flag, a returns order type, multiple lines per month, and a second sales org.
**Expect:** reject with a mapping prompt. Ask which quantity column represents demand, whether to exclude deleted lines and returns, and how to aggregate to period.

### 11_actuals_and_forecast_mixed.csv
Actuals and forward-looking rows in one file, with `Forecast`, `Budget`, `Plan` and a blank record type, plus case variants of `Actual`.
**Expect:** reject. Training on a client's own forecast is a silent, credibility-destroying error. Filter to actuals only, after confirming the mapping.

### 12_wrong_file_inventory_snapshot.csv
Schema-valid but semantically wrong. It is an inventory position, not demand history.
**Expect:** reject on the missing demand column and say plainly what the file appears to be.

## Using the set with Codex

`expected_findings.json` carries the same content as machine-readable expectations. Each file lists the defect codes the validator must raise and a verdict of `reject`, `accept_with_warnings` or `accept`.

Suggested harness. One test per file, asserting three things:

1. The verdict matches.
2. Every expected code is present in the findings.
3. No unexpected code appears on `00_clean_control.csv`.

Do not assert exact message wording. Assert codes, and review the wording by eye, because the message quality is the thing a client actually sees.

## Extending the set later

Worth adding once the basics pass: a file with 40,000 rows to check performance, a file where the SKU column contains leading zeros that Excel has stripped, and a file where the client has redacted SKU codes inconsistently between two extracts.
