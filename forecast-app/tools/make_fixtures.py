#!/usr/bin/env python3
"""Generate messy client CSV fixtures for Silurian Forecast Diagnostic story 1.1."""

import os, json, random, datetime as dt

# Paths. Reads default to the repository copy, resolved from this file's own
# location. Writes have no default and must be named, so a stray run of this
# script cannot overwrite a committed fixture. The committed files are
# authoritative and these scripts are not; see README.md.
import argparse
from pathlib import Path as _Path

_TESTS = _Path(__file__).resolve().parents[1] / "tests"

_ap = argparse.ArgumentParser(description=__doc__)
_ap.add_argument("--out", required=True, help="directory to write the fixtures into. The committed copies live in forecast-app/tests/fixtures")
OUT = _ap.parse_args().out
os.makedirs(OUT, exist_ok=True)

random.seed(1972)

def w(name, text, encoding="utf-8", newline="\n"):
    path = os.path.join(OUT, name)
    data = text.replace("\n", newline)
    with open(path, "wb") as f:
        f.write(data.encode(encoding))
    return path

def months(start_year, start_month, n):
    out = []
    y, m = start_year, start_month
    for _ in range(n):
        out.append(dt.date(y, m, 1))
        m += 1
        if m == 13:
            m = 1; y += 1
    return out

# ---------------------------------------------------------------- 00 control
def clean_control():
    skus = {
        "PKG-10432": (820, 90, 0.0),    # base, noise, trend per month
        "PKG-10518": (240, 40, 1.5),
        "PKG-20077": (1450, 160, -4.0),
        "PKG-30219": (95, 30, 0.0),
    }
    rows = ["sku,date,demand"]
    for sku, (base, noise, trend) in skus.items():
        for i, d in enumerate(months(2023, 1, 36)):
            season = 1.0 + 0.18 * (1 if d.month in (3, 9, 10) else 0) - 0.12 * (1 if d.month in (7, 8) else 0)
            v = max(0, int((base + trend * i) * season + random.gauss(0, noise)))
            rows.append(f"{sku},{d.isoformat()},{v}")
    w("00_clean_control.csv", "\n".join(rows) + "\n")

# ------------------------------------------------- 01 excel export furniture
def excel_preamble():
    lines = [
        "﻿Demand History Extract",
        "Report run: 14/08/2026 09:41:07",
        "Plant: TRE-01   Planner: A. Hughes   Currency: GBP",
        "CONFIDENTIAL - INTERNAL USE ONLY",
        "",
        "Material,Description,Month,Qty Shipped,",
        "PKG-10432,Blister carton 30ct,2025-01-01,812,",
        "PKG-10432,Blister carton 30ct,2025-02-01,777,",
        "PKG-10432,Blister carton 30ct,2025-03-01,940,",
        "",
        "PKG-10518,Bottle label 100ml,2025-01-01,251,",
        "PKG-10518,Bottle label 100ml,2025-02-01,238,",
        "PKG-10518,Bottle label 100ml,2025-03-01,,",
        "PKG-10518,Bottle label 100ml,2025-04-01,262,",
        "",
        "Grand Total,,,3280,",
        "",
        "Page 1 of 1",
    ]
    w("01_excel_export_furniture.csv", "\n".join(lines) + "\n", newline="\r\n")

# --------------------------------------------------------- 02 date disorder
def date_disorder():
    lines = [
        "sku,date,demand",
        "PKG-10432,01/03/2025,812",       # ambiguous DD/MM vs MM/DD
        "PKG-10432,02/03/2025,777",
        "PKG-10432,13/03/2025,940",       # proves DD/MM for this SKU
        "PKG-10432,2025-04-01,905",       # ISO mid-file
        "PKG-10432,45778,868",            # Excel serial date
        "PKG-10432,Jun-25,881",           # month-year text
        "PKG-10432,01-JUL-2025,912",      # SAP style
        "PKG-10432,2025/08/01 00:00:00,874",
        "PKG-10518,3/1/2025,251",         # single digit, US order
        "PKG-10518,3/2/2025,238",
        "PKG-10518,3/13/2025,244",        # proves MM/DD for this SKU
        "PKG-10518,2025-04-01,262",
        "PKG-10518,31/04/2025,240",       # date that does not exist
        "PKG-10518,2025-W23,255",         # ISO week
        "PKG-20077,2025-01-01,1450",
        "PKG-20077,2025-01-01,1450",
        "PKG-20077,,1502",                # missing date
        "PKG-20077,2026-12-01,1499",      # far future
    ]
    w("02_date_disorder.csv", "\n".join(lines) + "\n")

