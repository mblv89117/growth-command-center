# Microsoft-Native GCC Migration Plan

**Mission:** `GCC-AZURE-CUTOVER-SUPABASE-HARDENING-001`  
**Status:** Planning only — do not execute database/auth cutover in this phase.

## Current vs interim vs target

| Layer | Current (production) | Phase 1 (this mission) | Target (Microsoft-native) |
|-------|----------------------|-------------------------|---------------------------|
| Compute | Vercel | Azure Container Apps | Azure Container Apps |
| Database | Supabase Postgres | Supabase Postgres (hardened RLS) | Azure Database for PostgreSQL Flexible Server |
| Auth | Supabase Auth | Supabase Auth | Microsoft Entra External ID (CIAM) |
| File storage | Not used (imports in-memory/DB) | Not used | Azure Blob Storage (when needed) |
| Secrets | Vercel env → GitHub/Azure | Azure Container App secrets | Azure Key Vault + managed identity |
| Observability | Vercel + app logs | Log Analytics + Azure Monitor | Application Insights |

---

## Supabase dependency inventory

### SUPABASE_DATABASE_DEPENDENCY = **HIGH**

- All tenant data in `gcc_*` PostgreSQL tables (~35 tables)
- RLS policies + helper functions (`gcc_auth_org_id`, `gcc_tenant_can_access`)
- Signup trigger `gcc_handle_new_user` provisions org + profile
- Server-side writes via `SUPABASE_SERVICE_ROLE_KEY` (admin client)
- Client reads via authenticated Supabase JS client (`tenant.ts`, dashboard)

### SUPABASE_AUTH_DEPENDENCY = **HIGH**

- Email/password signup and login (`@supabase/ssr`, middleware session refresh)
- OAuth callback `/auth/callback`
- `auth.users` → `gcc_profiles` trigger linkage
- Demo mode bypasses auth (cookie-gated, disabled in production)

### SUPABASE_STORAGE_DEPENDENCY = **NONE**

- No `supabase.storage` usage in codebase
- CSV/XLSX/PDF imports processed in API routes; metadata in Postgres
- **STORAGE_MIGRATION_REQUIRED = NO** (until file retention requirements change)

### SUPABASE_REALTIME_DEPENDENCY = **NONE**

- No channels/subscriptions in application code
- Package includes `@supabase/realtime-js` transitively only

### SUPABASE_SDK_DEPENDENCY = **HIGH**

- `@supabase/supabase-js`, `@supabase/ssr` throughout app/API
- Rate limiting store (`gcc_api_rate_limits`) via admin client
- Billing webhooks, integrations, imports, AI advisor — all Postgres via SDK

---

## Microsoft target architecture

```
                    ┌─────────────────────────────────────┐
                    │  Azure Front Door (optional later)  │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │   Azure Container Apps (GCC web)    │
                    │   Next.js standalone, port 3000     │
                    └──────┬──────────────┬───────────────┘
                           │              │
              ┌────────────▼──────┐   ┌───▼────────────────┐
              │ Entra External ID │   │ Azure Key Vault     │
              │ (CIAM / B2C)      │   │ (secrets, refs)     │
              └────────────┬──────┘   └────────────────────┘
                           │
              ┌────────────▼──────────────────────────────┐
              │ Azure Database for PostgreSQL Flexible    │
              │ Server — RLS, extensions, migrations      │
              └────────────┬──────────────────────────────┘
                           │
              ┌────────────▼──────────────────────────────┐
              │ Azure Blob Storage (future file archive)  │
              └───────────────────────────────────────────┘

Observability: Application Insights + Log Analytics (already provisioned for ACA)
```

**Excluded unless justified:** Azure Web PubSub/SignalR (no realtime requirement), Cosmos DB, Azure SQL.

---

## PostgreSQL migration plan (Supabase → Azure Flexible Server)

### Preconditions

- RLS hardening complete and verified on Supabase (source of truth for policies)
- Azure PostgreSQL provisioned in same region (`eastus`) with TLS required
- Extensions audit: `pgcrypto`, `uuid-ossp`/`gen_random_uuid`, `pg_stat_statements`

### Steps

1. **Schema export** — `pg_dump --schema-only` from Supabase; strip Supabase-specific roles/grants
2. **RLS parity** — apply `supabase/migrations/*.sql` to Azure PG; add Azure roles (`gcc_app`, `gcc_service`) mirroring `authenticated`/`service_role` semantics
3. **Index/constraints verify** — compare `pg_indexes`, FK constraints
4. **Initial data copy** — `pg_dump --data-only` or logical replication from Supabase read replica
5. **Sequence sync** — `SELECT setval(...)` for all serial/identity columns post-copy
6. **Shadow validation** — point staging ACA at Azure PG; run `npm run uat:golive` + `npm run test:rls`
7. **Cutover window** — brief write freeze (disable signups/imports), final incremental sync, swap `DATABASE_URL`
8. **Rollback** — revert connection string to Supabase; keep Supabase read-only for 7–14 days

### Zero/low-downtime options

- **Logical replication** (Supabase → Azure) for continuous sync during validation phase
- **Dual-write** not recommended — complexity exceeds benefit for current scale

