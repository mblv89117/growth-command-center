# Microsoft-native DB/Auth cutover checklist (runbook)

**Status:** Azure PostgreSQL is the **live production database**. Entra External ID is the **live auth provider**.
**Production hosting SoT:** Azure Container Apps (not Vercel).
**Current runtime:** Azure PG data plane + Entra External ID. Supabase Auth/DB are rollback-only.
**MICROSOFT_NATIVE_COMPLETE = YES** (2026-09-09). Do not delete Supabase.

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
- [x] Entra middleware session gate uses sealed cookie path only — no Supabase SSR when `AUTH_PROVIDER=entra`
- [x] Entra login/logout/callback routes + client auth context skip Supabase listener when `NEXT_PUBLIC_AUTH_PROVIDER=entra`
- [x] Unit tests: `npm run test:microsoft-native` including **SUPABASE_DISABLED simulation**

---

## GCC_OWNER_GATE_READY criteria

1. [x] Azure PostgreSQL provisioned; `AZURE_DATABASE_URL` set on Container App (`azpg3uejm`, live `/api/health` = `azure-postgres`)
2. [x] Entra External ID app + secrets configured (`docs/entra-external-id-setup.md`)
3. [x] Production data copied + reconciled (overlapping row counts match; final delta inserted 0)
4. [x] `npm run azure:validate-migration-structure` PASS
5. [x] Identity map export (25 users; emails + ids only). `PLAINTEXT_PASSWORDS_HANDLED=0`
6. [x] Azure PG UAT PASS (RLS, same-tenant / cross-tenant isolation)
7. [x] Entra UAT PASS → `AUTH_PROVIDER=entra` + `NEXT_PUBLIC_AUTH_PROVIDER=entra` on Container App

---

## Owner gates (completed 2026-09-09)

### 1) Azure Postgres provision — COMPLETE
- [x] Flexible Server `azpg3uejm` Ready in eastus2 (PG 16 / Standard_B1ms)

### 2) Entra External ID (portal) — COMPLETE
- [x] Customer/External ID tenant `d253f611-43e0-4d62-ac29-4cf144d48c5f`
- [x] App registration + redirect `https://app.growthcommandcenter.com/auth/callback`
- [x] Secret **names** present. Runtime from Key Vault.

### 3) Data migration + identity map — COMPLETE
- [x] Identity map export (25 users; emails + ids only). `PLAINTEXT_PASSWORDS_HANDLED=0`

### 4) Flip auth flags — COMPLETE
- [x] Entra UAT PASS (24/24)
- [x] `AUTH_PROVIDER=entra` + `NEXT_PUBLIC_AUTH_PROVIDER=entra`
- [x] Live revision `azapprngzn--0000033` / `gcc-web:entra-20260909b`
- [x] `ENTRA_LIVE_VERIFY=PASS` (8/8)
- [x] Keep Supabase Auth rollback; DB writes already on Azure
- [ ] Later: revoke Supabase keys (do not delete project)

---

## Claimed 2026-09-09

- Live database is Azure PostgreSQL
- Live auth is Entra External ID (`ENTRA_LIVE_VERIFY=PASS`)
- `MICROSOFT_NATIVE_COMPLETE = YES`

Supabase exit is **not** finished: Auth + DB remain rollback-only. Do not delete the project.
