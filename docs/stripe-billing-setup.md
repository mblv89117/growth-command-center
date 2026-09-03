# Stripe Billing Production Setup — GCC

**Mission:** `GCC-OWNER-ADMIN-STRIPE-BILLING-001`

## Owner Admin Console

- **URL:** `https://app.growthcommandcenter.com/admin`
- **Access:** `platform_admin` role only (middleware + layout + API)
- **Bootstrap:** `node scripts/assign-platform-admin.mjs <email>`

## Stripe Billing (standalone $149/mo)

This is **Stripe Billing** for GCC subscriptions — not the future Stripe financial-data connector.

### 1. Stripe Dashboard (HVCG account)

1. Open https://dashboard.stripe.com/products
2. Create or verify product: **Growth Command Center**
3. Create recurring price: **$149 USD / month**
4. Copy the **Price ID** (`price_...`)

### 2. Vercel environment variables (Production)

Add to the GCC Vercel project — **never paste secrets in chat**:

| Variable | Value |
|----------|-------|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...` for production) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`) |
| `STRIPE_STARTER_PRICE_ID` | Production price ID for $149/mo |
| `STRIPE_PRICE_ID` | Optional alias for same price ID |

### 3. Stripe webhook endpoint

- **URL:** `https://app.growthcommandcenter.com/api/billing/webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- Copy signing secret to `STRIPE_WEBHOOK_SECRET`

### 4. Customer billing portal

Enable in Stripe Dashboard → Settings → Billing → Customer portal.

### 5. Database migration

Run in Supabase SQL editor:

```
supabase/migration-billing.sql
```

Also ensure prior migrations are applied: `migration-v2.sql`, `migration-commercial.sql`, `migration-connectors.sql`.

### 6. Test mode certification (before live charges)

1. Use `sk_test_...` and test price ID in a preview/staging environment
2. Complete signup → Settings → Billing → Start 14-Day Trial
3. Use Stripe test card `4242 4242 4242 4242`
4. Verify webhook updates `gcc_organizations` and `gcc_subscriptions`
5. Verify `/admin` shows tenant billing status

### 7. HVCG included access

Use **Mark HVCG Included** in `/admin` or set:

- `access_type = 'hvcg_included'`
- `hvcg_engagement_active = true`

HVCG clients are not routed through standalone Stripe checkout.

## Commercial terms (do not change)

- Standalone: **$149/month** with **14-day trial**
- HVCG clients: included while qualifying engagement is active (not lifetime free)
