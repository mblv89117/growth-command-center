# GCC-AZURE-NATIVE-BACKEND-AND-SUPABASE-EXIT-002 — Status

## Baseline (protected)

| Field | Value |
|-------|-------|
| Canonical main SHA | `ada7af6` (#115) — this progress branch rebased atop #114/#115 |
| Production health | `https://app.growthcommandcenter.com/api/health` → HTTP 200 |
| Custom domains / TLS | PASS — **do not reopen DNS** |
| Auth runtime (prod today) | Supabase Auth |
| DB runtime (prod today) | Supabase Postgres via `@supabase/*` |
| Vercel | Obsolete for production SoT; treat PR status as **non-blocking** (see `docs/microsoft-native-cutover-checklist.md`) |

`AZURE_HOSTING_BASELINE_CAPTURED = PASS`

## What this branch delivers (code-complete, cutover gated)

1. **Domain-binding deployment regression protection** — `azure-production.yml` skips Bicep by default (`redeploy_infra=false`); image-only updates preserve custom domains.
2. **Azure PostgreSQL Stage 3** — Flexible Server in **eastus2** (eastus is subscription-restricted; run `34386312875` failed with empty Version `[]`). Bicep `postgresLocation` default eastus2. Owner secret `AZURE_POSTGRES_ADMIN_PASSWORD` already present.
3. **Entra External ID scaffold** — OIDC PKCE login/logout/callback, sealed `gcc_entra_session` cookie, identity link table, dual-mode middleware/login (`AUTH_PROVIDER` / `NEXT_PUBLIC_AUTH_PROVIDER`).
4. **Azure PG pool** — `src/lib/db/pool.ts` prefers `AZURE_DATABASE_URL` over `DATABASE_URL`.
5. **Migration tooling** — `scripts/migrate-supabase-to-azure-pg.mjs`, `scripts/export-identity-map-for-entra.mjs`.
6. **Owner-gate docs** — `docs/entra-external-id-setup.md` + `docs/microsoft-native-cutover-checklist.md`.
7. **Atlas Waves 1–3** — ClientCode fail-closed map + Hub HMAC ingest (**no** `x-atlas-module-key` secret header).
8. **Evidence tests** — `npm run test:microsoft-native` (tenant isolation + azure/entra selection without crash).

## Hard blockers (owner actions)

Production cutover **cannot** complete in this agent session without:

1. ~~`AZURE_POSTGRES_ADMIN_PASSWORD`~~ **COMPLETE** (run 34386312875 passed the password gate). Re-run Stage 3 after the eastus2 fix — do not change the password.
2. After FQDN exists: set `AZURE_DATABASE_URL` and migrate (`npm run db:migrate-to-azure-pg` or Stage 3 Migrate workflow once present).
3. Entra External ID tenant + app registration secrets (see `docs/entra-external-id-setup.md`) — Gate D, after Azure PG UAT.
4. UAT PASS, then set `AUTH_PROVIDER=entra` and `NEXT_PUBLIC_AUTH_PROVIDER=entra`.
5. Keep Supabase as rollback-only until traffic is none. Do not delete it at cutover.

## Safety

- `AUTH_PROVIDER` remains **supabase** until explicit owner cutover.
- Supabase secrets retained for rollback.
- Vercel not decommissioned.
- No plaintext password migration.
