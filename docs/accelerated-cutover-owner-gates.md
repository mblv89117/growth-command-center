# GCC Accelerated Cutover — Owner Gates

**Mission:** `GCC-AZURE-NATIVE-CUTOVER-AND-SUPABASE-EXIT-001`

The agent cannot read or write GitHub Actions secrets (API returns 403). Azure OIDC secrets appear configured (workflows authenticate), but **Supabase production secrets are missing** from the deploy workflow environment (confirmed in run `33578985385`).

Complete **one owner session** (~15 minutes) to unblock Stages 1–2, then run the automated pipeline.

---

## Step 1 — GitHub Actions secrets

Open: **https://github.com/mblv89117/growth-command-center/settings/secrets/actions**

Click **New repository secret** for each:

### Required (Stage 1 + 2)

| Secret name | Where to get value |
|-------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role (Reveal) |
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens → Create token with **database_write** |
| `SUPABASE_DB_PASSWORD` | Supabase → Project Settings → Database → Database password |

Alternative to `SUPABASE_DB_PASSWORD`: set `SUPABASE_DATABASE_URL` to the full connection string from Supabase → Database → Connection string (URI, Session mode).

### Already required for Azure (likely present)

| Secret name | Where to get value |
|-------------|-------------------|
| `AZURE_CLIENT_ID` | Entra app registration for GitHub OIDC |
| `AZURE_TENANT_ID` | Azure Portal → Microsoft Entra ID → Overview |
| `AZURE_SUBSCRIPTION_ID` | Azure Portal → Subscriptions |

### Optional (integrations — copy from Vercel Production)

`ANTHROPIC_API_KEY`, `STRIPE_*`, `QUICKBOOKS_*`, `PLAID_*`, `GOOGLE_*`, `HUBSPOT_CLIENT_ID`, `GUSTO_CLIENT_ID`, `SALESFORCE_CLIENT_ID`

Or run locally (never commit output):

```bash
VERCEL_TOKEN=... node scripts/sync-production-secrets.mjs
```

---

## Step 2 — Run accelerated cutover workflow

Open: **https://github.com/mblv89117/growth-command-center/actions/workflows/gcc-accelerated-cutover.yml**

Click **Run workflow** → branch `main` → Run.

This executes in order:

1. Apply Supabase RLS hardening (`20260902000000_rls_hardening.sql`)
2. Verify RLS + `npm run test:rls`
3. Security incident review (probe row cleanup)
4. Trigger **Azure Production Deploy** (build, push, configure secrets, health check, UAT)

---

## Step 3 — Verify Stage 1 (before DNS)

Confirm workflow logs show:

- `RLS security tests` — all PASS
- `ANONYMOUS_TENANT_ACCESS = DENIED`
- Supabase Security Advisor — re-check in dashboard; `rls_disabled_in_public` resolved

---

## Step 4 — Verify Stage 2 (Azure hosting)

After **Azure Production Deploy** succeeds:

- Container App `azapprngzn` running GCC image (not helloworld)
- Health: `https://azapprngzn.nicecoast-be020962.eastus.azurecontainerapps.io/api/health`
- Pre-cutover UAT job passed

---

## Step 5 — Custom domains + DNS (owner)

Only after UAT passes:

```bash
# Owner machine with az login
CONTAINER_APP_NAME=azapprngzn ./scripts/azure/bind-custom-domains.sh
```

Apply **only** the DNS records Azure returns for certificate validation. Do not cut DNS until bindings show **Provisioned**.

---

## Stage 3 — Supabase exit (separate owner gates)

Requires additional setup documented in:

- `docs/entra-external-id-setup.md` — Microsoft Entra External ID tenant
- `infra/azure/postgres.bicep` — Azure PostgreSQL Flexible Server
- `scripts/migrate-supabase-to-azure-pg.mjs` — schema/data migration

Stage 3 cannot complete until Stage 1–2 are certified on production domains.

---

## Do not

- Paste secret values in chat or commits
- Cut DNS before Azure UAT passes
- Decommission Supabase or Vercel until Azure-native parity is certified
