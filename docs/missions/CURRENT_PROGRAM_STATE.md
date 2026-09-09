# HVCG / GCC current program state

Updated: 2026-09-09 after Hub evidence merge and Stage 3 root-cause fix.

CONSTITUTION_VERSION = HVCG-CONSTITUTION-2026-09-04-v1.0

| Field | Value |
|-------|--------|
| HVCG_DEFAULT_BRANCH | `production/atlas-core` |
| STALE_DEFAULT_BRANCH_P0 | CLOSED |
| LIVE_HUB_SHA | `f6db86587b237bcf2c61e01919016763f8bc9c51` |
| HUB_DEPLOY_P0 | CLOSED |
| HUB_UNDEPLOYED_P0 | CLOSED |
| PR214 | MERGED (evidence only) |
| HMAC_LIVE | ENDPOINT_LIVE_FAIL_CLOSED (not LIVE_MODULE_TRAFFIC_ENABLED; key ring unconfigured) |
| CLIENTCODE_ISOLATION | LIVE_VERIFIED |
| GLOBAL_AUTO_RESPOND | false |
| Elite | `b504e12245e57b016e2bab934ebb44e55747a7e8` (independent; do not redeploy to match Hub) |
| GCC_POSTGRES_STAGE3 | ENGINEERING_FIX_READY (eastus restricted; eastus2 evidenced) until live server Ready |

## Closed P0s (do not relist as open)

- HVCG default-branch migration
- Atlas Hub undeployed / SHA lag

## Active critical path

1. GCC Azure PostgreSQL provision (eastus2)
2. Data migration + Azure PG UAT
3. Entra Owner Gate D
4. Entra UAT + auth cutover
5. Supabase rollback-only
6. GCC live Atlas E2E
7. Wave 10
8. Supervisor V4

`mblv89117/hvcg-platform-governance` was not readable from this agent (404). This file is the writable program-state record.
