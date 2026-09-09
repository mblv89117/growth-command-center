# Microsoft-native DB/Auth cutover checklist (runbook)

**Status:** Azure PostgreSQL is the **live production database**. Auth cutover is **not** complete.  
**Production hosting SoT:** Azure Container Apps (not Vercel).  
**Current runtime:** Azure PG data plane + Supabase Auth. `AUTH_PROVIDER` remains supabase.  
**MICROSOFT_NATIVE_COMPLETE = NO** until Entra External ID is live.

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
  - **Dual-mode (this branch):** organizations, settings, dashboard, tenant aggregates, KPI/onboarding/integration stores, rate-limit, **connectors audit/provenance**, **Plaid bank accounts**, **imports commit**, **PDF import preview/confirm** (`/api/imports/pdf`), **pipeline recompute**, **job runs**, **tenant provision**, **billing webhook/checkout/portal**, **AI advisor persistence**, **team invites (Entra token path)**, **auth profiles via Azure PG when active**, **Entra admin route gate** (Azure PG profile/identity link, no Supabase SSR), **Entra-only API auth** (no Supabase Bearer fallback when `AUTH_PROVIDER=entra`), **dashboard/app-host shell via `getAuthContext` (no Supabase session when Entra)**, **`/api/health` Azure PG probe** when data plane active, **Docker/CI dual-mode** (Supabase keys not required when `AUTH_PROVIDER=entra`).
  - **Still incomplete (product, not Supabase Auth/DB blockers):** QuickBooks OAuth token refresh edge paths, live Plaid production sync (explicitly disabled).
- [x] Entra middleware session gate uses sealed cookie path only — no Supabase SSR when `AUTH_PROVIDER=entra`
- [x] Entra login/logout/callback routes + client auth context skip Supabase listener when `NEXT_PUBLIC_AUTH_PROVIDER=entra`
- [x] Dashboard layout + app-host `/` resolve Entra sessions without Supabase `getSession`/`getUser`
- [x] TenantProvider uses provider-neutral `AuthUserIdentity` (not `@supabase/supabase-js` User)
- [x] `validateProductionEnv`: Entra mode does not require Supabase keys; requires Entra + `SESSION_SECRET` + `AZURE_DATABASE_URL`
- [x] Migration tooling: `npm run db:migrate-to-azure-pg`, `npm run azure:validate-migration-structure` (no passwords)
- [x] Key Vault stub: `src/lib/secrets/azure-keyvault.ts` (env-first; ACA reference pattern documented)
- [x] Unit tests: `npm run test:microsoft-native` including **SUPABASE_DISABLED simulation**

---

## GCC_OWNER_GATE_READY criteria

1. [x] Azure PostgreSQL provisioned; `AZURE_DATABASE_URL` set on Container App (`azpg3uejm`, live `/api/health` = `azure-postgres`)
2. [ ] Entra External ID app + secrets configured (`docs/entra-external-id-setup.md`) — **current Owner gate**
3. [x] Production data copied + reconciled (overlapping row counts match; final delta inserted 0)
4. [x] `npm run azure:validate-migration-structure` PASS
5. [ ] `npm run export:identity-map` + Entra user activation (after CIAM tenant exists)
6. [x] Azure PG UAT PASS (RLS, same-tenant / cross-tenant isolation). Entra login UAT still open.
7. **Only after Entra UAT PASS:** set `AUTH_PROVIDER=entra` + `NEXT_PUBLIC_AUTH_PROVIDER=entra` on Container App

---

## SUPABASE_DISABLED_TEST status

**Implemented in CI/unit tests** (`scripts/microsoft-native-cutover.test.mjs`):

- Unset all `SUPABASE_*` / `NEXT_PUBLIC_SUPABASE_*`
- Set `AZURE_DATABASE_URL`, `AUTH_PROVIDER=entra`, `SESSION_SECRET`, Entra stubs
- Assert: `snapshotMicrosoftNativeRuntime` → `azure-postgres`, `validateProductionEnv` → `[]`, Entra session gate satisfied

This is a **simulation** — not proof of live cutover. Live Supabase remains rollback until owner gates pass.

---

## Owner gates that still block live cutover

### 1) Azure Postgres provision — COMPLETE (2026-09-09)

- [x] Flexible Server `azpg3uejm` Ready in eastus2 (PG 16 / Standard_B1ms)
- [x] GitHub secret `AZURE_POSTGRES_ADMIN_PASSWORD` (Owner-stored; do not reset)
- [x] Stage 3 run `34389534837`
- [x] GitHub + Container App secret `AZURE_DATABASE_URL`

### 2) Entra External ID (portal) — OPEN (blocks auth cutover)

Follow `docs/entra-external-id-setup.md`:

- [ ] Customer/External ID tenant created (not workforce)
- [ ] App registration + redirect `https://app.growthcommandcenter.com/auth/callback`
- [ ] Secrets present: Entra IDs, client secret, `SESSION_SECRET` (32+)

### 3) Data migration + identity map

- [x] Schema + data copy + missing-row delta (`scripts/azure/stage3-*.mjs`)
- [x] `npm run azure:validate-migration-structure`
- [x] Row-count / PK / FK / index / sequence / org / ClientCode reconcile
- [ ] `npm run export:identity-map` and Entra user activation (after Gate 2)

### 4) Flip auth flags (only after Entra UAT PASS — not after DB UAT alone)

- [ ] Set `AUTH_PROVIDER=entra` and `NEXT_PUBLIC_AUTH_PROVIDER=entra` on Container App
- [ ] Deploy with **redeploy_infra=false** (protect custom domains)
- [ ] Smoke: login, tenant isolation, QuickBooks, billing, AI
- [ ] Keep Supabase Auth rollback; DB writes already on Azure
- [ ] Later: revoke Supabase keys

---

## Cutover + rollback runbooks (summary)

**Cutover (owner only):** migrate data → UAT on Azure PG with `AUTH_PROVIDER=supabase` + Azure URL (dual DB path) → flip Entra flags → smoke → freeze Supabase writes.

**Rollback:** unset Entra flags → restore `AUTH_PROVIDER=supabase` → point env back to Supabase URL (unset `AZURE_DATABASE_URL`) → redeploy previous Container App revision. Keep Supabase keys until stability window ends.

---

## Do not claim

- Live auth is Entra
- Microsoft-native cutover is finished
- Supabase exit is finished

Live DB **is** Azure Postgres (verified 2026-09-09). Auth is still Supabase.

**Auth cutover remains Owner-gated:** do not set `AUTH_PROVIDER=entra` until Entra External ID UAT PASS.
