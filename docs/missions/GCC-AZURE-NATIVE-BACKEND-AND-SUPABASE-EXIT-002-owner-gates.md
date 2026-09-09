# Owner gates — exact actions

## Gate 1 — Azure PostgreSQL admin password

1. GitHub → `mblv89117/growth-command-center` → Settings → Secrets and variables → Actions  
2. New repository secret  
3. Name: `AZURE_POSTGRES_ADMIN_PASSWORD`  
4. Value: generate a 32+ character password (do **not** paste into chat)  
5. Actions → **Azure PostgreSQL Stage 3 Provision** → Run workflow → type `PROVISION`  
6. From the job summary, create secret `AZURE_DATABASE_URL` =  
   `postgresql://gccadmin@<FQDN>:5432/gcc?sslmode=require`  
   (password URL-encoded; never commit)

## Gate 2 — Entra External ID

Follow **`docs/entra-external-id-setup.md`** click-by-click (Customer/External ID tenant — not workforce).

Required GitHub secrets:

- `ENTRA_EXTERNAL_TENANT_ID`
- `ENTRA_EXTERNAL_CLIENT_ID`
- `ENTRA_EXTERNAL_CLIENT_SECRET`
- `ENTRA_EXTERNAL_REDIRECT_URI` = `https://app.growthcommandcenter.com/auth/callback`
- `SESSION_SECRET` (32+ chars)

Optional: `ENTRA_EXTERNAL_AUTHORITY` = `https://<tenant-id>.ciamlogin.com/<tenant-id>`

## Gate 3 — Data migration

1. Ensure source DB URL available to Actions (existing Supabase DB secret)  
2. Run migrate: `npm run db:migrate-to-azure-pg` (or CI job) with source + `AZURE_DATABASE_URL`  
3. Verify row counts / FK / financial precision  
4. Export identity map: `npm run export:identity-map`  
5. Invite/activate users via Entra (no password hash migration)

## Gate 4 — Cutover (only after Azure-native UAT PASS)

1. Set Container App / GitHub secrets:  
   - `AUTH_PROVIDER=entra`  
   - `NEXT_PUBLIC_AUTH_PROVIDER=entra`  
2. Deploy image (workflow_dispatch, **redeploy_infra=false**)  
3. Smoke: login, tenant isolation, QuickBooks URLs, billing, AI  
4. Freeze Supabase app writes; keep project for rollback window  
5. After stability: revoke Supabase keys; retire Vercel production linkage

`ENTRA_OWNER_GATE = EXACT_AND_ACTIONABLE`
