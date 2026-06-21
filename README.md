# Growth Command Center

Automated cash forecasting and CFO intelligence platform for founders, executives, and staff.

## Overview

Growth Command Center is a multi-tenant SaaS application that delivers real-time CFO-grade reporting, forecasting, and decision support by unifying financial, sales, operations, and production data.

**Sample tenant:** Apex Construction Group — a commercial construction company with realistic mock data.

## Features

- **Executive Dashboard** — Cash, revenue, profit, runway, and KPI overview
- **Cash Forecasting** — 13-week and 6-month forecasts with scenario controls
- **Financials** — Revenue, expenses, AR/AP aging, transactions
- **Sales Pipeline** — Weighted pipeline, deal stages, rep performance
- **Operations** — Job tracking, margins, billing and collection timing
- **Reports** — 11 export-ready CFO reports + KPI scorecard
- **Scenario Planning** — Base, best, worst, growth, and downside cases
- **Alerts** — Cash, AR, margin, payroll, and debt coverage alerts
- **Integrations** — QuickBooks live connector (OAuth + sync), mock connectors for others
- **Team & Settings** — Roles, invitations, forecast assumptions, billing
- **Platform Admin** — Tenant management for platform owners (`platform_admin` only)

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (Radix UI components)
- **Recharts**
- **next-themes** (dark/light mode)
- **Supabase** (Auth + PostgreSQL)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — click **Enter Demo Mode** on the login page to explore the app (development only).

### Authentication

**Demo mode (development only):** Click "Enter Demo Mode" on `/login` to access the dashboard with sample data. Demo sessions are pinned to `org-apex` only.

**Supabase Auth:**

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env.local` and add your keys
3. Run **`supabase/setup.sql`** in the Supabase SQL Editor (canonical setup — see below)
4. Optionally run `npm run db:seed` to load Apex/Summit demo financial data
5. Sign up at `/signup` or sign in at `/login`

### QuickBooks Integration

**Demo mode:** Click Connect on the QuickBooks card — syncs mock records instantly.

**Live OAuth:**

1. Create an app at [developer.intuit.com](https://developer.intuit.com)
2. Add redirect URI: `http://localhost:3000/api/integrations/quickbooks/callback`
3. Set `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, and `QUICKBOOKS_REDIRECT_URI` in `.env.local`
4. Connect from the Integrations page — redirects to Intuit OAuth

## Supabase database setup

| File | Use |
|------|-----|
| **`supabase/setup.sql`** | **Canonical** — run this once before launch (tables, RLS, signup trigger, default org seeds) |
| `supabase/fix-signup.sql` | **Deprecated** — pointer only; do **not** run |
| `supabase/schema.sql` | Legacy; superseded by `setup.sql` |
| `supabase/seed.sql` | Reference only; prefer `npm run db:seed` for seeding |

**How to apply:** Supabase Dashboard → SQL Editor → paste entire `supabase/setup.sql` → Run. Safe to re-run (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`).

**After setup:**

1. Add API keys to `.env.local` or Vercel
2. Configure Auth URLs (Site URL + `/auth/callback` redirect)
3. Configure SMTP for team invites (see Production Deployment)
4. Create a `platform_admin` user if you need `/admin` access

## Production Deployment (Vercel)

