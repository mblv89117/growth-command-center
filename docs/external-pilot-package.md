# External Pilot Package

**Version:** 1.0 · Post HVCG internal pilot  
**Public price:** $149/month (unchanged)  
**Ingestion:** CSV/XLSX primary path

---

## 1. First external pilot profile (READY)

Ideal first external pilot:

| Criterion | Why |
|-----------|-----|
| Trusted existing relationship | Low risk, honest feedback |
| Relatively clean financial data | CSV import succeeds quickly |
| Owner willing to provide feedback | Pilot value is learning |
| $1M–$50M revenue complexity | Enough to show GCC value |
| Low regulatory/data risk | No sensitive client data mixing |
| Clear cash visibility need | Founder/operator decision-maker |

**Do not onboard without explicit owner authorization.**

---

## 2. External pilot shortlist

```
EXTERNAL_PILOT_SHORTLIST = REQUIRES_ATLAS_SIDE_CONTEXT
```

The GCC agent does not have authoritative current-client CRM context. Candidate identification requires Atlas/HVCG client pipeline data (HVCG-05 scope). Do not invent client conditions.

---

## 3. Pilot offer options (non-binding)

**Internal HVCG pilot:** Free (HVCG owns the product).

**Future external pilot options** (owner approval required before offering):

| Option | Structure | Notes |
|--------|-----------|-------|
| Standard paid | $149/month Starter | Public pricing |
| Time-limited pilot | 30–60 days free, then $149 | Controlled feedback window |
| Founding customer | Discounted annual + feedback commitment | 3–5 max |

Do not set binding commercial terms without owner approval.

---

## 4. External pilot package contents

| Item | Location |
|------|----------|
| Customer onboarding checklist | `docs/first-pilot-readiness.md` §2 |
| Financial data checklist | `docs/hvcg-pilot-data-OWNER-INPUT-REQUIRED.md` (adapt per client) |
| Import templates | `docs/import-template-financial-snapshot.csv`, `docs/import-template-monthly-trends.csv` |
| Known limitations | `docs/first-pilot-readiness.md` §4 |
| Support process | `docs/first-pilot-readiness.md` §5 |
| Rollback process | `docs/first-pilot-readiness.md` §5 |
| Issue triage | `docs/first-pilot-readiness.md` §6 |
| 15-minute demo path | `docs/first-pilot-readiness.md` §8 |
| Privacy / security | Tenant isolation per-org; email verification required; no cross-tenant data access; demo orgs labeled synthetic |

---

## 5. Customer journey (external)

```
Landing → Signup → Email confirm → Onboarding → Import CSV →
Dashboard → Forecast → KPIs → AI CFO → Value Creation → Weekly return
```

**Success metric:** Founder understands cash position and next action without developer help.

---

## 6. Automated regression

- `npm run uat:golive` — service-role regression (optional, when secret configured)
- `npm run pilot:hvcg` — **real-user** certification (preferred for go-live PASS)

```
AUTOMATED_GOLIVE_REGRESSION = READY_PENDING_SECURE_SECRET_CONFIGURATION
```
