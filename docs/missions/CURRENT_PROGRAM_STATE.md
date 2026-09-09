# HVCG / GCC current program state

Updated: 2026-09-09 after GCC PR #122 merge (Stage 3 eastus2 fix).

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
| GCC_POSTGRES_STAGE3 | FIX_MERGED_AWAITING_OWNER_DISPATCH |
| TARGET_SERVER_NAME | `azpg3uejm` (not created yet) |
| TARGET_LOCATION | eastus2 |
| TARGET_VERSION | 16 |
| TARGET_SKU | Standard_B1ms |

## Closed P0s (do not relist as open)

- HVCG default-branch migration
- Atlas Hub undeployed / SHA lag

## Active critical path

1. Owner: Actions → Azure PostgreSQL Stage 3 Provision → `main` → confirm `PROVISION`
2. Data migration + Azure PG UAT
3. Entra Owner Gate D
4. Entra UAT + auth cutover
5. Supabase rollback-only
6. GCC live Atlas E2E
7. Wave 10
8. Supervisor V4

Cursor/GitHub integration cannot dispatch Actions (`403 Resource not accessible by integration`) and cannot update workflow YAML (`workflow` scope denied). The merged Bicep default `postgresLocation=eastus2` is sufficient for the existing Stage 3 workflow. ARM what-if on `rg-gcc-prod` shows Create `azpg3uejm` + `gcc` database + TLS + AllowAzureServices.

`mblv89117/hvcg-platform-governance` was not readable from this agent (404). This file is the writable program-state record.