1. Push to GitHub and import the project in [Vercel](https://vercel.com)
2. Set **required** environment variables (see below)
3. Run `supabase/setup.sql` in Supabase SQL Editor
4. Configure Supabase Auth URLs and SMTP
5. Deploy — Vercel runs `npm run build` automatically

### Required environment variables (production)

These four are **required** for a production-ready deployment:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server admin ops (settings persist, team invites, webhooks) |
| `NEXT_PUBLIC_APP_URL` | Canonical production URL (OAuth, invite links, Stripe returns) |

Additional variables for integrations are listed in `.env.example` (QuickBooks, Stripe, Plaid).

### Demo mode in production

**Leave `ALLOW_DEMO_MODE` unset in Vercel production.**

Demo mode is disabled automatically when `NODE_ENV=production` unless `ALLOW_DEMO_MODE=true` is explicitly set. Do not enable demo mode in production.

### Team invites (Supabase Auth email / SMTP)

Team invites call Supabase `inviteUserByEmail`. Production uses **Resend** SMTP (Microsoft 365 blocked by Security Defaults).

**Configure locally (secrets in env only, not chat):**

```bash
export SUPABASE_ACCESS_TOKEN='...'   # Supabase Dashboard → Account → Access Tokens
export RESEND_API_KEY='...'         # Resend Dashboard → API Keys
npm run smtp:configure-resend
npm run smtp:verify
npm run smtp:check-resend
```

Resend SMTP: `smtp.resend.com:465`, user `resend`, sender `connect@highvaluecapitalgroup.com`.

Ensure `/auth/callback` is in Supabase redirect allowlist and `NEXT_PUBLIC_APP_URL` matches production.

Without SMTP, invite requests return **501** with an honest error — they do not silently succeed.

### Health check

**Development:** `GET /api/health` returns detailed status (connection info, org count, missing env).

**Production:** returns minimal payload only:

```json
{ "status": "ok" }
```

HTTP 503 with `{ "status": "degraded" }` when misconfigured.

```bash
curl -s https://your-domain.com/api/health
```

### Production smoke tests

`npm run smoke:auth` is for **local/staging with demo enabled** (13 checks). In production, demo tests are expected to fail because demo mode is disabled.

Run these against your deployed URL after launch:

```bash
export SMOKE_BASE_URL=https://your-production-domain

# Health — minimal status
curl -s "$SMOKE_BASE_URL/api/health"
# Expected: {"status":"ok"} HTTP 200

# Unauthenticated page protection
curl -sI "$SMOKE_BASE_URL/dashboard" | grep -i location
# Expected: redirect to /login

# Unauthenticated API protection
curl -s -o /dev/null -w "%{http_code}\n" "$SMOKE_BASE_URL/api/integrations?organizationId=org-apex"
# Expected: 401

# Demo mode disabled
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SMOKE_BASE_URL/api/auth/demo"
# Expected: 403
```

**Manual checks (authenticated test account):**

- Sign in → dashboard loads
- Settings save → "Settings saved successfully." (not preview)
- Team invite → email received; link completes at `/auth/callback`
- PDF and Excel exports return 200
- Cross-tenant API with wrong `organizationId` → 403
- `/admin` blocked for non–`platform_admin`; accessible for `platform_admin`

**Staging (optional):** with `ALLOW_DEMO_MODE=true`, run `SMOKE_BASE_URL=<staging-url> npm run smoke:auth` for the full 13-test suite.

### Pre-deploy checklist

- [ ] `supabase/setup.sql` run in Supabase SQL Editor
- [ ] Core env vars set in Vercel (never commit `.env.local`)
- [ ] `ALLOW_DEMO_MODE` **not** set in production
- [ ] Supabase Auth URLs + SMTP configured
- [ ] `platform_admin` user created (if using `/admin`)
- [ ] Optional: `npm run db:seed` for demo financial data
- [ ] Production smoke tests pass (above)
- [ ] Integration redirect URIs updated for production domain

### Production build

```bash
npm run lint
npx tsc --noEmit
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/               # Login & signup
│   ├── (dashboard)/          # Protected app pages
│   ├── api/                  # Integration & auth API routes
│   └── auth/callback/        # Supabase OAuth callback
├── components/
│   ├── auth/                 # Login & signup forms
│   ├── integrations/         # Integration cards
│   ├── ui/                   # shadcn-style primitives
│   ├── layout/               # Sidebar, header
│   ├── dashboard/            # Metric cards
│   ├── charts/               # Recharts wrappers
│   └── shared/               # Page header, data table, alerts
└── lib/
    ├── types/                # TypeScript interfaces
    ├── mock-data/            # Realistic construction company data
    ├── forecast-engine/      # Cash forecast calculations
    ├── supabase/             # Client, server, middleware helpers
    ├── auth/                 # Auth context + access control
    ├── integrations/         # QuickBooks connector + store
    ├── tenant/               # Multi-tenant context
    └── utils.ts
scripts/
├── smoke-auth.mjs            # Auth/tenant smoke tests (dev/staging)
└── validate-forecast.ts      # 13-week forecast math validation
supabase/
└── setup.sql                 # Canonical database setup
```

## Architecture Notes

### Multi-Tenant

Each organization has isolated data via `TenantProvider` and Supabase RLS on `gcc_*` tables. API routes enforce tenant access through `requireApiAccess()`. Demo sessions are pinned to `org-apex` only.

### Mock Data Layer

Tenant data is served from `src/lib/mock-data/` and Supabase seed tables. Live integrations write to `gcc_integration_connections`.

### Integrations

QuickBooks API routes under `/api/integrations/quickbooks/`:

- `POST /connect` — Demo connect or OAuth redirect URL
- `GET /callback` — OAuth callback handler
- `POST /sync` — Pull invoices and financial data
- `DELETE /disconnect` — Remove connection

Other integrations show mock status or "Coming Soon".

### Authentication

Supabase Auth protects dashboard routes via `middleware.ts` and layout redirects. Sensitive API routes use `requireApiAccess()`. Demo mode uses an HTTP-only cookie (`gcc_demo_mode`) when allowed. User profiles store `role` and `organization_id` in `gcc_profiles`.

### Security (Production)

- Demo mode disabled unless `ALLOW_DEMO_MODE=true` (do not set in production)
- API routes require auth via `requireApiAccess()` or `requireAuth()`
- Security headers enabled (HSTS, X-Frame-Options, etc.)
- Integration tokens stored server-side in Supabase
- Row-level security on all `gcc_*` tables
- Admin routes restricted to `platform_admin` role (profile-based)

## Post-launch hardening (P2 — not launch blockers)

Track after initial deployment:

- Role checks on settings save and team invite (any org member can act today)
- Signup org assignment: users without `organization_id` metadata default to `org-apex`
- Org switcher in header still lists mock orgs in UI (API blocks cross-tenant access)
- Wire `/admin` to real Supabase tenant data (currently mock `PLATFORM_TENANTS`)
- Add invite audit trail (`gcc_team_invites` table)
- Authenticated smoke tests in CI
- Migrate from deprecated `next lint` before Next.js 16

## Environment Variables

Copy `.env.example` to `.env.local` for development:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

See `.env.example` for QuickBooks, Stripe, and Plaid variables.

### Local verification

```bash
npm run dev
curl http://localhost:3000/api/health
# Development: detailed JSON with organizations count, connection status

npm run smoke:auth
# 13/13 pass against localhost with demo enabled
```

## User Roles

| Role | Access |
|------|--------|
| Founder / CEO | Full dashboard, scenarios, reports |
| CFO / Controller | Financials, forecasts, alerts |
| Operations Manager | Jobs, production, margins |
| Sales Manager | Pipeline, revenue forecast |
| Project Manager | Job-level data |
| Admin / Staff | Configurable permissions |
| External Advisor | Read-only reports |
| Platform Admin | Platform owner dashboard (`/admin`) |

## License

Private — Growth Command Center SaaS
