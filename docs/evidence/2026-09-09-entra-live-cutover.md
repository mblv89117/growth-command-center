# Entra External ID live cutover — 2026-09-09

CONSTITUTION = HVCG-CONSTITUTION-2026-09-04-v1.0
DATE = 2026-09-09
PLAINTEXT_PASSWORDS_HANDLED = 0
MICROSOFT_NATIVE_COMPLETE = YES

## Verdict

| Plane | Live value |
|-------|------------|
| Database | Azure PostgreSQL `azpg3uejm` / `gcc` — `/api/health` → `backend=azure-postgres` |
| Auth | Microsoft Entra External ID (CIAM) — `AUTH_PROVIDER=entra`, `NEXT_PUBLIC_AUTH_PROVIDER=entra` |
| Live login | `ENTRA_LIVE_VERIFY=PASS` (8/8) including `gcc_entra_session` on `/dashboard` |
| Supabase Auth | rollback-only (project and keys retained; not deleted) |
| Supabase Postgres | rollback-only |

## Owner Gate D

Customer tenant, app registration, and `gcc_signup_signin` exist. GitHub secret **names** present (values not read):

`ENTRA_EXTERNAL_TENANT_ID`, `ENTRA_EXTERNAL_CLIENT_ID`, `ENTRA_EXTERNAL_CLIENT_SECRET`, `ENTRA_EXTERNAL_REDIRECT_URI`, `SESSION_SECRET`

Runtime: Key Vault `GccEntraExternal*` + `GccEntraSessionSecret` (32-byte A256GCM).

## Public identifiers

| Field | Value |
|-------|--------|
| CIAM tenant | `d253f611-43e0-4d62-ac29-4cf144d48c5f` |
| Domain | `gcccustomers.onmicrosoft.com` |
| App | Growth Command Center / `ce91aaa0-8f77-428b-8ff1-acbf5cb940f8` |
| Redirect | `https://app.growthcommandcenter.com/auth/callback` |
| Logout | `https://app.growthcommandcenter.com/login` |
| User flow | `gcc_signup_signin` |
| Authority | `https://d253f611-43e0-4d62-ac29-4cf144d48c5f.ciamlogin.com/d253f611-43e0-4d62-ac29-4cf144d48c5f` |

## UAT

`scripts/azure/stage3-entra-uat.mjs` → `ENTRA_UAT=PASS` (24/24). See `2026-09-09-entra-external-id-uat.md`.
CIAM does not support ROPC (`AADSTS90002`). Login used Playwright + Chrome authorization-code + PKCE.
No Supabase password or hash migration.

## Live revisions

| Revision | Image | Notes |
|----------|-------|--------|
| `azapprngzn--0000032` | `gcc-web:entra-20260909` (ACR `ca2`) | First entra flags. Callback used `request.url` → `https://0.0.0.0:3000` (ACA `HOSTNAME`). Deactivated. |
| `azapprngzn--0000033` | `gcc-web:entra-20260909b` (ACR `ca3`) | `entraPublicOrigin()` / `entraAbsolutePath()`. **Live.** |

Custom domains unchanged (`redeploy_infra=false`).

## Live verify (`stage3-entra-live-verify.mjs`)

`ENTRA_LIVE_VERIFY=PASS` passed=8 failed=0

- Health azure-postgres before and after login
- Callback Location on `app.growthcommandcenter.com` (not `0.0.0.0`)
- Login 307 → `*.ciamlogin.com` authorize + PKCE
- Logout 307 → `*.ciamlogin.com` logout
- Login UI: Continue with Microsoft, no password field
- CTA → CIAM tenant `d253f611…`
- Production callback set `gcc_entra_session`; landed `/dashboard`

## Safety

- Supabase not deleted.
- `gccadmin` not reset.
- Firewall: `AllowAzureServices` only.
- `GLOBAL_AUTO_RESPOND` remains false.
- Hub HMAC ingest remains `ENDPOINT_LIVE_FAIL_CLOSED`.