# ------------------------------------------------------ 03 numeric disorder
def numeric_disorder():
    lines = [
        "sku,date,demand,uom",
        'PKG-10432,2025-01-01,"1,240",EA',      # thousands separator inside quotes
        "PKG-10432,2025-02-01,1 180,EA",        # space separator
        "PKG-10432,2025-03-01,1.240,EA",        # European decimal or thousands, ambiguous
        "PKG-10432,2025-04-01,(85),EA",         # accounting negative
        "PKG-10432,2025-05-01,-40,EA",          # returns
        "PKG-10432,2025-06-01, 905 ,EA",        # padded whitespace
        "PKG-10432,2025-07-01,n/a,EA",
        "PKG-10432,2025-08-01,-,EA",
        "PKG-10432,2025-09-01,#N/A,EA",
        "PKG-10432,2025-10-01,NULL,EA",
        "PKG-10432,2025-11-01,912.0000000001,EA",
        "PKG-10432,2025-12-01,1.2E3,EA",        # scientific notation
        "PKG-10518,2025-01-01,251,EA",
        "PKG-10518,2025-02-01,£238,EA",         # currency symbol in a quantity column
        "PKG-10518,2025-03-01,244 units,EA",
        "PKG-10518,2025-04-01,0,EA",
        "PKG-10518,2025-05-01,,EA",
        "PKG-10518,2025-06-01,262,ea",          # case variant
        "PKG-10518,2025-07-01,255,Each",        # synonym
        "PKG-10518,2025-08-01,21,CS",           # different unit, same column
    ]
    w("03_numeric_disorder.csv", "\n".join(lines) + "\n")

# --------------------------------------------------------- 04 pivoted wide
def pivoted_wide():
    lines = [
        "Item,Item Description,Jan-25,Feb-25,Mar-25,Apr-25,May-25,Jun-25,Jul-25,Aug-25,Sep-25,Oct-25,Nov-25,Dec-25,FY Total",
        'PKG-10432,"Blister carton, 30ct","1,240","1,180","1,310",905,868,881,912,874,"1,290","1,355","1,120","1,005","13,940"',
        'PKG-10518,"Bottle label, 100ml",251,238,244,262,255,249,0,0,266,271,258,243,"2,537"',
        'PKG-20077,"Shipper case, 24x",1450,1502,1388,1421,1466,1399,1350,1288,1502,1560,1490,1433,"17,249"',
        'PKG-30219,"Leaflet, multilang",0,0,180,0,0,0,220,0,0,195,0,0,595',
        'Total,,"2,941","2,920","3,122","2,588","2,589","2,529","2,482","2,162","3,058","3,381","2,868","2,681","34,321"',
    ]
    w("04_pivoted_wide.csv", "\n".join(lines) + "\n")

# ------------------------------------------- 05 duplicates, aliases, casing
def duplicates_aliases():
    lines = [
        "sku,date,demand",
        "PKG-10432,2025-01-01,812",
        "PKG-10432,2025-01-01,812",          # exact duplicate
        "PKG-10432,2025-02-01,777",
        "PKG-10432,2025-02-01,791",          # conflicting duplicate
        "pkg-10432,2025-03-01,940",          # case variant
        " PKG-10432,2025-04-01,905",         # leading space
        "PKG-10432 ,2025-05-01,868",         # trailing space
        "PKG10432,2025-06-01,881",           # separator dropped
        "PKG-10432-A,2025-07-01,912",        # revision suffix appears mid-history
        "PKG-10432-A,2025-08-01,874",
        "PKG_10518,2025-01-01,251",          # underscore variant
        "PKG-10518,2025-02-01,238",
        "PKG-10518,2025-03-01,244",
        "PKG-20077,2025-01-01,1450",
        "PKG-20077,2025-02-01,1502",
        "PKG-20077,2025-02-01,-1502",        # reversal posted as a separate line
        "PKG-20077,2025-03-01,1388",
    ]
    w("05_duplicates_and_aliases.csv", "\n".join(lines) + "\n")

