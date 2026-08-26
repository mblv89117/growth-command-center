# GCC First Pilot Readiness Pack

**Version:** 1.0 · Post `migration-commercial.sql`  
**Production:** https://growth-command-center-lbnt.vercel.app  
**Public price:** $149/month (Starter)

---

## 1. First-Pilot Checklist (Operator)

Before inviting a pilot customer:

- [ ] Confirm Supabase Auth URLs include production `/auth/callback`
- [ ] Confirm Resend SMTP active for team invites
- [ ] Confirm `ANTHROPIC_API_KEY` set in Vercel (AI CFO)
- [ ] Pilot customer receives signup link: `/signup`
- [ ] Share import template: `docs/import-template-financial-snapshot.csv`
- [ ] Set expectation: CSV/XLSX import is primary ingestion path
- [ ] QuickBooks/Plaid: optional, not required for pilot
- [ ] Schedule 30-min onboarding walkthrough (optional)

After pilot signs up:

- [ ] Verify unique org created (not `org-apex`)
- [ ] Pilot completes `/onboarding`
- [ ] Pilot imports financial snapshot CSV
- [ ] Pilot reviews `/dashboard`, `/cash-forecast`, `/value-creation`
- [ ] Pilot asks AI CFO 2–3 questions
- [ ] Collect feedback within 7 days

---

## 2. Customer Onboarding Checklist (Send to Pilot)

1. **Create account** — https://growth-command-center-lbnt.vercel.app/signup  
   Use your real company name; this creates your private workspace.

2. **Confirm email** — Check inbox for Supabase confirmation link.

3. **Complete onboarding** — Answer company profile, priorities, and KPI targets.

4. **Import your data** — Go to **Integrations → Import data**  
   Download template: `docs/import-template-financial-snapshot.csv`  
   Fill in your numbers → Upload → Preview → Commit.

5. **Review executive dashboard** — Cash, working capital, KPIs, trends.

6. **Review cash forecast** — 13-week projection with assumptions.

7. **Ask AI CFO** — e.g. "What should I worry about this week?"

8. **Review value creation** — `/value-creation` for evidence-backed opportunities.

9. **Invite team** (optional) — Settings → Team.

---

## 3. Supported Import Template

**Financial Snapshot (single row):**

| Column | Required | Description |
|--------|----------|-------------|
| current_cash | Yes | Bank cash today |
| revenue_mtd | No | Revenue month-to-date |
| revenue_ytd | No | Revenue year-to-date |
| gross_profit | No | Gross profit MTD |
| net_profit | No | Net profit MTD |
| operating_expenses | No | OpEx MTD |
| accounts_receivable | No | AR balance |
| accounts_payable | No | AP balance |
| payroll_obligations | No | Next payroll due |
| ebitda | No | EBITDA MTD |

**Monthly Trends (multi-row):** `month,revenue,expenses,profit,cash`

See `docs/import-template-financial-snapshot.csv` and `docs/import-template-monthly-trends.csv`.

---

## 4. Known Limitations (Pilot)

| Area | Status |
|------|--------|
| CSV/XLSX import | **Supported** — primary ingestion |
| QuickBooks live sync | Partial — OAuth exists; not required for pilot |
| Plaid | Sandbox/demo only |
| Xero, HubSpot, etc. | Mock/labeled — not live |
| Stripe billing | Technically ready; not enabled for charging |
| Multi-org switching | Single org per user |
| Mobile | Responsive; desktop-first |
| Email confirmation | Required on signup (Supabase) |

---

## 5. Support & Rollback Procedure

**If pilot cannot sign up:**
- Check Supabase Auth logs
- Verify email confirmation delivered
- Resend confirmation from Supabase dashboard

**If import fails:**
- Check column headers match template
- Review preview errors before commit
- Check `gcc_import_jobs` and `gcc_job_runs` in Supabase

**If dashboard shows demo/empty data:**
- Confirm import committed successfully
- Trigger recompute: `POST /api/pipeline/recompute` (authenticated)
- Verify `gcc_financial_snapshots` for org

**Rollback (data):**
- Delete erroneous import rows from `gcc_financial_snapshots` / `gcc_monthly_trends`
- Re-import corrected CSV
- Re-run recompute

**Rollback (tenant):**
- Deactivate user in Supabase Auth
- Archive org in `gcc_organizations` (manual)

---

## 6. Issue Triage Process

| Severity | Examples | Response |
|----------|----------|----------|
| P0 | Cross-tenant data visible, auth bypass | Immediate — disable access, investigate |
| P1 | Import commit fails, dashboard blank after import | Same-day fix |
| P2 | AI CFO unavailable (503) | Check `ANTHROPIC_API_KEY` |
| P3 | UI polish, tooltip copy | Next sprint |

Escalation: GitHub issues on `mblv89117/growth-command-center`

---

## 7. Demo Tenant

**Existing demo orgs (seeded, labeled):**
- `org-apex` — Apex Construction Group (synthetic demo data)
- `org-summit` — Summit Renovations LLC (synthetic demo data)

Demo mode is **disabled in production**. For sales demos:
- Use seeded org via platform admin login, OR
- Run live signup → import small CSV in demo meeting

All demo data is labeled **"Seeded Demo Data"** or **"Demo Data"** in UI.

---

## 8. Sales Demo Flow (15 minutes)

1. **Landing** (`/`) — "Client Value OS for founders"
2. **Signup** — Create workspace with prospect company name
3. **Import** — Upload pre-filled CSV (2 min)
4. **Dashboard** — Cash, working capital, KPIs, deltas
5. **Cash Forecast** — 13-week view, risk periods
6. **AI CFO** — "What should I worry about?"
7. **Value Creation** — Evidence-backed opportunities
8. **Close** — "Your next action is ___" from AI CFO / value creation

**Do not claim:** live QuickBooks sync, live Plaid, or features labeled Mock.

---

## 9. Accounting Connectors

**Decision:** `DEFERRED_PENDING_CUSTOMER_SIGNAL`

CSV/XLSX is the business-useful ingestion path today. Build QuickBooks/Xero connectors only when:
- Pilot/customer explicitly requests it
- Import burden blocks conversion
- Data freshness requirements exceed monthly CSV cadence

---

## 10. Expected Customer Journey

```
Landing → Signup → Email confirm → Onboarding → Import CSV →
Dashboard (computed) → Forecast → KPIs → AI CFO → Value Creation →
Weekly return visits
```

**Success metric:** Founder understands cash position and next action without developer help.
