# IA Classification Logic Reference

## Model Configuration

- **Model**: `claude-opus-4-6` (Anthropic)
- **Max Tokens**: 8096
- **API Key**: Environment variable `ANTHROPIC_API_KEY`
- **Chunk Size**: 50 transactions per API call (to avoid token limits)

---

## Input Format

### Transaction Object
```python
{
    "date": str,                  # ISO date or various formats
    "description": str,           # Bank transaction description (often truncated)
    "amount": float,              # Absolute value in USD
    "chase_category": str         # Optional, from bank
}
```

### AI Call Parameters
```
POST /classify
FormData:
  - file: UploadFile (CSV, XLSX, XLS, or PDF)
  - company_name: str
  - year: str (e.g., "2025")
  - industry: str (e.g., "Other", "Food Service & Restaurants", etc.)
  - entity: str (e.g., "Sole Proprietor (Schedule C)")
  - notes: str (optional, client notes about major purchases)
```

---

## Processing Pipeline

### Step 1: File Parsing
Parse file based on extension (`.csv`, `.xlsx`, `.xls`, `.pdf`):
- **CSV**: Auto-detect delimiter (`,`, `;`, `\t`, `|`)
- **Excel**: Read from active sheet using openpyxl
- **PDF**: Try table extraction first, fall back to text regex parsing

Auto-detect columns by keywords:
- **Date**: "date", "fecha", "posting", "trans date", "post date"
- **Description**: "desc", "description", "memo", "details", "payee", "merchant", "name"
- **Amount**: "amount", "amt", "debit", "charge", "monto", "value", "credit"
- **Category**: "category", "type", "transaction type", "chase category"

### Step 2: Transaction Filtering

**Exclude these keywords** (case-insensitive):
```
"payment thank you", "thank you for your payment", "autopay", "auto pay",
"credit card payment", "credit card pymt", "online payment", "mobile payment",
"electronic payment", "minimum payment", "automatic payment"
```

**If amount > 0 (credit/deposit), exclude if description contains**:
```
"payment", "thank you", "credit", "transfer", "refund", "deposit",
"paycheck", "direct dep", "payroll deposit", "zelle", "venmo", "cashapp", "cash app"
```

**If transaction type in**: `["payment", "credit", "transfer", "credit card payment", "credit card pymt"]`
→ exclude

Result: Only **negative amounts** (expenses) pass through.

### Step 3: AI Classification (Batched)

