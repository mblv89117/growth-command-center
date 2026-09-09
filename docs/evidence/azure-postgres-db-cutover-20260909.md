# GCC Azure PostgreSQL — production data-plane cutover evidence

CONSTITUTION = HVCG-CONSTITUTION-2026-09-04-v1.0  
DATE = 2026-09-09  
MICROSOFT_NATIVE_COMPLETE = NO

## Verdict

Azure Database for PostgreSQL Flexible Server **`azpg3uejm`** is the **live production database** for Growth Command Center.

Auth remains **Supabase**. `AUTH_PROVIDER` / `NEXT_PUBLIC_AUTH_PROVIDER` were **not** set to `entra`.

Supabase Postgres is **rollback-only** for application data. Do not delete the Supabase project.

## Provision (Owner Gate C)

| Field | Verified value |
|-------|----------------|
| STAGE3_SUCCESS_RUN | `34389534837` |
| FAILED_STAGE3_RUN | `34386312875` (eastus `supportedServerVersions=[]`) |
| SERVER_NAME | `azpg3uejm` |
| FQDN | `azpg3uejm.postgres.database.azure.com` |
| RESOURCE_GROUP | `rg-gcc-prod` |
| STATE | Ready |
| VERSION | 16 (minor 15) |
| SKU | Standard_B1ms / Burstable |
| LOCATION | East US 2 (`postgresLocation`; GCC compute stays eastus) |
| DATABASE | `gcc` UTF8 / `en_US.utf8` |
| TLS | `require_secure_transport=on`; session `ssl=on` |
| BACKUP | 14 days; geo-redundant Disabled |
| STORAGE | 32 GiB Premium_LRS P4 |
| PUBLIC_NETWORK | Enabled |
| FIREWALL | `AllowAzureServices` only (`0.0.0.0-0.0.0.0`) after cleanup |
| PASSWORD_AUTH | Enabled (`gccadmin`) |
| ENTRA_AUTH | Enabled (workforce tenant `3df46563-86f3-4414-87fd-84ba967741ef`) |
| ENTRA_ADMINS | `manny@highvaluecapitalgroup.com` (User); `azidrngzn` (ServicePrincipal) |

GitHub secret `AZURE_DATABASE_URL` is Owner-stored (value not readable by this agent). Container App secrets `azure-database-url` / `database-url` are mounted as `AZURE_DATABASE_URL` and `DATABASE_URL`. App role is `gcc_service` (Key Vault `GccAzureDatabaseUrl`). Do not reset `gccadmin`.

## Schema / RLS

- Prepared migrations applied: `supabase/setup.sql`, `migration-v2.sql`, `migration-commercial.sql`, `migration-connectors.sql`, identity-links, team-invites.
- `pgcrypto` is not allow-listed; PostgreSQL 16 `gen_random_uuid()` is used.
- `gcc_service` owns public `gcc_*` tables (owner bypasses RLS like a service role). Isolation tests use `SET ROLE gcc_app`.
- RLS enabled **35/35** `gcc_*` tables.
- Helpers present: `gcc_auth_org_id`, `gcc_is_platform_admin`, `gcc_tenant_can_access`.
- `node scripts/azure/validate-migration-structure.mjs` = PASS.

## Data copy + final delta (2026-09-09)

Source: Supabase PostgREST + Auth Admin (`igyaebtymornywjeidrl.supabase.co`).  
Target: Azure PG via Entra token (no secret values printed).

Delta mode after production cutover: **missing rows only** (`ON CONFLICT DO NOTHING`). Azure is not overwritten.

| Check | Result |
|-------|--------|
| Auth users | source=25, delta inserted=0 |
| Overlapping table counts | all match |
| Tables with delta inserts | 0 |
| Source-absent on Azure only | `gcc_identity_links`=25 (seeded), `gcc_team_invites`=0, `gcc_api_rate_limits`=0 |

Matched counts include: orgs 24, profiles 25, snapshots 23, trends 51, kpis 143, forecast weeks 182, forecast months 45, import jobs 13, job runs 39, forecast versions 26.

## Reconcile

| Item | Result |
|------|--------|
| Tables | 35 `gcc_*` |
| Row counts | overlapping tables match |
| Primary keys | 35/35 |
| Foreign keys | 37 |
| Indexes | 72 |
| Sequences | identity_or_serial=0 (UUID PKs expected) |
| Timestamps | `gcc_organizations.max_created=2026-09-03T02:14:02Z` |
| Org ownership | 24 orgs; 2 HVCG-named rows |
| ClientCode | `org-syn01` not in DB; SYN01 mapping fail-closed (code fixture only) |
| Identity links | 25 rows, 25 supabase-linked |

## Isolation + UAT

- Same-tenant visible; cross-tenant=0; unknown org=0.
- Isolation used a non-`platform_admin` profile (admin can see all orgs by design).
- `AZURE_PG_UAT=PASS` (`scripts/azure/stage3-reconcile-uat.mjs`, 14/14).
- `npm run test:microsoft-native` = **31/31 PASS** including SUPABASE_DISABLED simulation.
- Live `https://app.growthcommandcenter.com/api/health` → `{"status":"ok","backend":"azure-postgres","recentJobFailures":0}`.
- Live login `https://app.growthcommandcenter.com/login` → HTTP 200.
- Container App `azapprngzn` revision `azapprngzn--0000031`, image `azcrrngzn.azurecr.io/gcc-web:454ebdb5`, Healthy.
- `AUTH_PROVIDER` and `NEXT_PUBLIC_AUTH_PROVIDER` are **unset** on the Container App (default supabase).

## Temporary firewall

A time-boxed rule `cursor-delta-window-38b2` (`0.0.0.0-255.255.255.255`) was opened only for delta/UAT from this agent (rotating AWS NAT). It was deleted immediately after. Current rules: `AllowAzureServices` only. TLS + Entra/password still required.

## What is not claimed

- Microsoft-native cutover is **not** complete (auth is still Supabase).
- Entra External ID customer tenant does **not** exist yet (ARM tenant list shows only workforce `High Value Capital Group`).
- `AUTH_PROVIDER=entra` was **not** set.

## Next

Owner: Entra External ID portal gates in `docs/entra-external-id-setup.md` (A–E). Cursor continues Entra UAT only after those secrets exist. Do not flip auth flags before Entra UAT PASS.
