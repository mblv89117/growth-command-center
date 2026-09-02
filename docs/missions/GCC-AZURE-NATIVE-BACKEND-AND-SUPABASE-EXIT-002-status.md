# GCC-AZURE-NATIVE-BACKEND-AND-SUPABASE-EXIT-002 — Status

## Baseline (protected)

| Field | Value |
|-------|-------|
| Canonical main SHA | `ea48777` (#112) |
| Production health | `https://app.growthcommandcenter.com/api/health` → HTTP 200 |
| Custom domains / TLS | PASS — **do not reopen DNS** |
| Auth runtime (prod today) | Supabase Auth |
| DB runtime (prod today) | Supabase Postgres via `@supabase/*` |
| Vercel | Rollback only until Azure-native backend UAT PASS |

`AZURE_HOSTING_BASELINE_CAPTURED = PASS`

## What this branch delivers (code-complete, cutover gated)

1. **Domain-binding deployment regression protection** — `azure-production.yml` skips Bicep by default (`redeploy_infra=false`); image-only updates preserve custom domains.
2. **Azure PostgreSQL Stage 3** — `infra/azure/postgres.bicep` + `azure-postgres-stage3.yml` (owner secret `AZURE_POSTGRES_ADMIN_PASSWORD`).
3. **Entra External ID scaffold** — OIDC PKCE login/logout/callback, sealed `gcc_entra_session` cookie, identity link table, dual-mode middleware/login (`AUTH_PROVIDER` / `NEXT_PUBLIC_AUTH_PROVIDER`).
4. **Azure PG pool** — `src/lib/db/pool.ts` when `AZURE_DATABASE_URL` / `DATABASE_URL` set.
5. **Migration tooling** — `scripts/migrate-supabase-to-azure-pg.mjs`, `scripts/export-identity-map-for-entra.mjs`.
6. **Owner-gate docs** — `docs/entra-external-id-setup.md` (click-by-click).

## Hard blockers (owner actions)

Production cutover **cannot** complete in this agent session without:

1. GitHub secret `AZURE_POSTGRES_ADMIN_PASSWORD` + run **Azure PostgreSQL Stage 3 Provision** with `PROVISION`.
2. Entra External ID tenant + app registration secrets (see `docs/entra-external-id-setup.md`).
3. `AZURE_DATABASE_URL` + one-time migrate from Supabase.
4. UAT PASS, then set `AUTH_PROVIDER=entra` and `NEXT_PUBLIC_AUTH_PROVIDER=entra`.
5. Agent Azure CLI / MCP subscription access (currently unavailable — `az login` not present; Azure MCP timed out).

## Safety

- `AUTH_PROVIDER` remains **supabase** until explicit owner cutover.
- Supabase secrets retained for rollback.
- Vercel not decommissioned.
- No plaintext password migration.
