import os
import re
import csv
import tempfile
from datetime import datetime

import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

try:
    import pdfplumber
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

# ---------------------------------------------------------------------------
# IRS CATEGORY RULES
# ---------------------------------------------------------------------------

CATEGORY_RULES = [
    # --- Fuel ---
    {
        "category": "Fuel",
        "schedule_c_line": "Line 9 – Car and Truck Expenses",
        "deductible": True,
        "keywords": [
            "fuel", "gasoline", "gas station", "diesel", "petrol", "exxon", "mobil",
            "shell", "chevron", "bp ", "circle k", "pilot travel", "loves travel",
            "flying j", "speedway", "marathon", "sunoco", "valero", "76 gas",
            "quiktrip", "wawa fuel", "racetrac", "kwik trip",
        ],
    },
    # --- Truck / Vehicle Repair & Maintenance ---
    {
        "category": "Truck Repair & Maintenance",
        "schedule_c_line": "Line 9 – Car and Truck Expenses",
        "deductible": True,
        "keywords": [
            "truck repair", "auto repair", "oil change", "tire", "brake", "transmission",
            "muffler", "exhaust", "alignment", "jiffy lube", "midas", "firestone",
            "pep boys", "autozone", "o'reilly", "advance auto", "napa auto",
            "truck wash", "car wash", "vehicle maintenance", "mechanic",
            "radiator", "battery", "alternator", "engine repair", "coolant flush",
        ],
    },
    # --- Truck / Vehicle Parts ---
    {
        "category": "Truck Parts & Supplies",
        "schedule_c_line": "Line 22 – Supplies",
        "deductible": True,
        "keywords": [
            "truck parts", "auto parts", "spare parts", "belts", "filters",
            "spark plug", "wiper blade", "headlight", "tail light", "mirror",
            "bumper", "fender", "hood", "chassis parts",
        ],
    },
    # --- Meals (50% deductible for business) ---
    {
        "category": "Meals (50% Deductible)",
        "schedule_c_line": "Line 24b – Meals",
        "deductible": True,
        "keywords": [
            "restaurant", "mcdonald", "burger king", "wendy's", "subway", "taco bell",
            "chipotle", "panera", "domino", "pizza hut", "kfc", "popeyes",
            "chick-fil-a", "sonic drive", "arby's", "dairy queen", "dunkin",
            "starbucks", "tim hortons", "denny's", "ihop", "waffle house",
            "cracker barrel", "applebee", "chili's", "olive garden", "red lobster",
            "outback", "texas roadhouse", "grubhub", "doordash", "ubereats",
            "postmates", "instacart meal", "food delivery", "catering",
            "lunch", "dinner", "breakfast", "meal", "cafe", "diner",
        ],
    },
    # --- Travel ---
    {
        "category": "Travel",
        "schedule_c_line": "Line 24a – Travel",
        "deductible": True,
        "keywords": [
            "hotel", "motel", "inn", "lodging", "airbnb", "vrbo", "marriott",
            "hilton", "hyatt", "best western", "holiday inn", "comfort inn",
            "days inn", "super 8", "extended stay", "airline", "delta", "united",
            "southwest", "american airlines", "spirit air", "frontier air",
            "jetblue", "flight", "airfare", "amtrak", "train ticket", "bus ticket",
            "greyhound", "uber", "lyft", "taxi", "rental car", "enterprise",
            "hertz", "avis", "budget rental", "national car", "alamo",
            "parking", "toll", "ezpass", "ipass", "turnpike",
        ],
    },
    # --- Insurance ---
    {
        "category": "Insurance",
        "schedule_c_line": "Line 15 – Insurance",
        "deductible": True,
        "keywords": [
            "insurance", "geico", "progressive", "state farm", "allstate",
            "nationwide", "liberty mutual", "travelers ins", "farmers ins",
            "usaa insurance", "trucking insurance", "cargo insurance",
            "commercial insurance", "liability ins", "workers comp",
            "health insurance", "dental insurance", "vision insurance",
            "life insurance premium", "property insurance",
        ],
    },
    # --- Payroll / Labor ---
    {
        "category": "Payroll & Labor",
        "schedule_c_line": "Line 26 – Wages",
        "deductible": True,
        "keywords": [
            "payroll", "adp payroll", "paychex", "gusto payroll", "rippling pay",
            "direct deposit payroll", "salary payment", "wages", "employee pay",
            "contractor payment", "1099 payment", "labor cost",
        ],
    },
    # --- Office Supplies ---
    {
        "category": "Office Supplies",
        "schedule_c_line": "Line 22 – Supplies",
        "deductible": True,
        "keywords": [
            "office depot", "office max", "staples", "uline", "amazon office",
            "printer paper", "ink cartridge", "toner", "pens", "notebooks",
            "folders", "binders", "desk supplies", "office supply",
        ],
    },
    # --- Phone / Internet ---
    {
        "category": "Phone & Internet",
        "schedule_c_line": "Line 25 – Utilities",
        "deductible": True,
        "keywords": [
            "verizon", "at&t", "t-mobile", "sprint", "cricket wireless",
            "boost mobile", "metro pcs", "comcast", "xfinity", "spectrum",
            "cox communications", "centurylink", "att internet", "satellite internet",
            "cell phone", "mobile plan", "phone bill", "internet bill",
        ],
    },
    # --- Utilities ---
    {
        "category": "Utilities",
        "schedule_c_line": "Line 25 – Utilities",
        "deductible": True,
        "keywords": [
            "electric bill", "electricity", "gas utility", "water bill",
            "sewer bill", "trash pickup", "waste management", "duke energy",
            "con edison", "pg&e", "dte energy", "dominion energy",
            "southern company", "xcel energy", "utility payment",
        ],
    },
    # --- Rent / Lease ---
    {
        "category": "Rent & Lease",
        "schedule_c_line": "Line 20b – Rent or Lease (Other)",
        "deductible": True,
        "keywords": [
            "rent payment", "lease payment", "office rent", "warehouse rent",
            "storage rent", "equipment lease", "truck lease", "trailer lease",
            "property lease", "facility rent",
        ],
    },
    # --- Professional Services ---
    {
        "category": "Professional Services",
        "schedule_c_line": "Line 17 – Legal and Professional Services",
        "deductible": True,
        "keywords": [
            "attorney", "lawyer", "legal fee", "accountant", "cpa fee",
            "tax preparer", "bookkeeping", "consulting fee", "professional fee",
            "notary", "filing fee", "court fee",
        ],
    },
    # --- Software / Subscriptions ---
    {
        "category": "Software & Subscriptions",
        "schedule_c_line": "Line 27a – Other Expenses",
        "deductible": True,
        "keywords": [
            "quickbooks", "microsoft 365", "google workspace", "adobe",
            "dropbox", "slack", "zoom", "shopify", "square software",
            "freshbooks", "wave accounting", "xero", "sage software",
            "subscription", "saas", "software license", "app subscription",
            "apple icloud", "google storage",
        ],
    },
    # --- Bank / Financial Fees ---
    {
        "category": "Bank & Financial Fees",
        "schedule_c_line": "Line 27a – Other Expenses",
        "deductible": True,
        "keywords": [
            "bank fee", "monthly fee", "overdraft fee", "wire transfer fee",
            "service charge", "atm fee", "transaction fee", "merchant fee",
            "stripe fee", "paypal fee", "square fee", "processing fee",
            "finance charge", "interest expense",
        ],
    },
    # --- Advertising & Marketing ---
    {
        "category": "Advertising & Marketing",
        "schedule_c_line": "Line 8 – Advertising",
        "deductible": True,
        "keywords": [
            "advertising", "facebook ads", "google ads", "instagram ads",
            "linkedin ads", "yelp advertising", "marketing", "promotion",
            "flyers", "business cards", "signage", "logo design",
            "web design", "seo service", "email marketing", "mailchimp",
            "constant contact", "hootsuite", "social media",
        ],
    },
    # --- Taxes & Licenses ---
    {
        "category": "Taxes & Licenses",
        "schedule_c_line": "Line 23 – Taxes and Licenses",
        "deductible": True,
        "keywords": [
            "state tax", "sales tax", "property tax", "business license",
            "permit fee", "dot fee", "ifta", "heavy vehicle tax", "2290",
            "registration fee", "dmv fee", "license renewal", "tag renewal",
        ],
    },
    # --- Depreciation ---
    {
        "category": "Depreciation",
        "schedule_c_line": "Line 13 – Depreciation",
        "deductible": True,
        "keywords": [
            "depreciation", "section 179", "bonus depreciation", "amortization",
        ],
    },
    # --- Personal / Non-Deductible ---
    {
        "category": "Personal (Non-Deductible)",
        "schedule_c_line": "N/A – Not Deductible",
        "deductible": False,
        "keywords": [
            "walmart", "target", "costco", "sam's club", "kroger", "publix",
            "whole foods", "trader joe", "safeway", "aldi", "amazon personal",
            "netflix", "hulu", "spotify", "disney+", "hbo max",
            "clothing", "shoes", "apparel", "gym", "fitness",
            "salon", "spa", "beauty", "personal care",
            "toys", "games", "entertainment", "cinema", "movie",
            "personal transfer", "zelle", "venmo personal", "cash withdrawal",
            "atm withdrawal",
        ],
    },
]

