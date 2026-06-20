# Growth Command Center — Working Notes

Last updated: May 24, 2026  
Branch: `cursor/fix-tailwind-esm-import` (committed) · base: `main`

Use this file as a running checklist while you continue development.

**Agent prompt:** [`docs/production-qa-prompt.md`](docs/production-qa-prompt.md) — full orchestrator + sub-agent production QA workflow (P0–P3 priorities, required commands, final report format). Paste into a coding agent or follow manually.

---

## Done (this session)

- [x] **Tailwind ESM fix** — `tailwind.config.ts` now imports `tailwindcss-animate` instead of `require()`. Fixes dev crash: `ReferenceError: require is not defined` when compiling dashboard pages.
- [x] **QA pass** — Full end-user test of all routes, APIs, integrations, and auth flows (see findings below).
- [x] **Production build verified** — `npm run build` succeeds after a clean `.next` delete.

---

## Uncommitted local changes (not on branch)

These exist in your working tree but were **not** included in the Tailwind commit:

| File | Summary |
|------|---------|
| `src/app/(dashboard)/dashboard/page.tsx` | Checks `res.ok` before parsing dashboard API JSON; falls back to mock on error |
| `src/hooks/use-tenant-data.ts` | Same pattern for tenant API |
| `supabase/setup.sql` | Hardened `gcc_handle_new_user()` trigger + default org seed rows |
| `supabase/fix-signup.sql` | Untracked — signup-related SQL fix |

Review and commit separately when ready.

---

## Priority backlog (from QA)

Aligned with `docs/production-qa-prompt.md` priority labels: **P0** = launch blocker, **P1** = before paid users, **P2** = before broad launch.

### P0 — launch blockers

1. **Auth middleware bypass**
   - **Symptom:** `/dashboard` returns HTTP 200 with full app shell when no session or demo cookie.
   - **Where:** `middleware.ts` → `src/lib/supabase/middleware.ts`
   - **Fix:** Ensure redirect to `/login` when `!user && !demoMode` on all protected routes. Verify Edge middleware cookie handling with Supabase SSR.

2. **PDF report export (500)**
   - **Symptom:** `GET /api/reports/export?format=pdf` fails with missing `Helvetica.afm`.
   - **Where:** `src/lib/reports/generate.ts`, `src/app/api/reports/export/route.ts`
   - **Fix:** Bundle pdfkit font files for Next.js App Router, or switch PDF library. Excel export works today.

### P1 — before paid users

3. **QuickBooks Error UX**
   - **Symptom:** Error badge + Connect button; no `errorMessage` shown; no Retry action.
   - **Where:** `src/components/integrations/integration-card.tsx`, `integrations-content.tsx`
   - **Fix:** When `status === "error"`, render `errorMessage`, show **Retry Sync** / **Reconnect**, keep Live badge.

4. **Admin page in demo mode**
   - **Symptom:** Platform admin tenant table visible without `founder` / `platform_admin` role.
   - **Where:** `src/lib/supabase/middleware.ts` — admin check only runs when `user` exists.
   - **Fix:** Block `/admin` for demo mode unless role is explicitly allowed.

5. **API auth in development**
   - **Symptom:** `/api/integrations`, `/api/reports/export`, etc. callable without session.
   - **Fix:** Add `requireAuth()` (or equivalent) to sensitive API routes in all environments.

### P2 — before broad launch

6. **Mock integration cards** — Stripe/Gusto/HubSpot show Connected + disabled Disconnect. Label as **Mock** or enable demo toggle.
7. **Settings save buttons** — No handlers on Organization / Forecast / Alerts tabs (`src/app/(dashboard)/settings/page.tsx`).
8. **Team invites** — Invite buttons have no `onClick` (`src/app/(dashboard)/team/page.tsx`).
9. **Alerts tabs** — Use controlled `Tabs` `value`/`onValueChange`; filter state and tab UI desync (`src/app/(dashboard)/alerts/page.tsx`).

### P3 — backlog

10. Dashboard “Budget vs Actual” says September; data context is May 2026.
11. Mobile nav only shows first 6 sidebar items (`src/components/layout/sidebar.tsx` → `MobileNav`).
12. Monthly trend chart includes Oct–Dec with $0 values in mock data.

---

## Quick test commands

```bash
# Dev server
npm run dev

# Demo login cookie
curl -c /tmp/gcc.txt -X POST http://localhost:3000/api/auth/demo

# Health check
curl http://localhost:3000/api/health

# Page smoke test (with demo cookie)
curl -b /tmp/gcc.txt -o /dev/null -w "%{http_code}\n" http://localhost:3000/integrations

# PDF export (currently fails)
curl -b /tmp/gcc.txt "http://localhost:3000/api/reports/export?organizationId=org-apex&type=executive&format=pdf" -o /tmp/test.pdf

# Unauth check (should redirect to /login — currently fails)
curl -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/dashboard

# Clean rebuild if .next corrupts (e.g. build + dev at same time)
rm -rf .next && npm run build && npm run dev
```

---

## App context (for testing)

| Item | Value |
|------|-------|
| URL | http://localhost:3000 |
| Demo entry | Login → **Enter Demo Mode** (dev only) |
| Sample tenant | Apex Construction Group (`org-apex`) |
| Live integrations | QuickBooks (`int-1`), Plaid (`int-4`) |
| Supabase setup | Run `supabase/setup.sql`, then `npm run db:seed` |

---

## Suggested next session order

Follow **Sub-Agent B → F → E → G** in `docs/production-qa-prompt.md`:

1. **P0** Auth middleware + API auth + admin gate (Sub-Agent B/C).
2. **P0** PDF export fonts (Sub-Agent F).
3. **P1** QuickBooks error UX + mock integration labels (Sub-Agent E).
4. Commit or discard uncommitted dashboard/tenant/supabase changes.
5. **P2** Settings/team dead buttons, alerts tabs, mobile nav (Sub-Agent G).
6. Run final verification block (Sub-Agent I) and fill in the required report format from the prompt.

---

## QA rating (May 24, 2026)

**Needs moderate fixes** — Strong demo UX and data layer; not launch-ready until auth, PDF exports, and integration error handling are resolved.