**Claude Prompt** (Spanish):
```
Eres un experto en impuestos de negocios en USA.
Clasifica cada gasto según el IRS Schedule C para un negocio de industria: {industry}

TRANSACCIONES:
{transaction_list}

REGLAS IMPORTANTES — Los bancos truncan nombres, busca el patrón:
- Airlines (Southwest/WN, Delta/DL, United/UA, American/AA, Spirit, Frontier, JetBlue, ALLEGIANT) = Travel | Schedule C - Line 24a
- Hotels (Marriott, Hilton, Hyatt, Airbnb, Holiday Inn, Best Western, Comfort Inn, Hampton Inn, VRBO) = Travel | Schedule C - Line 24a
- Uber, Lyft, LYFT *RIDE, UBER *TRIP = Travel | Schedule C - Line 24a
- Gas stations (Shell, BP, Chevron, Exxon, Mobil, Kwik Trip, Pilot, Loves, Flying J, Circle K, Speedway, Racetrac, Wawa, QT, Valero, Sunoco, Murphy, GetGo) = Fuel | Schedule C - Line 9
- Restaurants/food (McDonald's, MCD, Starbucks, SBUX, Subway, Chipotle, Taco Bell, Domino's, Pizza, KFC, Popeyes, Chick-fil-A, Sonic, Arby's, Wendy's, Panera, Dunkin, IHOP, Denny's, Waffle House, Applebee's, any TST* or SQ * at food place) = Meals (50% Deductible) | Schedule C - Line 24b
- Food delivery (Uber Eats, UBER* EATS, DoorDash, DD *, GrubHub, Postmates, Instacart food) = Meals (50% Deductible) | Schedule C - Line 24b
- Phone/Internet (AT&T, Verizon, T-Mobile, Comcast, Xfinity, Spectrum, Cox, CenturyLink, Cricket) = Utilities | Schedule C - Line 25
- Software (Microsoft, MSFT, Adobe, Google, AWS, Amazon Web, Zoom, Slack, QuickBooks, Intuit, Dropbox, Shopify, Squarespace, Wix, HubSpot, Mailchimp, Canva) = Software & Subscriptions | Schedule C - Line 27a
- Payroll (Gusto, ADP, Paychex, Rippling, Zenefits) = Wages & Salaries | Schedule C - Line 26
- Insurance (Geico, Progressive, State Farm, Allstate, Nationwide, Liberty Mutual, Travelers, Farmers, USAA, any *INSURANCE*) = Insurance | Schedule C - Line 15
- Rent/Lease/Storage (Public Storage, Extra Space, U-Haul storage, any RENT or LEASE) = Rent & Lease | Schedule C - Line 20b
- Legal/CPA/Accounting/Consulting = Legal & Professional | Schedule C - Line 17
- Advertising (Facebook, META *, Google Ads, Instagram, LinkedIn, Yelp, any *ADS*) = Advertising | Schedule C - Line 8
- Auto repair (AutoZone, O'Reilly, OREILLY, Advance Auto, Napa Auto, Jiffy Lube, Firestone, Midas, Pep Boys, Valvoline, Meineke, Maaco, any *AUTO REPAIR*) = Car & Truck Expenses | Schedule C - Line 9
- Tolls/Parking (IPASS, EZPass, BESTPASS, ParkWhiz, SpotHero, any PARKING, any TOLL) = Tolls & Parking | Schedule C - Line 9
- Bank fees, interest, Stripe, PayPal, Square (SQ *), Clover, Toast (TST*) fees = Bank & Processing Fees | Schedule C - Line 27a
- Amazon (AMZN MKTP, AMAZON.COM), Office Depot, Staples, Home Depot, Lowe's, Costco Business = Supplies | Schedule C - Line 22
- Walmart (WM SUPERCENTER, WALMART), Target, Costco personal, Sam's Club personal = Personal (Non-Deductible) | N/A
- Netflix, Hulu, Spotify, Disney+, HBO, Apple TV = Personal (Non-Deductible) | N/A
- Si no encaja en ninguna categoría de negocio, clasifica como la más cercana (NO dejes sin categorizar)

Responde SOLO con un JSON array, sin texto extra ni markdown:
[
  {"id": 1, "category": "Travel", "irs_line": "Schedule C - Line 24a", "deductible": "YES", "confidence": "HIGH"},
  {"id": 2, "category": "Meals (50% Deductible)", "irs_line": "Schedule C - Line 24b", "deductible": "50%", "confidence": "HIGH"}
]

Valores para deductible: "YES", "NO", "50%"
Valores para confidence: "HIGH", "MEDIUM", "LOW"

Clasifica los {count} gastos. TODOS deben tener una categoría asignada.
```

**Transaction List Format**:
```
1. SHELL MART | $50.23
2. STARBUCKS SBUX | $12.45
3. MARRIOTT HOTELS | $180.00
...
```

### Step 4: Fallback Classification (Local Keyword Matching)

If Claude API fails or no API key, use local keyword matching with these hardcoded rules:

