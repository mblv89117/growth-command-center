# Microsoft-native DB/Auth cutover checklist (runbook)

**Status:** Progress / scaffolding — **cutover is NOT complete**.  
**Production hosting SoT:** Azure Container Apps (not Vercel).  
**Current runtime:** Still Supabase DB + Auth until owner gates below pass.

Related:
- `docs/microsoft-native-migration-plan.md`
- `docs/entra-external-id-setup.md`
- `docs/missions/GCC-AZURE-NATIVE-BACKEND-AND-SUPABASE-EXIT-002-owner-gates.md`

---

## Branch policy note (Vercel)

Azure Container Apps + GitHub Actions (`azure-production.yml`) are the **source of truth** for production deploys.

Vercel preview/status checks on PRs are **legacy / non-blocking** for merge decisions once Azure build + UAT are green. Do not invest in fixing Vercel as a future platform. If a PR fails Vercel but Azure Docker/`npm run build` succeeds, treat Vercel as obsolete noise and document that in the PR.

Recommended branch protection: require Azure workflow / unit tests; do **not** require the Vercel status check.

---

## Pre-cutover evidence already in code

- [x] Entra External ID OIDC scaffold (`src/lib/auth/entra/*`) — off until `AUTH_PROVIDER=entra`
- [x] Dual-mode auth default = `supabase`
- [x] Azure PG pool prefers `AZURE_DATABASE_URL` (`src/lib/db/pool.ts`)
- [x] Deploy workflow can inject Azure PG + Entra secrets without flipping provider
- [x] Atlas ClientCode fail-closed dual-resolve + Hub HMAC ingest (secret **not** sent as `x-atlas-module-key`)
- [x] Unit tests: `npm run test:microsoft-native`

---

## Owner gates that still block live cutover

### 1) Azure Postgres provision

- [ ] Create/confirm Azure Database for PostgreSQL Flexible Server
- [ ] Set GitHub secret `AZURE_POSTGRES_ADMIN_PASSWORD`
- [ ] Run Stage 3 provision workflow (or equivalent) and capture FQDN
- [ ] Set GitHub / Container App secret `AZURE_DATABASE_URL`  
  (`postgresql://gccadmin@<FQDN>:5432/gcc?sslmode=require`, password URL-encoded)

### 2) Entra External ID (portal)

Follow `docs/entra-external-id-setup.md`:

- [ ] Customer/External ID tenant created (not workforce)
- [ ] App registration + redirect `https://app.growthcommandcenter.com/auth/callback`
- [ ] Secrets present:  
  `ENTRA_EXTERNAL_TENANT_ID`, `ENTRA_EXTERNAL_CLIENT_ID`, `ENTRA_EXTERNAL_CLIENT_SECRET`,  
  `ENTRA_EXTERNAL_REDIRECT_URI`, `SESSION_SECRET` (32+)
- [ ] Optional: `ENTRA_EXTERNAL_AUTHORITY`

### 3) Data migration + identity map

- [ ] `npm run db:migrate-to-azure-pg` (source Supabase → Azure PG)
- [ ] Row-count / FK / financial precision verification
- [ ] `npm run export:identity-map` and Entra user activation (no password-hash migration)

### 4) Flip cutover flags (only after Azure-native UAT PASS)

- [ ] Set `AUTH_PROVIDER=entra` and `NEXT_PUBLIC_AUTH_PROVIDER=entra` on Container App
- [ ] Deploy with **redeploy_infra=false** (protect custom domains)
- [ ] Smoke: login, tenant isolation, QuickBooks, billing, AI
- [ ] Freeze Supabase app writes; keep rollback window
- [ ] Later: revoke Supabase keys; retire Vercel production linkage

---

## Do not claim

- Live auth is Entra
- Live DB is Azure Postgres
- Supabase exit is finished

Claim only scaffolding + tests + owner-gate clarity until the boxes above are checked.
