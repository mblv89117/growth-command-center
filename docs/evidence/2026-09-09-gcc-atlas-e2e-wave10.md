# GCC → Atlas live E2E + Wave 10 — 2026-09-09

CONSTITUTION = HVCG-CONSTITUTION-2026-09-04-v1.0

## Hub live

`GET https://app-atlas-integration-hub.azurewebsites.net/health`

| Field | Value |
|-------|--------|
| HTTP | 200 |
| ok | true |
| commit | `f6db86587b237bcf2c61e01919016763f8bc9c51` |
| authRequired | true |
| insecureDevAuth | false |

Elite SHA unchanged: `b504e12245e57b016e2bab934ebb44e55747a7e8` (not redeployed).

## HMAC ingest (GCC → Hub)

| Probe | Result |
|-------|--------|
| POST `/api/modules/ingest` unknown `x-atlas-module-key-id` + timestamp + signature (no raw secret) | **503** `MODULE_INGEST_UNAVAILABLE` / Module ingest is not configured |
| POST raw secret headers only (`x-atlas-module-secret` / `x-shared-secret`) | **503** same fail-closed |
| OPTIONS from `https://app.growthcommandcenter.com` | **400** origin not allowed (browser CORS; server-to-server ingest does not use this) |

`HMAC_LIVE` = **ENDPOINT_LIVE_FAIL_CLOSED** (key ring unconfigured). Not `LIVE_MODULE_TRAFFIC_ENABLED`. No production module secret was retrieved or sent. `GLOBAL_AUTO_RESPOND` remains false.

## ClientCode smoke (unauthenticated)

| Path | HTTP |
|------|------|
| `GET /api/pm/clients/SYN01` | 401 unauthorized |
| `GET /api/pm/clients/ZZZ99` | 401 unauthorized |
| `GET /api/client360` | 401 unauthorized |

Entitled and unknown codes both fail closed. No cross-client data returned.

## Wave 10

`apps/atlas-integration-api/tests/hub-client-isolation-priority.test.ts` (run from HVCG-05): **3/3 PASS**

Priority ClientCodes registered and distinct: `ACCG01`, `CCB01`, `CPL01`, `HFD01`, `KAVA01`, `LIEN01`, `PDG01`.
Cross-client dual-resolve rejected. Unknown ClientCode never default-routes.

**Real-client certification** is **not** complete: signed happy-path Hub ingest is blocked until the owner configures the module HMAC key ring. No synthetic mutation of real-client records was performed.

`CLIENTCODE_ISOLATION` remains **LIVE_VERIFIED** (prior Hub deploy evidence).

## Supervisor V4

No Supervisor V4 mission, spec, or checklist exists in `mblv89117/HVCG-05` or `mblv89117/growth-command-center`. `mblv89117/hvcg-platform-governance` is not readable (404).

`SUPERVISOR_V4` = **not started** (artifact missing; do not invent a program).
