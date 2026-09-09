# Microsoft-Native GCC Migration Plan

**Mission:** `GCC-AZURE-CUTOVER-SUPABASE-HARDENING-001`  
**Status:** Azure PostgreSQL production data plane is live (2026-09-09). Auth remains Supabase until Entra External ID Owner gates + UAT PASS. Microsoft-native cutover is **not** complete. See `docs/missions/CURRENT_PROGRAM_STATE.md`.

## Current vs interim vs target

| Layer | Current (production) | Phase 1 (this mission) | Target (Microsoft-native) |
|-------|----------------------|-------------------------|---------------------------|
| Compute | Azure Container Apps | Azure Container Apps | Azure Container Apps |
| Database | Azure PostgreSQL Flexible Server (`azpg3uejm`) | Azure PostgreSQL (live) | Azure Database for PostgreSQL Flexible Server |
| Auth | Supabase Auth | Supabase Auth | Microsoft Entra External ID (CIAM) |
| File storage | Not used (imports in-memory/DB) | Not used | Azure Blob Storage (when needed) |
| Secrets | Azure Container App secrets + Key Vault | Azure Container App secrets | Azure Key Vault + managed identity |
| Observability | Log Analytics + Azure Monitor | Log Analytics + Azure Monitor | Application Insights |

---

## Supabase dependency inventory

### SUPABASE_DATABASE_DEPENDENCY = **ROLLBACK_ONLY** (app data plane is Azure PG)

- All tenant data copied to Azure `gcc_*` tables (35 tables)
- RLS policies + helper functions (`gcc_auth_org_id`, `gcc_tenant_can_access`) recreated on Azure
- Signup trigger `gcc_handle_new_user` still used for Supabase Auth → profile linkage
- Server-side writes now go through Azure PG when `AZURE_DATABASE_URL` is set
- Supabase Postgres kept for rollback only; do not delete

### SUPABASE_AUTH_DEPENDENCY = **HIGH** (still live)

- Email/password signup and login (`@supabase/ssr`, middleware session refresh)
- OAuth callback `/auth/callback`
- `auth.users` → `gcc_profiles` trigger linkage (stub `auth.users` also on Azure)
- Demo mode bypasses auth (cookie-gated, disabled in production)

### SUPABASE_STORAGE_DEPENDENCY = **NONE**

- No `supabase.storage` usage in codebase
- CSV/XLSX/PDF imports processed in API routes; metadata in Postgres
- **STORAGE_MIGRATION_REQUIRED = NO** (until file retention requirements change)

### SUPABASE_REALTIME_DEPENDENCY = **NONE**

- No channels/subscriptions in application code
- Package includes `@supabase/realtime-js` transitively only

### SUPABASE_SDK_DEPENDENCY = **MEDIUM**

- `@supabase/supabase-js`, `@supabase/ssr` still required for Auth until Entra cutover
- Data plane prefers Azure PG when URL set

---

## Microsoft target architecture

```
                    ┌────────────────────────────────────┐
                    │  Azure Front Door (optional later)  │
                    └────────────────┬──────────────────┘
                                      │
                    ┌────────────────┴──────────────────┐
                    │   Azure Container Apps (GCC web)    │
                    │   Next.js standalone, port 3000     │
                    └──────┬──────────────┬────────────────┘
                           │              │
              ┌───────────┴──────┐   ┌───┴────────────────┐
              │ Entra External ID │   │ Azure Key Vault     │
              │ (CIAM / B2C)      │   │ (secrets, refs)     │
              └───────────┬──────┘   └───────────────────┘
                           │
              ┌───────────┴────────────────────────────┐
              │ Azure Database for PostgreSQL Flexible    │
              │ Server — RLS, extensions, migrations      │
              └───────────┬────────────────────────────┘
                           │
              ┌───────────┴────────────────────────────┐
              │ Azure Blob Storage (future file archive)  │
              └────────────────────────────────────────┘

Observability: Application Insights + Log Analytics (already provisioned for ACA)
```

**Excluded unless justified:** Azure Web PubSub/SignalR (no realtime requirement), Cosmos DB, Azure SQL.

---

## PostgreSQL migration plan (Supabase → Azure Flexible Server)

### Status 2026-09-09 = COMPLETE (production)

- Server `azpg3uejm` Ready in **eastus2** (eastus is subscription-restricted)
- TLS required; backup 14 days; database `gcc`
- Schema + RLS + data copy + missing-row delta + UAT PASS
- Live `/api/health` = `azure-postgres`
- Do not reset `gccadmin`

### AZURE_POSTGRES_RLS_DESIGN = **PASS**

- Preserve PostgreSQL-native RLS (same policies as hardened Supabase)
- Application role `gcc_app` = `authenticated`; `gcc_service` owns tables (bypasses RLS like service role)
- No application-only tenant filtering as primary control

---

## Entra External ID migration plan

### Scope

Replace Supabase Auth for customer identity while preserving org/tenant model in Postgres.

### Recommended approach (no password export)

1. **Account linking** — map `auth.users.id` → Entra object ID in `gcc_identity_links`
2. **Invitation flow** — existing users receive email to sign in via Entra; first login links account
3. **New signups** — Entra External ID self-service sign-up → provisioner creates `gcc_profiles` + org
4. **Passwords** — do not migrate hashes; users reset or use magic link / social IdP
5. **Roles** — `platform_admin`, `founder`, etc. remain in `gcc_profiles.role`
6. **MFA** — enable via Entra Conditional Access roadmap post-cutover

### Session migration

- Code scaffold already in `src/lib/auth/entra/*`
- Keep `AUTH_PROVIDER=supabase` until Entra UAT PASS
- Parallel run: accept both Supabase JWT and Entra JWT during transition (max 2 weeks)

### ENTRA_EXTERNAL_ID_PLAN = **PASS** (implementation scaffold). Live tenant = **NOT CREATED**.

---

## Storage migration plan

**STORAGE_MIGRATION_REQUIRED = NO** today.

---

## Migration phasing

| Phase | Scope | Status |
|-------|-------|--------|
| **1** | Azure ACA hosting + custom domains | COMPLETE |
| **2** | Azure PostgreSQL provision | COMPLETE (`azpg3uejm`) |
| **3** | RLS + data parity validation | COMPLETE |
| **4** | Database cutover | COMPLETE (this evidence pack) |
| **5** | Entra External ID migration | OPEN — Owner portal gates |
| **6** | Blob Storage (if required) | Not required |
| **7** | Supabase decommission | Blocked until Entra + rollback window |

**MICROSOFT_MIGRATION_PHASES = PASS**

---

## Rollback design

| Phase | Rollback trigger | Action |
|-------|------------------|--------|
| 4 (Database) | Data mismatch, RLS failure | Unset `AZURE_DATABASE_URL`; keep Supabase project |
| 5 (Auth) | Login failure | Keep / restore `AUTH_PROVIDER=supabase` |
| 7 (Decommission) | Any critical regression | Supabase project must remain restorable |

**Do not decommission Supabase until:** data parity ✓, auth parity ✓, tenant isolation ✓, production validation ✓, rollback window elapsed ✓.

**MICROSOFT_MIGRATION_ROLLBACK = PASS**

---

## Related files

- Evidence: `docs/evidence/azure-postgres-db-cutover-20260909.md`
- Entra Owner gates: `docs/entra-external-id-setup.md`
- Cutover scripts: `scripts/azure/stage3-*.mjs` / `stage3-*.sql`
- RLS migration: `supabase/migrations/20260902000000_rls_hardening.sql`
- Azure deploy: `.github/workflows/azure-production.yml`
