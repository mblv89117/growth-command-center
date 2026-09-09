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

Root `vercel.json` has been **archived** to `archive/vercel/vercel.json` (see `archive/vercel/README.md`). Azure health ping (`.github/workflows/azure-health-ping.yml`) replaces the former Vercel cron.

Vercel preview/status checks on PRs are **legacy / non-blocking** for merge decisions once Azure build + UAT are green. Do not invest in fixing Vercel as a future platform. If a PR fails Vercel but Azure Docker/`npm run build` succeeds, treat Vercel as obsolete noise and document that in the PR.

Recommended branch protection: require Azure workflow + `npm run test:microsoft-native`; do **not** require the Vercel status check.

---

## Pre-cutover evidence already in code

- [x] Entra External ID OIDC scaffold (`src/lib/auth/entra/*`) — off until `AUTH_PROVIDER=entra`
- [x] Dual-mode auth default = `supabase`
- [x] Azure PG pool prefers `AZURE_DATABASE_URL` (`src/lib/db/pool.ts`)
- [x] **Data-plane dual-mode:** `src/lib/data/data-plane.ts` + `src/lib/data/active-runtime-plane.ts` route via Azure PG when URL set; Supabase path when unset.
  - **Dual-mode (this branch):** organizations, settings, dashboard, tenant aggregates, KPI/onboarding/integration stores, rate-limit, **connectors audit/provenance**, **Plaid bank accounts**, **imports commit**, **pipeline recompute**, **job runs**, **tenant provision**, **billing webhook/checkout/portal**, **AI advisor persistence**, **team invites (Entra token path)**, **auth profiles via Azure PG when active**.
  - **Still ACTIVE_RUNTIME / incomplete:** PDF import confirm (`/api/imports/pdf`), admin route role checks in middleware (Supabase profile read), legacy Bearer JWT via Supabase during dual-run, QuickBooks OAuth token refresh edge paths, live Plaid production sync.
- [x] Entra middleware session gate uses sealed cookie path only — no Supabase SSR when `AUTH_PROVIDER=entra`
- [x] Entra login/logout/callback routes + client auth context skip Supabase listener when `NEXT_PUBLIC_AUTH_PROVIDER=entra`
- [x] `validateProductionEnv`: Entra mode does not require Supabase keys; requires Entra + `SESSION_SECRET` + `AZURE_DATABASE_URL`
- [x] Migration tooling: `npm run db:migrate-to-azure-pg`, `npm run azure:validate-migration-structure` (no passwords)
- [x] Key Vault stub: `src/lib/secrets/azure-keyvault.ts` (env-first; ACA reference pattern documented)
- [x] Unit tests: `npm run test:microsoft-native` including **SUPABASE_DISABLED simulation**

---

## GCC_OWNER_GATE_READY criteria (not met until owner checks all)

1. Azure PostgreSQL provisioned; `AZURE_DATABASE_URL` set on Container App
2. Entra External ID app + secrets configured (`docs/entra-external-id-setup.md`)
3. `npm run db:migrate-to-azure-pg` completed with row-count verification
4. `npm run azure:validate-migration-structure` PASS
5. `npm run export:identity-map` + Entra user activation
6. Azure-native UAT PASS (login, tenant isolation, billing, imports, AI advisor)
7. **Only then:** set `AUTH_PROVIDER=entra` + `NEXT_PUBLIC_AUTH_PROVIDER=entra` on Container App

---

## SUPABASE_DISABLED_TEST status

**Implemented in CI/unit tests** (`scripts/microsoft-native-cutover.test.mjs`):

- Unset all `SUPABASE_*` / `NEXT_PUBLIC_SUPABASE_*`
- Set `AZURE_DATABASE_URL`, `AUTH_PROVIDER=entra`, `SESSION_SECRET`, Entra stubs
- Assert: `snapshotMicrosoftNativeRuntime` → `azure-postgres`, `validateProductionEnv` → `[]`, Entra session gate satisfied

This is a **simulation** — not proof of live cutover. Live Supabase remains rollback until owner gates pass.

---

## Owner gates that still block live cutover

### 1) Azure Postgres provision

- [ ] Create/confirm Azure Database for PostgreSQL Flexible Server
- [ ] Set GitHub secret `AZURE_POSTGRES_ADMIN_PASSWORD`
- [ ] Run Stage 3 provision workflow (or equivalent) and capture FQDN
- [ ] Set GitHub / Container App secret `AZURE_DATABASE_URL`

### 2) Entra External ID (portal)

Follow `docs/entra-external-id-setup.md`:

- [ ] Customer/External ID tenant created (not workforce)
- [ ] App registration + redirect `https://app.growthcommandcenter.com/auth/callback`
- [ ] Secrets present: Entra IDs, client secret, `SESSION_SECRET` (32+)

### 3) Data migration + identity map

- [ ] `npm run db:migrate-to-azure-pg`
- [ ] `npm run azure:validate-migration-structure`
- [ ] Row-count / FK / financial precision verification
- [ ] `npm run export:identity-map` and Entra user activation

### 4) Flip cutover flags (only after Azure-native UAT PASS)

- [ ] Set `AUTH_PROVIDER=entra` and `NEXT_PUBLIC_AUTH_PROVIDER=entra` on Container App
- [ ] Deploy with **redeploy_infra=false** (protect custom domains)
- [ ] Smoke: login, tenant isolation, QuickBooks, billing, AI
- [ ] Freeze Supabase app writes; keep rollback window
- [ ] Later: revoke Supabase keys

---

## Cutover + rollback runbooks (summary)

**Cutover (owner only):** migrate data → UAT on Azure PG with `AUTH_PROVIDER=supabase` + Azure URL (dual DB path) → flip Entra flags → smoke → freeze Supabase writes.

**Rollback:** unset Entra flags → restore `AUTH_PROVIDER=supabase` → point env back to Supabase URL (unset `AZURE_DATABASE_URL`) → redeploy previous Container App revision. Keep Supabase keys until stability window ends.

---

## Do not claim

- Live auth is Entra
- Live DB is Azure Postgres
- Supabase exit is finished

Claim only scaffolding + tests + owner-gate clarity until the boxes above are checked.

**Cutover remains Owner-gated:** do not set `AUTH_PROVIDER=entra` in production or claim live Azure DB/auth until owner gates in this document pass UAT.
