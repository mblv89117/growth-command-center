# Provider Registration Matrix

**Mission:** GCC-UNIVERSAL-CONNECTOR-GTM-001  
**Rule:** Do not guess approval status. Mark LIVE only after production authorization + sync + isolation validation.

---

## Wave 1 — Financial Core

| Provider | Dev Account | OAuth App | Prod Review | Redirect URI | Webhook | Sandbox | Est. Gating | GCC Status |
|----------|-------------|-----------|-------------|--------------|---------|---------|-------------|------------|
| **QuickBooks Online** | [Intuit Developer](https://developer.intuit.com) | Yes — create app | **Yes** — production keys require review | `{APP_URL}/api/integrations/quickbooks/callback` | Optional (CDC) | Yes | Medium–high | `PROVIDER_APPROVAL_REQUIRED` — code scaffolded, not production-live |
| **Plaid** | [Plaid Dashboard](https://dashboard.plaid.com) | Link + API keys | **Yes** — production access request | N/A (Link flow) | Yes recommended | Yes | Medium | `PROVIDER_APPROVAL_REQUIRED` — demo sync only |
| **Stripe** (data) | [Stripe Dashboard](https://dashboard.stripe.com) | Connect OAuth | **Yes** — Connect platform review if marketplace | `{APP_URL}/api/integrations/stripe/callback` | Yes | Yes | Medium | `PROVIDER_APPROVAL_REQUIRED` — billing Stripe exists; data connector not built |
| **Google Sheets** | [Google Cloud Console](https://console.cloud.google.com) | OAuth 2.0 client | Verification if sensitive scopes | `{APP_URL}/api/integrations/google/callback` | Push optional | Yes | Medium | `PROVIDER_APPROVAL_REQUIRED` — use `drive.file` scope only |
| **CSV/XLS/XLSX** | N/A | N/A | N/A | N/A | N/A | N/A | None | **LIVE** |
| **PDF** | N/A | N/A | N/A | N/A | N/A | N/A | None | **LIVE** (user confirmation required) |

---

## Wave 2 — Operating Picture

| Provider | Dev Account | OAuth | Prod Review | GCC Status |
|----------|-------------|-------|-------------|------------|
| **HubSpot** | [HubSpot Developers](https://developers.hubspot.com) | OAuth 2.0 | App listing for marketplace | `PROVIDER_APPROVAL_REQUIRED` |
| **Gusto** | [Gusto Embedded](https://docs.gusto.com) | Partner program | **Yes** — partner approval | `PROVIDER_APPROVAL_REQUIRED` |
| **Xero** | [Xero Developer](https://developer.xero.com) | OAuth 2.0 | **Yes** — 25+ connections for prod | `PROVIDER_APPROVAL_REQUIRED` |

---

## Wave 3 — CRM / Field / Industry

| Provider | Dev Account | Notes | GCC Status |
|----------|-------------|-------|------------|
| **Salesforce** | [Salesforce Developer](https://developer.salesforce.com) | Connected app + security review for prod | `PROVIDER_APPROVAL_REQUIRED` |
| **Jobber** | [Jobber Developer](https://developer.getjobber.com) | API access by application | `PROVIDER_APPROVAL_REQUIRED` |
| **Buildertrend** | Partner inquiry | API access not publicly self-service | `PROVIDER_APPROVAL_REQUIRED` |

---

## Owner actions (when ready to certify Wave 1)

### QuickBooks Online
1. Open https://developer.intuit.com → create app **"Growth Command Center"**
2. Add redirect URI: `https://app.growthcommandcenter.com/api/integrations/quickbooks/callback`
3. Request production keys (scopes: `com.intuit.quickbooks.accounting` read-only)
4. Add `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_REDIRECT_URI` to Vercel env (never paste in chat)

### Plaid
1. Open https://dashboard.plaid.com → create production access request
2. Add `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=production` to Vercel env
3. Complete compliance questionnaire

### Stripe (data connector — separate from GCC billing Stripe)
1. Enable Stripe Connect in dashboard
2. Create Connect OAuth client
3. Add redirect URI and webhook endpoint

### Google Sheets
1. Google Cloud Console → APIs → enable Sheets API
2. OAuth consent screen → add `drive.file` scope only
3. Create OAuth client (web application)

---

## Custom domain (Vercel)

| Domain | Purpose | DNS action |
|--------|---------|------------|
| `growthcommandcenter.com` | Marketing apex | A record → Vercel (or CNAME to `cname.vercel-dns.com`) |
| `www.growthcommandcenter.com` | Marketing www | CNAME → `cname.vercel-dns.com` |
| `app.growthcommandcenter.com` | Authenticated app | CNAME → `cname.vercel-dns.com` |

Add all three domains in Vercel project → Domains. Set `NEXT_PUBLIC_MARKETING_URL=https://www.growthcommandcenter.com` and `NEXT_PUBLIC_APP_URL=https://app.growthcommandcenter.com`.

**Do not guess DNS** — verify in Vercel dashboard after owner adds domains.
