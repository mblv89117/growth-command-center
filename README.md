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
- **Platform Admin** — Tenant management for platform owners

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (Radix UI components)
- **Recharts**
- **next-themes** (dark/light mode)
- **Supabase** (Auth + PostgreSQL ready)

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

Open [http://localhost:3000](http://localhost:3000) — click **Enter Demo Mode** on the login page to explore the app.

### Authentication

**Demo mode (no setup):** Click "Enter Demo Mode" on `/login` to access the full dashboard with sample data.

**Supabase Auth:**
1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env.local` and add your keys
3. Run `supabase/schema.sql` in the Supabase SQL Editor
4. Sign up at `/signup` or sign in at `/login`

### QuickBooks Integration

**Demo mode:** Click Connect on the QuickBooks card — syncs 847 mock records instantly.

**Live OAuth:**
1. Create an app at [developer.intuit.com](https://developer.intuit.com)
2. Add redirect URI: `http://localhost:3000/api/integrations/quickbooks/callback`
3. Set `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, and `QUICKBOOKS_REDIRECT_URI` in `.env.local`
4. Connect from the Integrations page — redirects to Intuit OAuth

### Production Deployment (Vercel)

1. Push to GitHub and import project in [Vercel](https://vercel.com)
2. Set all environment variables from `.env.example`
3. Set `NEXT_PUBLIC_APP_URL` to your production domain
4. Set `QUICKBOOKS_REDIRECT_URI` to `https://your-domain.com/api/integrations/quickbooks/callback`
5. In Supabase → Authentication → URL Configuration, add your production URL
6. Deploy — Vercel runs `npm run build` automatically

**Production checklist:**
- [ ] `supabase/setup.sql` run in Supabase SQL Editor
- [ ] `npm run db:seed` executed (or seed data in production DB)
- [ ] All env vars set in Vercel (never commit `.env.local`)
- [ ] Supabase RLS policies active (`gcc_*` tables)
- [ ] QuickBooks OAuth redirect URI updated for production domain
- [ ] Demo mode disabled (automatic in production)
- [ ] Health check: `GET /api/health` returns `"productionReady": true`

### Production Build

```bash
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
    ├── auth/                 # Auth context
    ├── integrations/         # QuickBooks connector + store
    ├── tenant/               # Multi-tenant context
    └── utils.ts
```

## Architecture Notes

### Multi-Tenant

Each organization has isolated data via `TenantProvider`. The org switcher in the header lets you switch between sample tenants. Production deployment should use row-level security (Supabase/PostgreSQL) or schema-per-tenant isolation.

### Mock Data Layer

All data lives in `src/lib/mock-data/`. The `getTenantData(orgId)` function returns tenant-scoped data. Replace this with Supabase queries or API calls when connecting live integrations.

### Integrations

QuickBooks has a full API integration at `/api/integrations/quickbooks/`:
- `POST /connect` — Demo connect or OAuth redirect URL
- `GET /callback` — OAuth callback handler
- `POST /sync` — Pull invoices and financial data
- `DELETE /disconnect` — Remove connection

Other integrations show "Coming Soon" and use mock status from the data layer.

### Authentication

Supabase Auth protects all dashboard routes via `middleware.ts`. Demo mode uses an HTTP-only cookie when Supabase is not configured. User metadata stores `full_name`, `role`, and `organization_id`.

## Environment Variables

Copy `.env.example` to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
QUICKBOOKS_CLIENT_ID=your-client-id
QUICKBOOKS_CLIENT_SECRET=your-client-secret
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/integrations/quickbooks/callback
QUICKBOOKS_ENV=sandbox
```

### Supabase setup checklist

1. Run `supabase/setup.sql` in the Supabase SQL Editor
2. Run `npm run db:seed` to load Apex Construction demo data
3. Add your **service_role** key to `.env.local`
4. Verify: `curl http://localhost:3000/api/health` → `"ok": true`, `"organizations": 2`
5. Dashboard shows **Live Data** badge when Supabase is connected

### Security (Production)

- Demo mode disabled in production (`NODE_ENV=production`)
- API routes require Supabase auth in production
- Security headers enabled (HSTS, X-Frame-Options, etc.)
- Integration tokens stored in Supabase (`gcc_integration_connections`)
- Row-level security on all `gcc_*` tables
- Admin routes restricted to `founder` and `platform_admin` roles

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
| Platform Admin | Tenant management |

## License

Private — Growth Command Center SaaS
