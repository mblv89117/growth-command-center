# Owner gates — exact actions

## Gate 1 — Azure PostgreSQL — COMPLETE (2026-09-09)

Owner Gate C provision succeeded (run `34389534837`). Server `azpg3uejm` is Ready in eastus2. GitHub secret `AZURE_DATABASE_URL` is stored. Do **not** reset `gccadmin` or `AZURE_POSTGRES_ADMIN_PASSWORD`.

Evidence: `docs/evidence/azure-postgres-db-cutover-20260909.md`

## Gate 2 — Entra External ID — OPEN (current Owner action)

Follow **`docs/entra-external-id-setup.md`** click-by-click (Customer/External ID tenant — not workforce).

No CIAM tenant exists yet. ARM tenant list shows only workforce `High Value Capital Group`.

Required GitHub secrets (values only in GitHub UI; names only in chat):

- `ENTRA_EXTERNAL_TENANT_ID`
- `ENTRA_EXTERNAL_CLIENT_ID`
- `ENTRA_EXTERNAL_CLIENT_SECRET`
- `ENTRA_EXTERNAL_REDIRECT_URI` = `https://app.growthcommandcenter.com/auth/callback`
- `SESSION_SECRET` (32+ chars)

Optional: `ENTRA_EXTERNAL_AUTHORITY` = `https://<tenant-id>.ciamlogin.com/<tenant-id>`

After secrets exist, reply with the **names** of secrets created (never values). Cursor then runs Entra UAT.

## Gate 3 — Data migration — COMPLETE (2026-09-09)

Schema, RLS, production copy, reconcile, and missing-row delta are done. Overlapping row counts match. Azure PG UAT PASS. Identity-map export + Entra user activation wait for Gate 2.

## Gate 4 — Auth cutover (only after Entra UAT PASS)

1. Set Container App / GitHub secrets:
   - `AUTH_PROVIDER=entra`
   - `NEXT_PUBLIC_AUTH_PROVIDER=entra`
2. Deploy image (workflow_dispatch, **redeploy_infra=false**)
3. Smoke: login, tenant isolation, QuickBooks URLs, billing, AI
4. Keep Supabase Auth for rollback; application DB writes already use Azure
5. After stability: revoke Supabase keys; retire leftover Vercel linkage

Do **not** perform Gate 4 in this step.

`ENTRA_OWNER_GATE = EXACT_AND_ACTIONABLE`