# ------------------------------------------- 06 semicolon, latin-1, quoting
def semicolon_latin1():
    # a quoted field that runs across a line break, which breaks naive splitters
    text = "\n".join([
        "Artikel;Bezeichnung;Datum;Menge",
        'PKG-10432;"Blisterkarton, 30 Stück";01.01.2025;1.240',
        'PKG-10432;"Blisterkarton, 30 Stück";01.02.2025;1.180',
        'PKG-10432;"Blisterkarton, 30 Stück";01.03.2025;1.310',
        'PKG-10518;"Etikett Müller 100ml";01.01.2025;251',
        'PKG-10518;"Etikett Müller 100ml";01.02.2025;238',
        'PKG-20077;"Versandkarton 24x, blau',
        'mehrzeilig";01.01.2025;1.450',
        'PKG-20077;"Versandkarton 24x, blau";01.02.2025;1.502',
    ])
    w("06_semicolon_latin1.csv", text + "\n", encoding="latin-1")

# ----------------------------------------------------- 07 zeros versus gaps
def zeros_versus_gaps():
    rows = ["sku,date,demand"]
    # PKG-30219: true intermittent, zeros recorded explicitly
    intermittent = {1: 0, 2: 0, 3: 180, 4: 0, 5: 0, 6: 0, 7: 220, 8: 0, 9: 0, 10: 195, 11: 0, 12: 0}
    for m, v in intermittent.items():
        rows.append(f"PKG-30219,2025-{m:02d}-01,{v}")
    # PKG-30220: same pattern but zero months simply absent from the export
    for m, v in intermittent.items():
        if v > 0:
            rows.append(f"PKG-30220,2025-{m:02d}-01,{v}")
    # PKG-30221: discontinued mid-year, no end-of-life flag
    for m in range(1, 6):
        rows.append(f"PKG-30221,2025-{m:02d}-01,{420 + m * 7}")
    # PKG-30222: new introduction, only four periods of history
    for m in range(9, 13):
        rows.append(f"PKG-30222,2025-{m:02d}-01,{110 + m * 3}")
    # PKG-30223: a single spike and nothing else
    rows.append("PKG-30223,2025-06-01,4800")
    w("07_zeros_versus_gaps.csv", "\n".join(rows) + "\n")

# -------------------------------------------------- 08 unit change midway
def unit_change():
    rows = ["sku,date,demand,uom"]
    # eaches until Jul 2025, cases of 12 from Aug 2025, uom column not updated
    vals = [1240, 1180, 1310, 1205, 1268, 1281, 1212, 101, 108, 113, 94, 100]
    for i, v in enumerate(vals, start=1):
        rows.append(f"PKG-10432,2025-{i:02d}-01,{v},EA")
    # a second SKU where the uom column does change, which is the honest case
    vals2 = [1450, 1502, 1388, 1421, 1466, 1399, 1350, 107, 125, 130, 124, 119]
    for i, v in enumerate(vals2, start=1):
        uom = "EA" if i <= 7 else "CS"
        rows.append(f"PKG-20077,2025-{i:02d}-01,{v},{uom}")
    w("08_unit_change_midhistory.csv", "\n".join(rows) + "\n")

# --------------------------------------- 09 mixed granularity and subtotals
def mixed_granularity():
    lines = [
        "sku,customer,site,date,demand",
        "PKG-10432,ACME Pharma,TRE-01,2025-01-01,500",
        "PKG-10432,Northwind Health,TRE-01,2025-01-01,312",
        "PKG-10432,,TRE-01,2025-01-01,812",           # site level subtotal, same period
        "PKG-10432,ACME Pharma,TRE-01,2025-02-01,470",
        "PKG-10432,Northwind Health,TRE-01,2025-02-01,307",
        "PKG-10432,ALL,ALL,2025-02-01,777",           # another subtotal convention
        "PKG-10518,ACME Pharma,TRE-01,2025-01-01,151",
        "PKG-10518,ACME Pharma,DUB-02,2025-01-01,100",
        "PKG-10518,ACME Pharma,TRE-01,2025-02-01,138",
        "PKG-10518,ACME Pharma,DUB-02,2025-02-01,100",
        "Subtotal PKG-10518,,,2025-02-01,238",
        "PKG-20077,Various,TRE-01,2025-01-01,1450",
        "PKG-20077,Various,TRE-01,2025-02-01,1502",
    ]
    w("09_mixed_granularity_subtotals.csv", "\n".join(lines) + "\n")

