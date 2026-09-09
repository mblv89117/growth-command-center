# HVCG / GCC current program state

Updated: 2026-09-09 after Entra live cutover PASS + GCC\u2192Atlas E2E probes.

CONSTITUTION_VERSION = HVCG-CONSTITUTION-2026-09-04-v1.0

| Field | Value |
|-------|--------|
| HVCG_DEFAULT_BRANCH | `production/atlas-core` |
| LIVE_HUB_SHA | `f6db86587b237bcf2c61e01919016763f8bc9c51` |
| HMAC_LIVE | ENDPOINT_LIVE_FAIL_CLOSED (key ring unconfigured; not LIVE_MODULE_TRAFFIC_ENABLED) |
| CLIENTCODE_ISOLATION | LIVE_VERIFIED |
| GLOBAL_AUTO_RESPOND | false |
| Elite | `b504e12245e57b016e2bab934ebb44e55747a7e8` (do not redeploy to match Hub) |
| GCC_PR123 | OPEN \u2014 Azure PG + Entra live evidence |
| AZURE_POSTGRES | PASS (`azpg3uejm` / `gcc` / eastus2 / PG16) |
| LIVE_APP_DATA_PLANE | `azure-postgres` |
| ENTRA_UAT | PASS (24/24; `PLAINTEXT_PASSWORDS_HANDLED=0`) |
| ENTRA_LIVE_VERIFY | PASS (8/8; session on `/dashboard`) |
| AUTH_PROVIDER | entra |
| NEXT_PUBLIC_AUTH_PROVIDER | entra |
| LIVE_REVISION | `azapprngzn--0000033` / `gcc-web:entra-20260909b` |
| SUPABASE_DB | rollback-only |
| SUPABASE_AUTH | rollback-only (do not delete) |
| MICROSOFT_NATIVE_COMPLETE | YES |
| WAVE_10 | isolation fabric 3/3 PASS; real-client signed ingest blocked on HMAC key ring |
| SUPERVISOR_V4 | not started \u2014 no mission artifact in these repos |

## Closed this run

- Azure PostgreSQL is the live production database
- Entra External ID Owner gates A\u2013D
- Entra UAT + live AUTH_PROVIDER cutover
- Callback public-origin fix (ACA `HOSTNAME=0.0.0.0`)
- Supabase Auth moved to rollback-only (not deleted)

## Remaining (not blockers for Microsoft-native complete)

1. Owner: configure Hub module HMAC key ring if GCC\u2192Atlas **signed** ingest should leave fail-closed.
2. Wave 10 real-client certification after key ring exists (no synthetic real-client mutation until then).
3. Governance repo `hvcg-platform-governance` still 404 from this agent.
4. Supervisor V4 \u2014 define mission before execution.

## Safety

- Do not reset `gccadmin`.
- Do not delete Supabase.
- Firewall: `AllowAzureServices` only.
- `GLOBAL_AUTO_RESPOND` stays false.
