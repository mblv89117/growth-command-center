# GCC Accelerated Cutover — Owner Gates

**Mission:** `GCC-AZURE-NATIVE-CUTOVER-AND-SUPABASE-EXIT-001`  
**Repo:** https://github.com/mblv89117/growth-command-center

Agent cannot read/write GitHub Actions secret **values** (API 403). Presence is verified only by workflow runs.

---

## Current certification status (2026-09-09)

| Gate | Status |
|------|--------|
| Azure Container App | **LIVE_GCC** `azapprngzn` revision `azapprngzn--0000031` |
| Custom domains | PASS — do not reopen DNS |
| Live health | `https://app.growthcommandcenter.com/api/health` → `azure-postgres` |
| Azure PostgreSQL | **PASS** `azpg3uejm` Ready eastus2 PG16 |
| Azure PG UAT | **PASS** |
| AUTH_PROVIDER | supabase (not entra) |
| Entra External ID | **OPEN** — Owner gates A–E |
| MICROSOFT_NATIVE_COMPLETE | NO |

DNS Stage 2b is already live. Do not re-cut DNS.

---

## Stage 3 — Supabase exit

### 3a. Azure PostgreSQL — COMPLETE (2026-09-09)

Server `azpg3uejm` Ready in eastus2. Live health `backend=azure-postgres`. Do not reset admin password. Evidence: `docs/evidence/azure-postgres-db-cutover-20260909.md`.

### 3b. Entra External ID — current Owner gate

Follow click-by-click: `docs/entra-external-id-setup.md`

Secrets to create (values only in GitHub UI):

- `ENTRA_EXTERNAL_TENANT_ID`
- `ENTRA_EXTERNAL_CLIENT_ID`
- `ENTRA_EXTERNAL_CLIENT_SECRET`
- `ENTRA_EXTERNAL_REDIRECT_URI` = `https://app.growthcommandcenter.com/auth/callback`
- `SESSION_SECRET` (32+ chars)

### 3c. Identity migration

`npm run export:identity-map` exports email + user id only.  
`PLAINTEXT_PASSWORDS_HANDLED = 0`

---

## Do not

- Paste secret values in chat or commits
- Re-cut DNS
- Set `AUTH_PROVIDER=entra` before Entra UAT PASS
- Decommission Supabase until Entra UAT PASS
- Reset `gccadmin`
