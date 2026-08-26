# Native Connector Priority Ranking

**Mission:** GCC-MULTITENANT-PILOT-HARDENING-001  
**Status:** Recommendation only — **DO NOT IMPLEMENT YET**

---

## Current certified ingestion

| Path | Status |
|------|--------|
| CSV import | **LIVE** |
| XLSX import | **LIVE** |
| QuickBooks Online | Coming soon |
| Xero | Coming soon |
| Plaid (banking) | Coming soon |
| Stripe, Gusto, HubSpot, Salesforce, etc. | Coming soon |

Pilot customers can onboard and get full dashboard, forecast, KPI, AI CFO, and value-creation value **after CSV/XLSX import** without native connectors.

---

## Scoring methodology (1–5, higher = better for first build)

| Connector | Pilot demand | Target-customer frequency | Implementation complexity (inverse) | Security/compliance burden (inverse) | Data coverage | Commercial friction removed | Maintenance burden (inverse) | **Total** |
|-----------|-------------|---------------------------|-------------------------------------|--------------------------------------|---------------|----------------------------|------------------------------|-----------|
| **QuickBooks Online** | 5 | 5 | 3 | 3 | 5 | 5 | 3 | **29** |
| **Xero** | 3 | 3 | 3 | 3 | 4 | 4 | 3 | **23** |
| **Plaid (banking)** | 4 | 4 | 2 | 2 | 3 | 4 | 2 | **21** |
| HubSpot (CRM) | 2 | 3 | 4 | 4 | 2 | 2 | 4 | **21** |
| Stripe (payments) | 2 | 3 | 3 | 3 | 2 | 2 | 3 | **18** |

*Scores reflect founder-led / lower-middle-market pilot profile ($1M–$50M revenue) and current GCC product focus on **financial intelligence**, not full CRM.*

---

## Ranked priority

1. **QuickBooks Online** — highest composite score  
2. **Xero** — strong for international / Xero-native firms  
3. **Plaid** — cash visibility without full GL; complements accounting, not replaces CSV for P&L depth  
4. HubSpot — lower priority until financial core is saturated  
5. Stripe — payment rail, not primary GL source for target ICP  

---

## First native connector recommendation

```
FIRST_NATIVE_CONNECTOR_RECOMMENDATION = QuickBooks Online
```

**WHY:** Dominant accounting system among US founder-led and SMB pilot targets; unlocks recurring sync of P&L, AR/AP, and cash-adjacent accounts; highest asked-for connector in sales conversations; existing stub (`int-1`) and partial env scaffolding in repo.

**EXPECTED_CUSTOMER_VALUE:** Eliminates manual CSV export/upload for QBO users; faster time-to-dashboard after onboarding; higher pilot conversion when “connect accounting” is the expected norm.

**IMPLEMENTATION_RISK:** OAuth app review, token refresh, chart-of-accounts mapping, multi-entity edge cases, ongoing Intuit API changes, and security review for stored tokens. **Medium–high** — not a weekend feature.

**DO_NOT_IMPLEMENT_YET:** No production-certified native connector today. Trigger build when **first external pilot** blocks on QBO friction (e.g. refuses CSV, demands live sync) — not checklist completion.

---

## Decision gate (next mission)

| Signal | Next mission |
|--------|----------------|
| Pilot accepts CSV/XLSX within 15 minutes | **FIRST REAL EXTERNAL PILOT** |
| Pilot stalls at “I won’t export from QuickBooks” | **FIRST NATIVE CONNECTOR** (QBO) |
| Multiple pilots on Xero | Re-score; Xero may jump to #1 |

**Default:** **FIRST REAL EXTERNAL PILOT** if CSV/XLSX proves commercially acceptable.