# ---------------------------------------------------------------------------
# CLASSIFICATION LOGIC
# ---------------------------------------------------------------------------

def classify(desc: str, chase_category: str = "", tx_type: str = "") -> dict:
    """
    Classify a transaction into an IRS Schedule C category.

    Returns a dict with:
        category, schedule_c_line, deductible, confidence
    """
    text = f"{desc} {chase_category} {tx_type}".lower()
    text = re.sub(r"[^a-z0-9 &'./\\-]", " ", text)

    best_match = None
    best_score = 0

    for rule in CATEGORY_RULES:
        score = 0
        for kw in rule["keywords"]:
            if kw.lower() in text:
                # Longer keyword = stronger signal
                score += len(kw.split())
        if score > best_score:
            best_score = score
            best_match = rule

    if best_match and best_score > 0:
        confidence = "High" if best_score >= 2 else "Medium"
        return {
            "category": best_match["category"],
            "schedule_c_line": best_match["schedule_c_line"],
            "deductible": best_match["deductible"],
            "confidence": confidence,
        }

    # Default: uncategorized
    return {
        "category": "Uncategorized",
        "schedule_c_line": "Review Required",
        "deductible": False,
        "confidence": "Low",
    }


# ---------------------------------------------------------------------------
# FILE READERS
# ---------------------------------------------------------------------------