# ------------------------------------------- 10 header variants, extra cols
def header_variants():
    lines = [
        "Material Number,Material Desc,Req. Dely Date,Order Qty,Confirmed Qty,Shipped Qty,Net Value,Sales Org,Order Type,Deleted Flag",
        "PKG-10432,Blister carton 30ct,2025-01-15,900,850,812,4060.00,GB01,ZOR,",
        "PKG-10432,Blister carton 30ct,2025-02-14,800,800,777,3885.00,GB01,ZOR,",
        "PKG-10432,Blister carton 30ct,2025-02-20,150,150,0,750.00,GB01,ZOR,X",
        "PKG-10432,Blister carton 30ct,2025-03-15,950,950,940,4700.00,GB01,ZOR,",
        "PKG-10432,Blister carton 30ct,2025-03-16,200,0,0,1000.00,GB01,ZRE,",
        "PKG-10518,Bottle label 100ml,2025-01-20,260,260,251,502.00,GB01,ZOR,",
        "PKG-10518,Bottle label 100ml,2025-02-18,240,240,238,476.00,GB01,ZOR,",
        "PKG-10518,Bottle label 100ml,2025-03-19,250,250,244,488.00,IE02,ZOR,",
        "PKG-20077,Shipper case 24x,2025-01-10,1500,1450,1450,2900.00,GB01,ZOR,",
        "PKG-20077,Shipper case 24x,2025-02-10,1500,1502,1502,3004.00,GB01,ZOR,",
    ]
    w("10_header_variants_order_book.csv", "\n".join(lines) + "\n")

# ---------------------------------------- 11 forecast rows mixed in, future
def actuals_and_forecast_mixed():
    lines = [
        "sku,date,demand,record_type",
        "PKG-10432,2025-09-01,912,Actual",
        "PKG-10432,2025-10-01,874,Actual",
        "PKG-10432,2025-11-01,1290,Actual",
        "PKG-10432,2025-12-01,1355,Actual",
        "PKG-10432,2026-01-01,1200,Forecast",
        "PKG-10432,2026-02-01,1200,Forecast",
        "PKG-10432,2026-03-01,1200,Forecast",
        "PKG-10518,2025-09-01,266,Actual",
        "PKG-10518,2025-10-01,271,Actual",
        "PKG-10518,2025-11-01,258,ACTUAL",
        "PKG-10518,2025-12-01,243,actual",
        "PKG-10518,2026-01-01,250,Budget",
        "PKG-10518,2026-02-01,250,Budget",
        "PKG-20077,2025-09-01,1502,Actual",
        "PKG-20077,2025-10-01,1560,Actual",
        "PKG-20077,2025-11-01,1490,Plan",
        "PKG-20077,2025-12-01,1433,",
    ]
    w("11_actuals_and_forecast_mixed.csv", "\n".join(lines) + "\n")

# ------------------------------------------------ 12 wrong file altogether
def wrong_file():
    lines = [
        "sku,date,on_hand,safety_stock",
        "PKG-10432,2026-08-01,4200,1800",
        "PKG-10518,2026-08-01,900,400",
        "PKG-20077,2026-08-01,6100,2400",
    ]
    w("12_wrong_file_inventory_snapshot.csv", "\n".join(lines) + "\n")


clean_control()
excel_preamble()
date_disorder()
numeric_disorder()
pivoted_wide()
duplicates_aliases()
semicolon_latin1()
zeros_versus_gaps()
unit_change()
mixed_granularity()
header_variants()
actuals_and_forecast_mixed()
wrong_file()

print("written:", sorted(os.listdir(OUT)))