### AZURE_POSTGRES_RLS_DESIGN = **PASS**

- Preserve PostgreSQL-native RLS (same policies as hardened Supabase)
- Application role `gcc_app` = `authenticated`; `gcc_service` = bypass RLS (equivalent to service role)
- No application-only tenant filtering as primary control

---

## Entra External ID migration plan

### Scope

Replace Supabase Auth for customer identity while preserving org/tenant model in Postgres.

### Recommended approach (no password export)

1. **Account linking** — map `auth.users.id` → Entra object ID in new `gcc_identity_links` table
2. **Invitation flow** — existing users receive email to sign in via Entra; first login links account
3. **New signups** — Entra External ID self-service sign-up → webhook/provisioner creates `gcc_profiles` + org
4. **Passwords** — do not migrate hashes; users reset or use magic link / social IdP
5. **Roles** — `platform_admin`, `founder`, etc. remain in `gcc_profiles.role`; Entra app roles optional later
6. **MFA** — enable via Entra Conditional Access roadmap post-cutover

### Session migration

- Replace `@supabase/ssr` with `@azure/msal-node` / NextAuth Entra provider
- Middleware session refresh → Entra token validation
- Parallel run: accept both Supabase JWT and Entra JWT during transition (max 2 weeks)

### ENTRA_EXTERNAL_ID_PLAN = **PASS**

---

## Storage migration plan

**STORAGE_MIGRATION_REQUIRED = NO** today.

If PDF/CSV archival to Blob is added later:

- Container per tenant prefix: `org-{id}/imports/`
- SAS URLs with short TTL for uploads; server-side validation
- Optional Defender for Storage malware scanning
- Migrate existing binary metadata references only (files not currently persisted in Supabase Storage)

---

## Migration phasing

| Phase | Scope | Production impact |
|-------|-------|-------------------|
| **1** | Azure ACA hosting + Supabase retained | DNS cutover to Azure; Supabase unchanged |
| **2** | Azure PostgreSQL shadow environment | None — read replica / copy validation |
| **3** | RLS + data parity validation | None — automated tests only |
| **4** | Database cutover | Brief write freeze; connection string swap |
| **5** | Entra External ID migration | User re-auth; invitation campaign |
| **6** | Blob Storage (if required) | Additive |
| **7** | Supabase decommission | After 14-day rollback window |

**MICROSOFT_MIGRATION_PHASES = PASS**

---

## Rollback design

| Phase | Rollback trigger | Action |
|-------|------------------|--------|
| 1 (Azure hosting) | UAT fail / health degrade | Revert GoDaddy DNS to Vercel |
| 4 (Database) | Data mismatch, RLS failure | Restore Supabase connection string |
| 5 (Auth) | Login failure > 5% | Re-enable Supabase Auth in middleware |
| 7 (Decommission) | Any critical regression | Supabase project must remain restorable |

**Do not decommission Supabase until:** data parity ✓, auth parity ✓, tenant isolation ✓, production validation ✓, rollback window elapsed ✓.

**MICROSOFT_MIGRATION_ROLLBACK = PASS**

---

## Architecture comparison

| Dimension | Vercel + Supabase | Azure ACA + Supabase | Full Microsoft-native |
|-----------|-------------------|----------------------|------------------------|
| Operational complexity | Low | Medium | Medium–high |
| Security / tenant isolation | Good (after RLS hardening) | Good | Good (RLS + Entra + Key Vault) |
| Vendor consolidation | Split (Vercel, Supabase, GoDaddy) | Azure compute + Supabase | Single cloud (Azure) |
| Scaling | Serverless auto | ACA autoscale | ACA + PG flexible tier |
| Cost drivers | Vercel bandwidth/builds; Supabase MAU/DB | ACA replicas + ACR + Supabase | PG compute/storage + Entra MAU |
| Migration risk | Baseline | Low (hosting only) | Medium (DB + auth sequential) |

Exact pricing omitted — use Azure Pricing Calculator + Supabase dashboard for HVCG volumes.

**ARCHITECTURE_COMPARISON = PASS**

---

## DNS cutover readiness (Phase 1)

After `AZURE_PRE_CUTOVER_CERTIFICATION = PASS`:

1. Run `scripts/azure/bind-custom-domains.sh` — creates Azure managed cert validation CNAMEs
2. GoDaddy changes (do not apply until bindings verified):

| Action | Type | Name | Value | TTL |
|--------|------|------|-------|-----|
| MODIFY | CNAME | `app` | `<validation-target from az containerapp hostname list>` | 600 |
| MODIFY | CNAME | `www` | `<validation-target>` or A/ALIAS per Azure output | 600 |
| MODIFY | A/ALIAS | `@` | Azure Front Door / Container Apps ingress IP (from `az containerapp show`) | 600 |

**Do not guess values** — run bind script and capture Azure-provided validation records before DNS changes.

**DNS_CUTOVER_READY** = after UAT + domain bindings + owner DNS approval.

---

## Related files

- RLS migration: `supabase/migrations/20260902000000_rls_hardening.sql`
- RLS tests: `scripts/rls-security.test.mjs`
- Azure deploy: `.github/workflows/azure-production.yml`
- Secret sync: `scripts/sync-production-secrets.mjs`