| Category | IRS Line | Deductible | Keywords |
|----------|----------|-----------|----------|
| Fuel | Line 9 | YES | shell, bp, chevron, exxon, mobil, fuel, gasoline, gas station, circle k, pilot, loves, flying j, speedway, kwik trip, marathon, sunoco, valero, quiktrip, racetrac, wawa, murphy, getgo, casey, kum & go, holiday station, thorntons, sheetz, bucees, buc-ee, pump, 76 oil, 76gas |
| Car & Truck Expenses | Line 9 | YES | autozone, oreilly, advance auto, napa auto, jiffy lube, firestone, midas, pep boys, oil change, tire, brake, auto repair, car wash, truck repair, mechanic, valvoline, meineke, maaco, monro, christian brothers, take 5 oil, jiffy, tires plus, discount tire, ntb, sears auto, goodyear, bridgestone |
| Meals (50% Deductible) | Line 24b | 50% | mcdonald, mcd, burger king, bk, wendy, subway, taco bell, chipotle, panera, domino, pizza hut, little caesar, papa john, kfc, popeyes, chick-fil-a, cfa, sonic, arby, dairy queen, dq, dunkin, starbucks, sbux, tim horton, ihop, denny, waffle house, cracker barrel, applebee, chili, olive garden, red lobster, outback, texas roadhouse, grubhub, doordash, dd, ubereats, uber* eat, postmates, instacart, restaurant, cafe, diner, bakery, sushi, tst*, sq *coffee, sq *cafe, sq *bakery, sq *restaurant, sq *bar, sq *grill, sq *kitchen, sq *food, jersey mike, jimmy john, five guys, shake shack, in-n-out, whataburger, culver, raising cane, wingstop, zaxby, cook out, bojangles, hardee, carl's jr, jack in the box |
| Travel | Line 24a | YES | hotel, motel, inn, lodging, marriott, hilton, hyatt, airbnb, holiday inn, best western, comfort inn, hampton inn, courtyard, residence inn, fairfield, springhill, towneplace, embassy suites, doubletree, aloft, element, westin, sheraton, wyndham, la quinta, days inn, super 8, extended stay, vrbo, southwest air, delta air, united air, american air, spirit air, frontier air, jetblue, allegiant, alaska air, hawaiian air, sun country, flight, airfare, airline, air ticket, enterprise rent, hertz, avis, budget car, national car, alamo, thrifty car, dollar rent, fox rent, silvercar, turo, lyft *ride, uber *trip, uber trip, lyft ride, amtrak, greyhound, megabus |
| Tolls & Parking | Line 9 | YES | parking, toll, ezpass, ez pass, ipass, i-pass, bestpass, parkwhiz, spothero, turnpike, expressway, tollway, laparking, park mobile, parkmobile, paybyphone, meterfeeder |
| Insurance | Line 15 | YES | insurance, insur, geico, progressive, state farm, allstate, nationwide, liberty mutual, travelers, farmers ins, usaa, hartford, chubb, aig, workers comp, general liability |
| Wages & Salaries | Line 26 | YES | payroll, gusto, adp, paychex, rippling, zenefits, wages, salary, direct deposit payroll, bamboohr |
| Utilities | Line 25 | YES | verizon, at&t, att, t-mobile, tmobile, comcast, xfinity, spectrum, cox comm, centurylink, lumen, windstream, frontier comm, cricket wireless, boost mobile, metro pcs, metropcs, electric, electricity, water bill, utility, internet bill, duke energy, con edison, pge, pg&e, dte energy, dominion, xcel energy, westar, evergy, national grid |
| Rent & Lease | Line 20b | YES | rent, lease, storage unit, office space, public storage, extra space, life storage, cubesmart, u-haul storage, uhaul storage, simply storage, warehouse, coworking, wework, regus, spaces |
| Legal & Professional | Line 17 | YES | attorney, lawyer, legal, accountant, cpa, bookkeeping, consulting, notary, paralegal, enrolled agent, tax prep, h&r block, jackson hewitt, legalzoom |
| Software & Subscriptions | Line 27a | YES | quickbooks, intuit, microsoft, msft, google workspace, gsuite, adobe, dropbox, slack, zoom, shopify, squarespace, wix, aws, amazon web, digitalocean, linode, heroku, github, hubspot, mailchimp, klaviyo, constantcontact, hootsuite, buffer, canva, figma, notion, asana, monday.com, trello, basecamp, freshbooks, xero, wave acc, sage, subscription, saas, software lic, app store, google play, apple.com/bill, icloud, spotify business, pandora business |
| Advertising | Line 8 | YES | facebook, meta, google ads, instagram, linkedin ads, twitter ads, snapchat ads, tiktok ads, yelp, nextdoor ads, pinterest ads, advertising, marketing, promotion, signage, print ad, radio ad, tv ad, billboard, seo, sem, ppc |
| Supplies | Line 22 | YES | office depot, officemax, staples, home depot, homedepot, lowe's, lowes, menards, ace hardware, true value, amzn mktp, amazon.com, amazon mktpl, uline, grainger, fastenal, harbor freight, northern tool, supplies, tools |
| Bank & Processing Fees | Line 27a | YES | bank fee, monthly fee, stripe, paypal, sq, square inc, clover, toast, tst*, processing fee, merchant fee, service charge, overdraft, nsf fee, wire fee, finance charge, interest charge, late fee |
| Personal (Non-Deductible) | N/A | NO | wm supercenter, walmart, wal-mart, target, costco, sam's club, samsclub, kroger, publix, whole foods, wholefds, trader joe, safeway, aldi, heb, meijer, giant, stop & shop, netflix, hulu, spotify, disney+, hbo, amazon prime video, apple tv, peacock, paramount+, gym, fitness, planet fitness, anytime fitness, la fitness, ymca, salon, spa, nail, hair cut, barber, casino, gambling, lottery |

