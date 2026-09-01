# Azure Container Apps Hosting — GCC Production Migration

**Mission:** `GCC-AZURE-HOSTING-MIGRATION-001`

Migrate Growth Command Center from Vercel to Azure Container Apps while preserving all production domains and user flows.

## Architecture discovery

| Item | Current value |
|------|----------------|
| Framework | Next.js 15 App Router (`output: standalone` for containers) |
| Runtime | Node.js 20 — server API routes + SSR (no Edge runtime) |
| Middleware | `middleware.ts` → Supabase session + host-aware domain routing |
| Database / Auth | Supabase (unchanged — external SaaS) |
| Vercel-specific deps | None in `package.json`; `vercel.json` is config-only (cron/headers) |
| Cron | Vercel daily `/api/health` ping → replaced by GitHub Actions schedule |
| Image handling | Static assets via Next.js; no `@vercel/image` dependency |

## Azure resources (Bicep)

| Resource | Purpose |
|----------|---------|
| Resource group | `rg-gcc-prod` (default) |
| Log Analytics | Container logs |
| Azure Container Registry | GCC Docker image |
| User-assigned managed identity | ACR pull (AcrPull role) |
| Container Apps Environment | Shared ACA runtime |
| Container App | GCC web (`:3000`, health `/api/health`) |

Optional (only if Intuit/provider requires IP allowlisting):

- VNet-integrated Container Apps Environment + NAT Gateway + static public IP

## Deploy steps (agent / CI)

```bash
# 1. Azure login (owner consent if needed)
az login
az account set --subscription "<HVCG_SUBSCRIPTION_ID>"

# 2. Provision infrastructure
chmod +x scripts/azure/*.sh
./scripts/azure/deploy-infra.sh

# 3. Build and deploy application image
./scripts/azure/build-push-deploy.sh

# 4. Migrate secrets from Vercel export (never commit this file)
cp vercel-env-export.env .env.production   # owner-side export
ENV_FILE=.env.production ./scripts/azure/configure-secrets.sh

# 5. Certify on default FQDN before DNS
export SMOKE_BASE_URL=https://<container-app-fqdn>
npm run uat:golive

# 6. Bind custom domains + managed certificates
./scripts/azure/bind-custom-domains.sh

# 7. DNS cutover (GoDaddy — owner action if agent lacks access)
# See DNS section below

# 8. Post-cutover certification
export SMOKE_BASE_URL=https://app.growthcommandcenter.com
npm run uat:golive
npm test
```

## Environment variable inventory

Migrate from Vercel Production → Azure Container App secrets/env.

| Variable | Classification | Required |
|----------|----------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | PUBLIC_CONFIG | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PUBLIC_CONFIG | Yes |
| `NEXT_PUBLIC_APP_URL` | PUBLIC_CONFIG | Yes — `https://app.growthcommandcenter.com` |
| `NEXT_PUBLIC_MARKETING_URL` | PUBLIC_CONFIG | Yes — `https://growthcommandcenter.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | SECRET | Yes |
| `ANTHROPIC_API_KEY` | SECRET | Yes (AI CFO) |
| `STRIPE_SECRET_KEY` | SECRET | Yes |
| `STRIPE_WEBHOOK_SECRET` | SECRET | Yes |
| `STRIPE_STARTER_PRICE_ID` | SERVER_CONFIG | Yes |
| `STRIPE_GROWTH_PRICE_ID` | SERVER_CONFIG | Optional |
| `STRIPE_ENTERPRISE_PRICE_ID` | SERVER_CONFIG | Optional |
| `QUICKBOOKS_CLIENT_ID` | SECRET | When QB live |
| `QUICKBOOKS_CLIENT_SECRET` | SECRET | When QB live |
| `QUICKBOOKS_REDIRECT_URI` | SERVER_CONFIG | `https://app.growthcommandcenter.com/api/integrations/quickbooks/callback` |
| `QUICKBOOKS_ENV` | SERVER_CONFIG | `sandbox` or `production` |
| `PLAID_CLIENT_ID` | SECRET | When Plaid live |
| `PLAID_SECRET` | SECRET | When Plaid live |
| `PLAID_ENV` | SERVER_CONFIG | `sandbox` or `production` |
| `GOOGLE_CLIENT_ID` | SECRET | Optional |
| `GOOGLE_CLIENT_SECRET` | SECRET | Optional |
| `GOOGLE_REDIRECT_URI` | SERVER_CONFIG | Optional |
| `HUBSPOT_CLIENT_ID` | SECRET | Optional |
| `GUSTO_CLIENT_ID` | SECRET | Optional |
| `XERO_CLIENT_ID` | SECRET | Optional |
| `SALESFORCE_CLIENT_ID` | SECRET | Optional |
| `JOBBER_CLIENT_ID` | SECRET | Optional |
| `BUILDERTREND_CLIENT_ID` | SECRET | Optional |
| `ALLOW_DEMO_MODE` | SERVER_CONFIG | **Unset** in production |