def normalize_rows(rows: list[list], headers: list[str]) -> list[dict]:
    """
    Map raw rows to normalized dicts with keys: date, description, amount.
    Auto-detects column positions by scanning header names.
    """
    DATE_HINTS = ["date", "fecha", "posting", "trans date", "transaction date"]
    DESC_HINTS = ["desc", "description", "memo", "details", "payee", "merchant",
                  "name", "narration", "particulars"]
    AMT_HINTS = ["amount", "amt", "debit", "credit", "charge", "payment",
                 "monto", "value", "sum", "total"]
    CAT_HINTS = ["category", "type", "cat", "transaction type", "chase category"]

    def best_col(hints):
        for h in hints:
            for i, header in enumerate(headers):
                if h in header.lower():
                    return i
        return None

    date_col = best_col(DATE_HINTS)
    desc_col = best_col(DESC_HINTS)
    amt_col  = best_col(AMT_HINTS)
    cat_col  = best_col(CAT_HINTS)

    # Fallback: guess by position
    if desc_col is None:
        desc_col = min(1, len(headers) - 1)
    if amt_col is None:
        amt_col = min(2, len(headers) - 1)

    normalized = []
    for row in rows:
        if not row:
            continue
        date  = str(row[date_col]).strip() if date_col is not None and date_col < len(row) else ""
        desc  = str(row[desc_col]).strip() if desc_col < len(row) else ""
        cat   = str(row[cat_col]).strip()  if cat_col is not None and cat_col < len(row) else ""

        raw_amt = str(row[amt_col]).strip() if amt_col < len(row) else "0"
        # Remove currency symbols and commas
        raw_amt = re.sub(r"[^\d.\-]", "", raw_amt)
        try:
            amount = float(raw_amt) if raw_amt not in ("", "-") else 0.0
        except ValueError:
            amount = 0.0

        if not desc or desc.lower() in ("description", "memo", "details"):
            continue

        normalized.append({
            "date": date,
            "description": desc,
            "amount": amount,
            "chase_category": cat,
        })

    return normalized


