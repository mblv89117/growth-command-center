# Growth Command Center — Working Notes

Last updated: June 21, 2026  
Branch: `main` @ `563f816`  
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

- [ ] **1. Configure Supabase SMTP** — Authentication → Email → SMTP; verify SPF/DKIM; test team invite delivery
- [x] **2. Create non-admin test user and verify cross-tenant 403** — `gcc-uat-tenant@example.com` (`staff`, `org-apex`); cross-tenant API returns 403 (verified June 21, 2026)
- [ ] **3. Confirm Supabase Auth URLs** — Site URL and redirect allowlist include `https://growth-command-center-lbnt.vercel.app/auth/callback`
- [ ] **4. Configure QuickBooks / Stripe / Plaid when ready** — add Vercel env vars and OAuth redirect URIs; non-blocking until integrations needed
- [ ] **5. Add role checks for settings/team** — restrict save/invite to founder/admin roles, not all org members
- [ ] **6. Clean up org switcher** — remove mock multi-tenant UI; bind header to authenticated user's org only
- [ ] **7. Wire admin to real Supabase tenant data** — replace mock `PLATFORM_TENANTS` on `/admin` with live queries
- [ ] **8. Add invite audit trail** — e.g. `gcc_team_invites` table; log pending/sent/failed invites
- [ ] **9. Add authenticated smoke tests in CI** — test user session; cover settings, exports, admin gate, tenant 403

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