**Public config** (`NEXT_PUBLIC_*`) → Container App env vars (plain).  
**Secrets** → Container App secrets (`secretref:`).

## QuickBooks / Intuit (unchanged URLs)

| Field | Value |
|-------|-------|
| Host domain | `app.growthcommandcenter.com` |
| Launch URL | `https://app.growthcommandcenter.com/integrations` |
| Disconnect URL | `https://app.growthcommandcenter.com/api/integrations/quickbooks/disconnect` |
| Connect URL | `https://app.growthcommandcenter.com/api/integrations/quickbooks/connect` |
| OAuth redirect | `https://app.growthcommandcenter.com/api/integrations/quickbooks/callback` |

Hosting migration does **not** change these public URLs.

### Intuit "where is your app hosted"

For standard QuickBooks OAuth app registration, Intuit asks for **hosting location** (e.g. "Microsoft Azure — East US"), not a static IP.

- **STATIC_OUTBOUND_IP_REQUIRED:** No (unless Intuit explicitly requests IP allowlisting)
- After deploy, list environment outbound IPs:

```bash
az containerapp env show \
  --name <managedEnvironmentName> \
  --resource-group rg-gcc-prod \
  --query "properties.staticIp" -o tsv
```

Shared ACA environments may return empty `staticIp` unless VNet + NAT Gateway is configured.

## Stripe

Webhook URL remains:

`https://app.growthcommandcenter.com/api/billing/webhook`

No Stripe Dashboard change required if DNS/host stays the same after cutover.

## DNS cutover (after Azure certification)

**Do not cut DNS until Azure production certification passes.**

| Host | Type | Target |
|------|------|--------|
| `growthcommandcenter.com` | CNAME or ALIAS | Container App validation hostname from `az containerapp hostname list` |
| `www.growthcommandcenter.com` | CNAME | Same as apex (GCC middleware 308 → apex) |
| `app.growthcommandcenter.com` | CNAME | Same Container App ingress |

Azure Container Apps uses one app with multiple custom hostnames. All three domains bind to the same Container App; GCC middleware handles marketing vs app routing via `Host` header.

**Rollback:** Point DNS back to Vercel (`cname.vercel-dns.com`) if cutover fails.

## Vercel decommission

After Azure owns production traffic for 48+ hours:

1. Remove custom domains from Vercel project
2. Confirm all traffic on Azure (analytics/logs)
3. Keep Vercel project read-only briefly for rollback
4. Cancel Vercel subscription when confident

## Supabase auth

Update Supabase project **Site URL** and redirect allowlist if needed:

- Site URL: `https://app.growthcommandcenter.com`
- Redirect URLs: `https://app.growthcommandcenter.com/auth/callback`

(Same as current production — no change if already configured.)

## Health monitoring

Replaces Vercel cron (`vercel.json`):

- GitHub Actions: `.github/workflows/azure-health-ping.yml` (daily `/api/health`)
- Container App liveness/readiness probes on `/api/health`
