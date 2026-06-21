# Growth Command Center — Working Notes

Last updated: June 21, 2026  
Branch: `main` (production readiness merged via PR #1 @ `b7969d8`)

Use this file as a running checklist for deployment and follow-up work.

**Agent prompt:** [`docs/production-qa-prompt.md`](docs/production-qa-prompt.md) — orchestrator + sub-agent production QA workflow.

---

## Production readiness — complete

Merged to `main` (PR #1). Launch blockers addressed:

- [x] Auth middleware + dashboard layout redirect unauthenticated users
- [x] Sensitive API routes use `requireApiAccess()` / `requireAuth()`
- [x] Demo tenant isolation pinned to `org-apex` (cross-tenant → 403)
- [x] Admin gate: `platform_admin` only (profile-based, demo blocked)
- [x] PDF export fix (`serverExternalPackages: pdfkit`)
- [x] Settings/team honest responses (preview in demo; persist/invite or 501 in production)
- [x] Production `/api/health` minimal payload
- [x] `supabase/setup.sql` canonical; `fix-signup.sql` deprecated
- [x] Smoke test script: `npm run smoke:auth`

---

## Pre-deployment checklist

Do **not** deploy until all gates pass. Full detail in `README.md`.

### Supabase

- [ ] Run **`supabase/setup.sql`** in SQL Editor (do **not** run `fix-signup.sql`)
- [ ] Configure Auth URLs: Site URL + `https://<domain>/auth/callback`
- [ ] Configure SMTP for team invite emails
- [ ] Create `platform_admin` user if using `/admin`
- [ ] Optional: `npm run db:seed` for Apex/Summit demo financial data

### Vercel environment variables (required)

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] Confirm **`ALLOW_DEMO_MODE` is unset** in production

### Post-deploy smoke tests

```bash
export SMOKE_BASE_URL=https://your-production-domain

curl -s "$SMOKE_BASE_URL/api/health"                    # {"status":"ok"}
curl -sI "$SMOKE_BASE_URL/dashboard" | grep location    # → /login
curl -s -o /dev/null -w "%{http_code}\n" \
  "$SMOKE_BASE_URL/api/integrations?organizationId=org-apex"  # 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "$SMOKE_BASE_URL/api/auth/demo"                       # 403
```

Plus manual authenticated checks: settings save, team invite email, PDF/Excel export, admin gate, cross-tenant 403.

**Staging only:** `SMOKE_BASE_URL=<staging> npm run smoke:auth` (13 tests; requires demo enabled).

---

## Post-launch hardening (P2 — not launch blockers)

| Item | Notes |
|------|-------|
| Role checks on settings/team | Any authenticated org member can save settings or send invites |
| Signup org assignment | Users without `organization_id` in metadata default to `org-apex` |
| Org switcher UX | Header still lists mock orgs; API blocks cross-tenant, UI can confuse |
| Platform admin data | `/admin` renders mock `PLATFORM_TENANTS`; wire to Supabase |
| Invite audit trail | No `gcc_team_invites` table yet |
| Authenticated CI smoke tests | No test-user automation for prod-auth paths |
| README / docs drift | Keep in sync after feature changes |
| ESLint migration | `next lint` deprecated; migrate before Next.js 16 |

---

## Quick test commands (local)

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
npm run smoke:auth          # 13/13 with demo enabled on localhost

# Demo cookie
curl -c /tmp/gcc.txt -X POST http://localhost:3000/api/auth/demo

# Dev health (detailed)
curl http://localhost:3000/api/health

# Unauth redirect
curl -sI http://localhost:3000/dashboard | grep -i location

# Forecast validation
npx tsx scripts/validate-forecast.ts
```

---

## App context

| Item | Value |
|------|-------|
| URL (local) | http://localhost:3000 |
| Demo entry | Login → **Enter Demo Mode** (dev only; pinned to `org-apex`) |
| Sample tenant | Apex Construction Group (`org-apex`) |
| SQL setup | **`supabase/setup.sql`** only |
| Health (prod) | `{"status":"ok"}` minimal |
| Health (dev) | Full connection details + org count |

---

## Suggested next steps

1. Complete pre-deployment checklist above
2. Deploy to Vercel when approved (not yet deployed)
3. Run production smoke tests
4. Tackle P2 hardening items based on priority after launch
