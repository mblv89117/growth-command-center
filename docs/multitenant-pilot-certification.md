# Multi-Tenant Pilot Certification

**Mission:** GCC-MULTITENANT-PILOT-HARDENING-001  
**Production:** https://growth-command-center-lbnt.vercel.app

---

## Verified tenants

| Tenant | Identity | Org ID (known) | Auth | Onboarding | Financial data |
|--------|----------|----------------|------|------------|----------------|
| HVCG internal | High Value Capital Group LLC | `org-high-value-capital-group-llc-becf` | Confirmed (`+hvcg-pilot` alias) | Optional / in progress | Empty — awaiting import |
| Ryan mock customer | Ryan Gnieski (mock test) | Provisioned at signup (slug likely `ryan-gnieski` + suffix) | Owner-reported separate account | Owner-reported **complete** | Not yet imported in cert run |

**Do not use** real Prodigy Games / That's Kava / Atlas financial data for the Ryan mock tenant.

---

## Live ingestion (commercial truth)

| Capability | Status |
|------------|--------|
| CSV import | **LIVE** |
| XLSX import | **LIVE** |
| QuickBooks, Xero, Plaid, CRM, banking | **NOT LIVE** — Coming soon |
| File templates | `/templates/import-template-*.csv` |

---

## Automated certification

```bash
# HVCG + cross-tenant isolation probes (403 on org-apex, candidate Ryan slugs)
PILOT_EMAIL="..." PILOT_PASSWORD="..." npm run pilot:multitenant

# Full two-tenant journey with safe synthetic data on second tenant
PILOT_EMAIL="..." PILOT_PASSWORD="..." \
SECOND_TENANT_EMAIL="..." SECOND_TENANT_PASSWORD="..." \
npm run pilot:multitenant
```

Synthetic second-tenant files (safe mock data only):

- `docs/mock-second-tenant-financial-snapshot.csv`
- `docs/mock-second-tenant-monthly-trends.csv`

---

## Integration inventory (code + API contract)

| ID | Name | Production classification |
|----|------|---------------------------|
| int-1 | QuickBooks | COMING_SOON |
| int-2 | Xero | COMING_SOON |
| int-3 | Stripe | COMING_SOON |
| int-4 | Plaid | COMING_SOON |
| int-5 | Gusto | COMING_SOON |
| int-6 | Buildertrend | COMING_SOON |
| int-7 | HubSpot | COMING_SOON |
| int-8 | Salesforce | COMING_SOON |
| int-9 | Jobber | COMING_SOON |
| int-10 | Google Sheets | COMING_SOON |
| — | CSV / XLSX file import | **LIVE** |

Production API returns `capabilities.nativeConnectorsLive: false` and normalizes mock “connected” states to disconnected.

---

## Customer journey (post-onboarding)

```
SIGNUP → EMAIL CONFIRM → AI ONBOARDING → IMPORT CSV/XLSX → MAP → PREVIEW → COMMIT → DASHBOARD
```

Native connectors: clearly labeled **coming soon** on Integrations page; no dead OAuth / Connect buttons.

---

## Related docs

- `docs/external-pilot-package.md` — first external pilot offer
- `docs/native-connector-priority.md` — connector ranking (QBO recommended first, not built)
- `docs/hvcg-internal-pilot.md` — HVCG internal pilot status
