# GCC Stage 3 PostgreSQL — failed run 34386312875 and fix

FAILED_RUN = 34386312875  
WORKFLOW = Azure PostgreSQL Stage 3 Provision  
CONSTITUTION = HVCG-CONSTITUTION-2026-09-04-v1.0

## ROOT_CAUSE

HVCG Production subscription `ebc84d85-b5ff-4c4b-add1-b0a8de31b319` **restricts new Azure Database for PostgreSQL Flexible Server provisioning in `eastus`**.

Live capabilities (`az postgres flexible-server list-skus --location eastus`):

- `supportedServerEditions` = 0
- `supportedServerVersions` = `[]`
- `reason` = `Provisioning is restricted in this region. Please choose a different region.`

ARM then rejects `properties.version = '16'` as:

`ParameterOutOfRange: The value of the 'Version' should be in: [].`

This is **not** a bad PostgreSQL 16 choice, a bad `Standard_B1ms` SKU, a bad `2024-08-01` API, or an existing-server version change.

## Evaluated hypotheses

| Hypothesis | Evidence | Result |
|------------|----------|--------|
| A. Existing / partial server | `az postgres flexible-server list -g rg-gcc-prod` = `[]`. Failed op targeted `azpgrngzn` and never created it. | No reuse/delete needed |
| B. Version availability | eastus versions `[]`. eastus2 versions `11,12,13,14,15,16,17,18`. westus2 already hosts PG 16 B1ms (`psql-gs360p-mwlemljo`). | 16 is valid outside eastus |
| C. SKU | eastus2 Burstable includes `Standard_B1ms`. | SKU valid in eastus2 |
| D. API version | Capabilities queried with 2024-08-01; restriction is regional, not API. | Keep 2024-08-01 |
| E. Region / capacity | eastus explicitly restricted for this subscription. GCC compute (CAE/ACR/apps) stays eastus. | Use eastus2 (same US East) |
| F. Resource state | Failed deployment `gcc-postgres-34386312875` only; no failed server resource. | Clean create |

## FIX

- Keep PostgreSQL **16** and **Standard_B1ms / Burstable**.
- Deploy Flexible Server to **eastus2** (`postgresLocation`), not the RG location.
- Stable server name `azpg` + `uniqueString(resourceGroup().id, 'gcc-postgres')` so location fallback does not rename.
- Existing Stage 3 workflow does not pass `postgresLocation`; Bicep default `eastus2` is enough for a clean retry.
- Preflight script fails closed when `supportedServerVersions` is empty.

## VALIDATION

- `az bicep build` on `postgres.bicep`
- Preflight against live eastus2 capabilities (PASS) and eastus (fail-closed)
- `az deployment group validate` with dummy password (not stored)
- Do **not** claim provision PASS from compile alone — live `az postgres flexible-server show` after workflow

## ROLLBACK

- Do not delete a Ready server with data.
- If a new empty eastus2 server is wrong: stop using it; keep Supabase as production SoT until UAT.
- GCC compute / custom domains remain eastus; no DNS change.

## HMAC / Hub (Atlas, unchanged)

LIVE_HUB_SHA = `f6db86587b237bcf2c61e01919016763f8bc9c51`  
HMAC = `ENDPOINT_LIVE_FAIL_CLOSED` (module ingest 503; key ring not configured; not `LIVE_MODULE_TRAFFIC_ENABLED`)  
CLIENTCODE_ISOLATION = LIVE_VERIFIED  
GLOBAL_AUTO_RESPOND = false
