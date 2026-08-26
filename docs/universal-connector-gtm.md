# Universal Connector Framework + GTM Commercialization

**Mission:** `GCC-UNIVERSAL-CONNECTOR-GTM-001`

## Summary

Transforms GCC from manual file-import dashboard into a **universal connector platform** with honest GTM commercialization — without rebuilding existing functionality.

### Universal Connector Framework (LIVE)
- Standard adapter contract (`authorize`, `handleCallback`, `refreshCredentials`, `initialSync`, `incrementalSync`, `healthCheck`, `disconnect`, `mapToCanonicalModel`)
- Connector registry with mutually exclusive states (no AVAILABLE + COMING_SOON)
- Sync engine with retry/backoff
- Canonical financial data model + multi-source deduplication rules
- Provenance tracking (`SOURCE_VERIFIED`, `USER_CONFIRMED`, `AI_EXTRACTED_PENDING_CONFIRMATION`, etc.)
- Connector audit trail (no secrets logged)
- Database migration: `supabase/migration-connectors.sql`

### Wave 1 Status (honest)
| Connector | Status |
|-----------|--------|
| CSV / XLS / XLSX | **LIVE** |
| PDF financial reports | **LIVE** (user confirmation required) |
| QuickBooks Online | `PROVIDER_APPROVAL_REQUIRED` — adapter scaffolded |
| Plaid | `PROVIDER_APPROVAL_REQUIRED` — adapter scaffolded |
| Stripe (data) | `PROVIDER_APPROVAL_REQUIRED` — adapter stub |
| Google Sheets | `PROVIDER_APPROVAL_REQUIRED` — adapter stub |

### GTM Commercialization
- Premium homepage: "See your business clearly" + two-path messaging
- Pricing page: $149/month standalone + HVCG complimentary access model
- SEO: sitemap, robots, OpenGraph metadata
- Custom domain config: `growthcommandcenter.com` / `app.growthcommandcenter.com`
- Provider registration matrix: `docs/provider-registration-matrix.md`

### Product UX
- Data connection onboarding: Connect My Systems / Upload My Data / Later
- Connection Health Center
- PDF import with confirm/correct/ignore/cancel flow
- AI CFO source awareness (provenance + connected systems in context)

### Entitlements
- `access_type`: trial | standalone | hvcg_included | inactive
- HVCG included access without fake Stripe subscription

## Owner actions required
See `docs/provider-registration-matrix.md` for exact vendor portal steps (QuickBooks, Plaid, Stripe Connect, Google OAuth, Vercel custom domains). **No secrets in chat.**

## FALSE_LIVE_CONNECTORS = 0
Native connectors are NOT marked production-live until provider approval + verified sync.
