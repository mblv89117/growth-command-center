# HVCG Pilot Data — Owner Input Required

**Status:** OWNER-INPUT-REQUIRED  
**Tenant:** High Value Capital Group LLC (production GCC)  
**Policy:** Do not invent HVCG financial figures. Use only authorized HVCG source data.

---

## Minimum dataset

Provide the smallest useful summary for the internal pilot:

| Field | Required | Source guidance |
|-------|----------|-----------------|
| `current_cash` | **Yes** | Bank / treasury balance as of today |
| `revenue_mtd` | Recommended | P&L or management summary |
| `revenue_ytd` | Recommended | P&L YTD |
| `gross_profit` | If available | P&L MTD |
| `net_profit` | If available | P&L MTD |
| `operating_expenses` | Recommended | OpEx MTD |
| `accounts_receivable` | If available | Balance sheet |
| `accounts_payable` | If available | Balance sheet |
| `payroll_obligations` | If available | Next payroll due |
| `ebitda` | If available | P&L MTD |

**Monthly trends** (3–12 rows in `hvcg-pilot-data-monthly-template.csv`):

| Column | Format | Example |
|--------|--------|---------|
| `month` | `YYYY-MM` | `2026-06` |
| `revenue` | number | monthly revenue |
| `expenses` | number | monthly expenses |
| `profit` | number | monthly net profit |
| `cash` | number | month-end cash |

---

## How to complete

1. Open `docs/hvcg-pilot-data-template.csv` — add **one data row** under the header.
2. Open `docs/hvcg-pilot-data-monthly-template.csv` — add **3–12 monthly rows** if history is available.
3. Do **not** import client financial data into the HVCG tenant.
4. Import via production: **Integrations → Import data** after email confirmation and onboarding.

---

## After import

Run automated real-user certification (no service role):

```bash
PILOT_EMAIL="your-confirmed-email" \
PILOT_PASSWORD="your-password" \
PILOT_SNAPSHOT_CSV="docs/hvcg-pilot-data-filled.csv" \
PILOT_TRENDS_CSV="docs/hvcg-pilot-data-monthly-filled.csv" \
npm run pilot:hvcg
```

Or import manually in the UI, then run without CSV paths to verify dashboard/forecast/KPI/AI only.