def read_csv(file_path: str) -> list[dict]:
    """Read a CSV bank statement and return normalized transactions."""
    with open(file_path, newline="", encoding="utf-8-sig", errors="replace") as f:
        sample = f.read(4096)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        except csv.Error:
            dialect = csv.excel
        reader = csv.reader(f, dialect)
        rows = list(reader)

    if not rows:
        return []

    # Find header row (first non-empty row)
    header_idx = 0
    for i, row in enumerate(rows):
        if any(cell.strip() for cell in row):
            header_idx = i
            break

    headers = [c.strip() for c in rows[header_idx]]
    data_rows = rows[header_idx + 1:]
    return normalize_rows(data_rows, headers)


def read_excel(file_path: str) -> list[dict]:
    """Read an Excel bank statement and return normalized transactions."""
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    ws = wb.active

    all_rows = []
    for row in ws.iter_rows(values_only=True):
        all_rows.append([str(c) if c is not None else "" for c in row])

    wb.close()

    if not all_rows:
        return []

    # Find header row
    header_idx = 0
    for i, row in enumerate(all_rows):
        if any(str(c).strip() for c in row):
            header_idx = i
            break

    headers = [str(c).strip() for c in all_rows[header_idx]]
    data_rows = all_rows[header_idx + 1:]
    return normalize_rows(data_rows, headers)


def read_pdf(file_path: str) -> list[dict]:
    """Extract transactions from a PDF bank statement."""
    if not PDF_SUPPORT:
        raise RuntimeError("pdfplumber not installed. Cannot parse PDF files.")

    # Regex to capture: date  description  amount
    TX_PATTERN = re.compile(
        r"(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})"   # date
        r"\s+(.+?)\s+"                             # description
        r"([\-]?\$?[\d,]+\.\d{2})"                # amount
    )

    transactions = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                m = TX_PATTERN.search(line)
                if m:
                    date, desc, raw_amt = m.group(1), m.group(2).strip(), m.group(3)
                    raw_amt = re.sub(r"[^\d.\-]", "", raw_amt)
                    try:
                        amount = float(raw_amt)
                    except ValueError:
                        amount = 0.0
                    transactions.append({
                        "date": date,
                        "description": desc,
                        "amount": amount,
                        "chase_category": "",
                    })

    return transactions


# ---------------------------------------------------------------------------
# EXCEL BUILDER
# ---------------------------------------------------------------------------

# Colors
DARK_BLUE  = "1F3864"
LIGHT_BLUE = "D6E4F0"
GREEN      = "C6EFCE"
GREEN_FONT = "276221"
RED        = "FFCCCC"
RED_FONT   = "9C0006"
YELLOW     = "FFEB9C"
YELLOW_FONT= "9C6500"
WHITE      = "FFFFFF"
GRAY       = "F2F2F2"

def _header_fill(color=DARK_BLUE):
    return PatternFill("solid", fgColor=color)

def _cell_fill(color):
    return PatternFill("solid", fgColor=color)

def _thin_border():
    s = Side(style="thin", color="AAAAAA")
    return Border(left=s, right=s, top=s, bottom=s)

def _header_font(color=WHITE, bold=True, size=11):
    return Font(name="Calibri", bold=bold, color=color, size=size)

def _normal_font(color="000000", bold=False, size=10):
    return Font(name="Calibri", bold=bold, color=color, size=size)

def _set_col_width(ws, col_idx, width):
    ws.column_dimensions[get_column_letter(col_idx)].width = width


