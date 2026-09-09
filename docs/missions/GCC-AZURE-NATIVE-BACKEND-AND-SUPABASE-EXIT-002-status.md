# GCC-AZURE-NATIVE-BACKEND-AND-SUPABASE-EXIT-002 — Status

Updated: 2026-09-09 after Azure PostgreSQL production data-plane cutover.

## Baseline (live)

| Field | Value |
|-------|-------|
| Production health | `https://app.growthcommandcenter.com/api/health` → `{"status":"ok","backend":"azure-postgres","recentJobFailures":0}` |
| Custom domains / TLS | PASS — **do not reopen DNS** |
| Auth runtime (prod today) | Supabase Auth (`AUTH_PROVIDER` unset / supabase) |
| DB runtime (prod today) | Azure PostgreSQL `azpg3uejm` / database `gcc` |
| Live revision | `azapprngzn--0000031` / `gcc-web:454ebdb5` |
| Vercel | Obsolete for production SoT; treat PR status as **non-blocking** |
| MICROSOFT_NATIVE_COMPLETE | NO |

`AZURE_HOSTING_BASELINE_CAPTURED = PASS`  
`AZURE_POSTGRES_PRODUCTION_DATA_PLANE = PASS`

## Completed

1. Domain-binding deployment regression protection (`redeploy_infra=false`).
2. Azure PostgreSQL Stage 3 in **eastus2** after eastus restriction (failed run `34386312875`, success `34389534837`).
3. Schema + RLS + production data copy + missing-row delta + reconcile.
4. Azure PG UAT PASS; microsoft-native suite 31/31 including SUPABASE_DISABLED simulation.
5. Entra External ID **code** scaffold — off until `AUTH_PROVIDER=entra`.

## Hard blockers (owner actions)

1. ~~Azure PostgreSQL provision + `AZURE_DATABASE_URL` + migrate + DB UAT~~ **COMPLETE**.
2. **Entra External ID tenant + app registration secrets** — `docs/entra-external-id-setup.md` (current gate).
3. Entra UAT PASS, **then** set `AUTH_PROVIDER=entra` and `NEXT_PUBLIC_AUTH_PROVIDER=entra`.
4. Keep Supabase as auth rollback until traffic is none. Do not delete it.

## Safety

- `AUTH_PROVIDER` remains **supabase** until explicit owner auth cutover.
- Supabase secrets retained for rollback.
- Do not reset `gccadmin`.
- No plaintext password migration.
- `PLAINTEXT_PASSWORDS_HANDLED = 0`
