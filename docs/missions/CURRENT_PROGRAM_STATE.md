# HVCG / GCC current program state

Updated: 2026-09-09 after Azure PostgreSQL production data-plane cutover + UAT PASS.

CONSTITUTION_VERSION = HVCG-CONSTITUTION-2026-09-04-v1.0

| Field | Value |
|-------|--------|
| HVCG_DEFAULT_BRANCH | `production/atlas-core` |
| STALE_DEFAULT_BRANCH_P0 | CLOSED |
| LIVE_HUB_SHA | `f6db86587b237bcf2c61e01919016763f8bc9c51` |
| HUB_DEPLOY_P0 | CLOSED |
| HUB_UNDEPLOYED_P0 | CLOSED |
| PR214 | MERGED (evidence only; `cfd817fc`) |
| HMAC_LIVE | ENDPOINT_LIVE_FAIL_CLOSED (not LIVE_MODULE_TRAFFIC_ENABLED; key ring unconfigured) |
| CLIENTCODE_ISOLATION | LIVE_VERIFIED |
| GLOBAL_AUTO_RESPOND | false |
| Elite | `b504e12245e57b016e2bab934ebb44e55747a7e8` (independent; do not redeploy to match Hub) |
| GCC_PR122 | MERGED (`43d7dee`) |
| STAGE3_SUCCESS_RUN | `34389534837` |
| FAILED_STAGE3_RUN | `34386312875` |
| AZURE_POSTGRES_PROVISION | PASS |
| SERVER_NAME | `azpg3uejm` |
| FQDN | `azpg3uejm.postgres.database.azure.com` |
| DATABASE | `gcc` |
| POSTGRES_VERSION | 16 |
| SKU | Standard_B1ms / Burstable |
| LOCATION | eastus2 |
| TLS / BACKUP | PASS / 14d |
| DATA_MIGRATION | PASS (overlapping counts match; final delta inserted 0) |
| RLS / ISOLATION / AZURE_PG_UAT | PASS |
| MS_NATIVE_SUITE | 31/31 PASS (includes SUPABASE_DISABLED simulation) |
| LIVE_APP_DATA_PLANE | `azure-postgres` (`/api/health`) |
| LIVE_REVISION | `azapprngzn--0000031` / image `gcc-web:454ebdb5` |
| AUTH_PROVIDER | supabase (unchanged; flags unset on Container App) |
| SUPABASE_DB | rollback-only after production DB cutover |
| SUPABASE_AUTH | still source of truth |
| MICROSOFT_NATIVE_COMPLETE | NO |
| NEXT_OWNER_ACTION | Entra External ID portal gates A–E (`docs/entra-external-id-setup.md`) |

## Closed P0s (do not relist as open)

- HVCG default-branch migration
- Atlas Hub undeployed / SHA lag
- Azure PostgreSQL Stage 3 provision (eastus restriction; fixed eastus2)
- Azure PostgreSQL schema / RLS / data copy / reconcile / UAT

## Active critical path

1. **Owner — Entra External ID (CIAM) portal gates A–E** — Customer tenant does not exist yet (only workforce `High Value Capital Group` is visible). Click-by-click: `docs/entra-external-id-setup.md`. Secrets names only in chat.
2. Cursor: Entra UAT (login/logout/session, role parity, isolation). **Do not** set `AUTH_PROVIDER=entra` until that UAT PASS.
3. After Entra UAT PASS: set `AUTH_PROVIDER=entra` + `NEXT_PUBLIC_AUTH_PROVIDER=entra` on Container App (`redeploy_infra=false`).
4. Keep Supabase Auth for rollback until auth cutover is stable; DB writes stay on Azure.
5. GCC live Atlas E2E
6. Wave 10
7. Supervisor V4

## Safety

- Do not reset `gccadmin` (Owner GitHub `AZURE_DATABASE_URL`).
- Do not delete Supabase.
- Do not claim Microsoft-native cutover complete until Entra is the live auth provider **and** Azure PG remains the live database.
- Firewall must stay `AllowAzureServices` only (no standing `0.0.0.0/0`).
- `GLOBAL_AUTO_RESPOND` stays false. HMAC ingest stays ENDPOINT_LIVE_FAIL_CLOSED.

`mblv89117/hvcg-platform-governance` was not readable from this agent (404). This file is the writable program-state record.
