# Owner Secret Gate — Accelerated Cutover

**Mission:** `GCC-OWNER-SECRETS-AND-ACCELERATED-CUTOVER-001`

After secrets are saved, a push to `main` runs **Azure Production Deploy**, which now includes:

1. Stage 1 — Supabase RLS apply + verify + `npm run test:rls` + incident review  
2. Stage 2 — Azure Container Apps GCC image deploy + pre-cutover UAT  

`workflow_dispatch` may be blocked for some tokens; **push to `main` is the reliable trigger**.

---

## Required GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Source |
|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → Legacy anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → Legacy service_role key |
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens (`database_write`) |
| `SUPABASE_DB_PASSWORD` **or** `SUPABASE_DATABASE_URL` | Supabase → Database settings |

Keep using **legacy anon / service_role** keys for this cutover (do not switch to `sb_publishable` / `sb_secret` yet).

### Azure OIDC (already working if prior deploys reached Bicep)

| Secret | Purpose |
|--------|---------|
| `AZURE_CLIENT_ID` | GitHub OIDC app |
| `AZURE_TENANT_ID` | Entra tenant |
| `AZURE_SUBSCRIPTION_ID` | Subscription |

---

## After secrets are saved

No further owner action is required for Stages 1–2 if this branch is merged: CI will report:

- `PRESENT: NEXT_PUBLIC_SUPABASE_URL` (etc.) or  
- `MISSING_REQUIRED_SECRETS=...` (exact names only)

Optional manual trigger:

1. Actions → **Azure Production Deploy** → Run workflow → `main`  
2. Or Actions → **GCC Accelerated Cutover** → Run workflow → `main`

---

## Do not cut DNS until

- Stage 1 RLS tests PASS  
- Stage 2 pre-cutover UAT PASS  
- Azure custom domain validation records are applied exactly as Azure returns them  

Vercel remains rollback until Azure production is certified.
