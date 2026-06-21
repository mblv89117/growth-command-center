# Growth Command Center — Working Notes

Last updated: June 21, 2026  
Branch: `main` @ `904be72`  
Production URL: https://growth-command-center-lbnt.vercel.app

**Status: GO for controlled production use** — production UAT accepted (June 21, 2026).

**Agent prompt:** [`docs/production-qa-prompt.md`](docs/production-qa-prompt.md)

---

## Production launch — complete

- [x] Auth hardening, demo isolation, admin gate, PDF exports
- [x] Supabase `setup.sql` applied; health `{"status":"ok"}`
- [x] Vercel production env vars set; `ALLOW_DEMO_MODE` unset
- [x] Platform admin assigned (`manny.barela2026@gmail.com`)
- [x] Production redeploy @ `563f816`
- [x] Production UAT passed (login, admin, settings, reports, exports, honest 501 invites)

---

## Post-launch hardening checklist

Track after controlled production launch. Not blockers for current GO status.

- [x] **1. Configure Supabase SMTP (Resend)** — complete (June 21, 2026). Active provider: **Resend** (`smtp.resend.com`, sender `connect@highvaluecapitalgroup.com`, domain verified). Microsoft 365 SMTP was abandoned — Security Defaults blocked SMTP AUTH for `manny@highvaluecapitalgroup.com`. Team invites verified in production.
- [x] **2. Create non-admin test user and verify cross-tenant 403** — `gcc-uat-tenant@example.com` (`staff`, `org-apex`); cross-tenant API returns 403 (verified June 21, 2026)
- [ ] **3. Confirm Supabase Auth URLs** — Site URL and redirect allowlist include `https://growth-command-center-lbnt.vercel.app/auth/callback`
- [ ] **4. Configure QuickBooks / Stripe / Plaid when ready** — add Vercel env vars and OAuth redirect URIs; non-blocking until integrations needed
- [ ] **5. Add role checks for settings/team** — restrict save/invite to founder/admin roles, not all org members
- [ ] **6. Clean up org switcher** — remove mock multi-tenant UI; bind header to authenticated user's org only
- [ ] **7. Wire admin to real Supabase tenant data** — replace mock `PLATFORM_TENANTS` on `/admin` with live queries
- [ ] **8. Add invite audit trail** — e.g. `gcc_team_invites` table; log pending/sent/failed invites
- [x] **9. Add authenticated smoke tests in CI** — test user session; cover settings, exports, admin gate, tenant 403

---

## AI features

- [x] **AI safety foundation** — Zod validation, tenant-safe API helpers, pluggable rate limiting (`gcc_api_rate_limits`), commit `9721079`
- [x] **AI Advisor MVP — production verified** (June 21, 2026) — `/api/ai-advisor`, dashboard panel, Anthropic `claude-sonnet-4-6`, 20 req/user/hr; production checks pass (401/400/405 unauth, 403 cross-tenant, 200 same-org insights); commits `2c2813a`, `401ffca`, `281ca4c`
- [x] **AI Onboarding MVP — production verified** (June 21, 2026) — `/onboarding`, `/api/ai-onboard`, `/api/onboarding`, `gcc_onboarding_messages`, onboarding tools, dashboard CTA; manual UAT passed for `org-apex` (`onboarding_complete`, KPI targets, messages persisted); production smoke passes (401 unauth, 400 invalid body, 307 unauth `/onboarding` → `/login`); no global onboarding redirect; commit `904be72`
- [x] **KPI editing MVP — added, pending UAT** — `PATCH /api/kpis`, dashboard KPI edit modal, stoplight status/plan fields, `manual_override` for future integration sync; requires `supabase/kpi-editing.sql` before production use
- [ ] **Merge.dev integration** — not started. `connect_integration` records **pending/manual intent only** in `gcc_integration_connections` (no Merge link-token, no sync pipeline). Integration sync must respect manual KPI override (`manual_override`) until mapping rules are finalized.

**Next phase (pending approval):** Merge.dev planning **OR** KPI editing production UAT — do not start Merge.dev without explicit approval.

**Vercel env note:** Prefer canonical `ANTHROPIC_API_KEY` over lowercase `anthropic_api_key` (code supports fallback).

---

## Quick test commands

```bash
# Local
npm run dev
npm run lint && npx tsc --noEmit && npm run build
npm run smoke:auth

# Production smoke (unauthenticated)
export SMOKE_BASE_URL=https://growth-command-center-lbnt.vercel.app
curl -s "$SMOKE_BASE_URL/api/health"
curl -sI "$SMOKE_BASE_URL/dashboard" | grep -i location
curl -s -o /dev/null -w "%{http_code}\n" "$SMOKE_BASE_URL/api/integrations?organizationId=org-apex"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SMOKE_BASE_URL/api/auth/demo"

# AI Advisor production smoke (unauthenticated)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SMOKE_BASE_URL/api/ai-advisor" -H "Content-Type: application/json" -d '{"organizationId":"org-apex"}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SMOKE_BASE_URL/api/ai-advisor" -H "Content-Type: application/json" -d '{}'
curl -s -o /dev/null -w "%{http_code}\n" "$SMOKE_BASE_URL/api/ai-advisor"

# AI Onboarding production smoke (unauthenticated)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SMOKE_BASE_URL/api/ai-onboard" -H "Content-Type: application/json" -d '{"organizationId":"org-apex","message":"hi"}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SMOKE_BASE_URL/api/ai-onboard" -H "Content-Type: application/json" -d '{}'
curl -sI "$SMOKE_BASE_URL/onboarding" | grep -i location

# KPI editing smoke (unauthenticated)
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH "$SMOKE_BASE_URL/api/kpis" -H "Content-Type: application/json" -d '{"organizationId":"org-apex","kpiKey":"revenue_growth","value":12}'
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH "$SMOKE_BASE_URL/api/kpis" -H "Content-Type: application/json" -d '{}'
```

---

## App context

| Item | Value |
|------|-------|
| Production URL | https://growth-command-center-lbnt.vercel.app |
| Vercel project | `high-value-capital-group/growth-command-center-lbnt` |
| Supabase project ref | `igyaebtymornywjeidrl` |
| SQL setup | **`supabase/setup.sql`** only (do not run `fix-signup.sql`) |
| Demo mode (prod) | Disabled — do not set `ALLOW_DEMO_MODE` |