Scoring: Count keyword matches in lowercase description. Pick highest score category. If no matches or score < 1, default to "Other Business Expense" with confidence "LOW".

---

## Output Format

### Classification Result (per transaction)
```json
{
  "id": 1,
  "category": "Travel",
  "irs_line": "Schedule C - Line 24a",
  "deductible": "YES",
  "confidence": "HIGH"
}
```

**Deductible Values**: `"YES"`, `"NO"`, `"50%"`  
**Confidence Values**: `"HIGH"`, `"MEDIUM"`, `"LOW"`

### Summary (returned to frontend)
```json
{
  "total_income": 0.0,
  "total_expenses": 1250.45,
  "net": -1250.45,
  "categories": [
    {"category": "Travel", "total": 500.00},
    {"category": "Meals (50% Deductible)", "total": 250.45}
  ],
  "transaction_count": 42
}
```

### Excel Output
Three sheets:

1. **All Transactions**: Columns: Date | Description | Amount | Category | Schedule C Line | Deductible | Confidence
   - Row colors: Green if YES, Yellow if 50% or Uncategorized, Red if NO
   - Frozen header, auto-filter enabled

2. **Summary by Category**: Columns: Category | Schedule C Line | Deductible | # Transactions | Total Amount
   - Subtotal rows for "TOTAL DEDUCTIBLE EXPENSES" and "TOTAL NON-DEDUCTIBLE"
   - Deductible total = sum of YES + (50% × 50%)

3. **IRS Notes**: Metadata (Company, Year, Industry, Entity Type, Date Generated) + Optional client notes + Reference table of all categories with their IRS rules

---

## Error Handling

1. **Missing API Key**: Raise ValueError to user; do not silently fall back
2. **Claude API Error**: Log error, silently use fallback keyword matching
3. **Parse Error**: Re-try with different delimiters/patterns; if all fail, raise to user
4. **No Transactions After Filter**: Raise error "No expense transactions found after filtering"

---

## Cost Considerations

- **Per transaction**: ~50 chars in prompt
- **Per batch**: 50 transactions ≈ 2.5K prompt tokens, ~500 output tokens
- **Example**: 1000 transactions = 20 batches = ~60K input tokens, worst case ~$0.18 (at Opus 4 pricing)

Chunking at 50 prevents token explosion and enables retry per chunk.

---

## Key Implementation Notes

1. **Transactions are always converted to absolute value** (positive) after filtering negatives
2. **Confidence scoring logic**: HIGH if matched multiple keywords, MEDIUM if 1–2, LOW if fallback
3. **Spanish prompt** but output JSON is language-neutral
4. **No transaction persistence** in current architecture — all stored in memory during request
5. **Industry parameter** is passed to prompt but only for context; doesn't fundamentally change rules
6. **Deductible 50%** entries (like meals) should be calculated on summary: total_deductible = YES_total + 0.5 × 50%_total
