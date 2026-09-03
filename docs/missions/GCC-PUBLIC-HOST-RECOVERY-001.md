# Public host recovery notes — GCC-PUBLIC-HOST-RECOVERY-001

## Diagnosis (2026-09-03)

- Default ACA FQDN `https://azapprngzn.nicecoast-be020962.eastus.azurecontainerapps.io` = HTTP 200
- Custom domains `growthcommandcenter.com` / `www` / `app` failed TLS (SNI EOF) and Host-header 404
- DNS A/CNAME still pointed at the existing ACA environment (do not change DNS)
- Root class: custom domain bindings / managed certificates missing on `azapprngzn`
  (same failure mode as Bicep ingress replace clearing `customDomains`; fixed by bind job)
- Container App itself was **Running** — not stopped. Public 404s were domain-binding loss, not an intentional stop.

## Recovery (no new app, no DNS cut)

1. Merged PR #114 (`b5b40fa`) — skip Bicep by default; rebind domains; health ping; restore workflow
2. Azure Production Deploy run `33705024681` — deploy + bind-custom-domains + certify-custom-domains all **success**
3. Confirmed live:
   - https://growthcommandcenter.com → 200
   - https://www.growthcommandcenter.com → 200
   - https://app.growthcommandcenter.com/login → 200 (GCC branding, no demo/creds warning)

## Active production baseline (post-restore)

| Field | Value |
| --- | --- |
| Resource group | `rg-gcc-prod` |
| Container App | `azapprngzn` |
| Image | `azcrrngzn.azurecr.io/gcc-web:b5b40fafec77ffda9d5ed5e9e38cd6fce8a2959b` |
| Source commit | `b5b40fafec77ffda9d5ed5e9e38cd6fce8a2959b` (on `main`) |
| runningStatus | Running |
| Traffic | latestRevision = 100% (Single revision mode) |
| Ready revision (at env update) | `azapprngzn--0000027` (latest name during roll: `--0000028`) |

## Recurrence prevention

- `azure-production.yml` `redeploy_infra` defaults to **false** (Bicep no longer wipes custom domains on every push)
- `scripts/azure/bind-custom-domains.sh` starts the app if stopped
- `azure-restore-public-hosts.yml` — manual RESTORE path
- `azure-health-ping.yml` — ACA FQDN + apex/www/app every 30m

## Follow-up

- QuickBooks OAuth callback redirected to `https://0.0.0.0:3000/...` because ACA sets `HOSTNAME=0.0.0.0` and the route used `request.url` origin. Fixed to use `getAppUrl()`.