def _build_all_transactions(wb, transactions):
    ws = wb.create_sheet("All Transactions")

    headers = [
        "Date", "Description", "Amount", "Category",
        "Schedule C Line", "Deductible", "Confidence", "Chase Category",
    ]
    col_widths = [14, 45, 14, 30, 35, 12, 12, 20]

    # Header row
    for col, (h, w) in enumerate(zip(headers, col_widths), start=1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill  = _header_fill(DARK_BLUE)
        cell.font  = _header_font()
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = _thin_border()
        _set_col_width(ws, col, w)

    ws.row_dimensions[1].height = 30

    # Data rows
    for row_idx, tx in enumerate(transactions, start=2):
        result = classify(tx["description"], tx.get("chase_category", ""), "")

        is_deductible = result["deductible"]
        row_fill_color = GREEN if is_deductible else RED
        font_color     = GREEN_FONT if is_deductible else RED_FONT

        if result["category"] == "Uncategorized":
            row_fill_color = YELLOW
            font_color     = YELLOW_FONT

        values = [
            tx.get("date", ""),
            tx.get("description", ""),
            tx.get("amount", 0.0),
            result["category"],
            result["schedule_c_line"],
            "Yes" if is_deductible else "No",
            result["confidence"],
            tx.get("chase_category", ""),
        ]

        for col, val in enumerate(values, start=1):
            cell = ws.cell(row=row_idx, column=col, value=val)
            cell.fill   = _cell_fill(row_fill_color)
            cell.font   = _normal_font(color=font_color)
            cell.border = _thin_border()
            if col == 3:  # Amount
                cell.number_format = '"$"#,##0.00'
                cell.alignment = Alignment(horizontal="right")
            elif col in (1, 6, 7):
                cell.alignment = Alignment(horizontal="center")
            else:
                cell.alignment = Alignment(horizontal="left", wrap_text=True)

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:H1"
    return ws


def _build_summary(wb, transactions):
    ws = wb.create_sheet("Summary by Category")

    # Aggregate
    summary = {}
    for tx in transactions:
        result = classify(tx["description"], tx.get("chase_category", ""), "")
        cat = result["category"]
        if cat not in summary:
            summary[cat] = {
                "category": cat,
                "schedule_c_line": result["schedule_c_line"],
                "deductible": result["deductible"],
                "count": 0,
                "total": 0.0,
            }
        summary[cat]["count"] += 1
        summary[cat]["total"] += abs(tx.get("amount", 0.0))

    # Sort: deductible first, then by total desc
    rows_data = sorted(
        summary.values(),
        key=lambda x: (not x["deductible"], -x["total"])
    )

    headers = ["Category", "Schedule C Line", "Deductible", "# Transactions", "Total Amount"]
    col_widths = [32, 38, 12, 16, 18]

    for col, (h, w) in enumerate(zip(headers, col_widths), start=1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill  = _header_fill(DARK_BLUE)
        cell.font  = _header_font()
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = _thin_border()
        _set_col_width(ws, col, w)

    ws.row_dimensions[1].height = 28

    total_deductible = 0.0
    total_non_deductible = 0.0

    for row_idx, item in enumerate(rows_data, start=2):
        is_ded = item["deductible"]
        fc = GREEN if is_ded else RED
        ff = GREEN_FONT if is_ded else RED_FONT

        if item["category"] == "Uncategorized":
            fc, ff = YELLOW, YELLOW_FONT

        vals = [
            item["category"],
            item["schedule_c_line"],
            "Yes" if is_ded else "No",
            item["count"],
            item["total"],
        ]
        for col, val in enumerate(vals, start=1):
            cell = ws.cell(row=row_idx, column=col, value=val)
            cell.fill   = _cell_fill(fc)
            cell.font   = _normal_font(color=ff)
            cell.border = _thin_border()
            if col == 5:
                cell.number_format = '"$"#,##0.00'
                cell.alignment = Alignment(horizontal="right")
            elif col in (3, 4):
                cell.alignment = Alignment(horizontal="center")

        if is_ded:
            total_deductible += item["total"]
        else:
            total_non_deductible += item["total"]

    # Totals section
    last = len(rows_data) + 2
    ws.cell(row=last, column=1, value="TOTAL DEDUCTIBLE EXPENSES").font = _header_font(color=GREEN_FONT)
    ws.cell(row=last, column=1).fill = _cell_fill(GREEN)
    ws.cell(row=last, column=5, value=total_deductible).number_format = '"$"#,##0.00'
    ws.cell(row=last, column=5).font = _header_font(color=GREEN_FONT, bold=True)
    ws.cell(row=last, column=5).fill = _cell_fill(GREEN)

    ws.cell(row=last + 1, column=1, value="TOTAL NON-DEDUCTIBLE").font = _header_font(color=RED_FONT)
    ws.cell(row=last + 1, column=1).fill = _cell_fill(RED)
    ws.cell(row=last + 1, column=5, value=total_non_deductible).number_format = '"$"#,##0.00'
    ws.cell(row=last + 1, column=5).font = _header_font(color=RED_FONT, bold=True)
    ws.cell(row=last + 1, column=5).fill = _cell_fill(RED)

    ws.freeze_panes = "A2"
    return ws


IRS_NOTES = [
    ("Fuel", "Line 9 – Car and Truck Expenses",
     "Keep mileage log OR actual expense receipts. Cannot deduct both standard mileage and actual expenses."),
    ("Truck Repair & Maintenance", "Line 9 – Car and Truck Expenses",
     "Only the business-use percentage is deductible. Keep records of business vs personal use."),
    ("Meals (50% Deductible)", "Line 24b – Meals",
     "Only 50% of business meal expenses are deductible. Must have business purpose documented."),
    ("Travel", "Line 24a – Travel",
     "Travel must be business-related and away from your tax home. Keep receipts and business purpose records."),
    ("Insurance", "Line 15 – Insurance",
     "Business insurance premiums are fully deductible. Health insurance for self-employed on Schedule 1."),
    ("Payroll & Labor", "Line 26 – Wages",
     "Employee wages fully deductible. 1099 contractors reported on Schedule C as well."),
    ("Professional Services", "Line 17 – Legal and Professional Services",
     "Legal, accounting, and consulting fees directly related to business are fully deductible."),
    ("Advertising & Marketing", "Line 8 – Advertising",
     "All ordinary and necessary advertising costs are fully deductible."),
    ("Rent & Lease", "Line 20b – Rent or Lease (Other)",
     "Rent for business property fully deductible. Vehicle lease: only business-use portion deductible."),
    ("Phone & Internet", "Line 25 – Utilities",
     "Only the business-use percentage is deductible. If phone is 60% business, deduct 60%."),
    ("Utilities", "Line 25 – Utilities",
     "Business utilities are fully deductible. Home office utilities require Form 8829."),
    ("Taxes & Licenses", "Line 23 – Taxes and Licenses",
     "Business licenses, IFTA, and 2290 heavy vehicle use tax are deductible."),
    ("Software & Subscriptions", "Line 27a – Other Expenses",
     "Business software subscriptions are fully deductible in the year paid."),
    ("Bank & Financial Fees", "Line 27a – Other Expenses",
     "Bank fees and merchant processing fees for business accounts are fully deductible."),
    ("Truck Parts & Supplies", "Line 22 – Supplies",
     "Supplies consumed or used during the tax year are deductible. Keep all receipts."),
    ("Depreciation", "Line 13 – Depreciation",
     "Use Form 4562. Section 179 allows immediate expensing of qualifying assets."),
    ("Personal (Non-Deductible)", "N/A",
     "Personal expenses are NOT deductible on Schedule C. Keep business and personal accounts separate."),
    ("Uncategorized", "Review Required",
     "These transactions need manual review. Categorize or consult your tax professional."),
]


def _build_irs_notes(wb, company_name, year, industry, entity, notes=""):
    ws = wb.create_sheet("IRS Notes")

    # Title block
    ws.merge_cells("A1:E1")
    title = ws.cell(row=1, column=1,
                    value=f"IRS Schedule C Tax Notes — {company_name} ({year})")
    title.fill  = _header_fill(DARK_BLUE)
    title.font  = Font(name="Calibri", bold=True, color=WHITE, size=14)
    title.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 36

    # Metadata
    meta = [
        ("Company", company_name),
        ("Tax Year", year),
        ("Industry", industry),
        ("Entity Type", entity),
        ("Generated", datetime.today().strftime("%Y-%m-%d")),
    ]
    for i, (k, v) in enumerate(meta, start=2):
        ws.cell(row=i, column=1, value=k).font = _normal_font(bold=True)
        ws.cell(row=i, column=2, value=v).font = _normal_font()

    # Client notes block (if provided)
    if notes and notes.strip():
        notes_row = len(meta) + 2
        ws.merge_cells(f"A{notes_row}:E{notes_row}")
        notes_label = ws.cell(row=notes_row, column=1, value="Client Notes / Important Expenses")
        notes_label.fill = _header_fill("#B45309")
        notes_label.font = Font(name="Calibri", bold=True, color=WHITE, size=11)
        notes_label.alignment = Alignment(horizontal="left", vertical="center")
        ws.row_dimensions[notes_row].height = 22

        notes_val_row = notes_row + 1
        ws.merge_cells(f"A{notes_val_row}:E{notes_val_row}")
        notes_cell = ws.cell(row=notes_val_row, column=1, value=notes.strip())
        notes_cell.font = _normal_font()
        notes_cell.alignment = Alignment(wrap_text=True, vertical="top")
        notes_cell.fill = _cell_fill("#FFFBEB")
        ws.row_dimensions[notes_val_row].height = max(60, len(notes.strip()) // 3)

    # Column headers — shift down if notes block was added
    extra_rows = 2 if (notes and notes.strip()) else 0
    header_row = len(meta) + 3 + extra_rows
    headers = ["Category", "Schedule C Line", "IRS Notes / Rules"]
    col_widths = [30, 35, 70]
    for col, (h, w) in enumerate(zip(headers, col_widths), start=1):
        cell = ws.cell(row=header_row, column=col, value=h)
        cell.fill  = _header_fill(DARK_BLUE)
        cell.font  = _header_font()
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = _thin_border()
        ws.column_dimensions[get_column_letter(col)].width = w

    ws.row_dimensions[header_row].height = 24

    for r_idx, (cat, line, note) in enumerate(IRS_NOTES, start=header_row + 1):
        fill_color = LIGHT_BLUE if r_idx % 2 == 0 else GRAY
        for col, val in enumerate([cat, line, note], start=1):
            cell = ws.cell(row=r_idx, column=col, value=val)
            cell.fill   = _cell_fill(fill_color)
            cell.font   = _normal_font()
            cell.border = _thin_border()
            cell.alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[r_idx].height = 40

    ws.freeze_panes = f"A{header_row + 1}"
    return ws


def build_excel(
    transactions: list[dict],
    company_name: str,
    year: str,
    industry: str,
    entity: str,
    notes: str = "",
) -> str:
    """
    Build a formatted Excel workbook with 3 sheets:
      1. All Transactions
      2. Summary by Category
      3. IRS Notes
    Returns the path to the generated file.
    """
    wb = openpyxl.Workbook()
    # Remove default sheet
    default = wb.active
    wb.remove(default)

    _build_all_transactions(wb, transactions)
    _build_summary(wb, transactions)
    _build_irs_notes(wb, company_name, year, industry, entity, notes)

    out_dir = tempfile.gettempdir()
    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", company_name)
    out_path = os.path.join(out_dir, f"{safe_name}_IRS_Categories_{year}.xlsx")
    wb.save(out_path)
    return out_path


# ---------------------------------------------------------------------------
# MAIN ENTRY POINT
# ---------------------------------------------------------------------------

def process_file(
    file_path: str,
    file_ext: str,
    company_name: str,
    year: str,
    industry: str,
    entity: str,
) -> str:
    """
    Read the uploaded file, classify each transaction, and return
    the path to the generated Excel report.
    """
    ext = file_ext.lower()

    if ext == "csv":
        transactions = read_csv(file_path)
    elif ext in ("xlsx", "xls"):
        transactions = read_excel(file_path)
    elif ext == "pdf":
        transactions = read_pdf(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    if not transactions:
        raise ValueError(
            "No transactions found in the file. "
            "Please verify the file format and that it contains data rows."
        )

    return build_excel(transactions, company_name, year, industry, entity)


def process_file_full(
    file_path: str,
    file_ext: str,
    company_name: str,
    year: str,
    industry: str,
    entity: str,
    notes: str = "",
) -> tuple:
    """
    Like process_file but also returns a summary dict.
    Returns (excel_path, summary_dict).
    """
    ext = file_ext.lower()

    if ext == "csv":
        transactions = read_csv(file_path)
    elif ext in ("xlsx", "xls"):
        transactions = read_excel(file_path)
    elif ext == "pdf":
        transactions = read_pdf(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    if not transactions:
        raise ValueError(
            "No transactions found in the file. "
            "Please verify the file format and that it contains data rows."
        )

    total_income   = sum(tx["amount"] for tx in transactions if tx["amount"] > 0)
    total_expenses = sum(abs(tx["amount"]) for tx in transactions if tx["amount"] < 0)
    net            = total_income - total_expenses

    cat_totals: dict = {}
    for tx in transactions:
        result = classify(tx["description"], tx.get("chase_category", ""), "")
        cat = result["category"]
        cat_totals[cat] = cat_totals.get(cat, 0.0) + abs(tx["amount"])

    categories = sorted(
        [{"category": c, "total": round(t, 2)} for c, t in cat_totals.items()],
        key=lambda x: -x["total"],
    )

    summary = {
        "total_income":      round(total_income, 2),
        "total_expenses":    round(total_expenses, 2),
        "net":               round(net, 2),
        "categories":        categories,
        "transaction_count": len(transactions),
    }

    excel_path = build_excel(transactions, company_name, year, industry, entity, notes)
    return excel_path, summary
