-- Growth Command Center — Stripe billing + admin audit migration
-- Run AFTER migration-v2.sql and migration-connectors.sql

-- Idempotent Stripe webhook processing
CREATE TABLE IF NOT EXISTS gcc_stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gcc_stripe_webhook_events_processed
  ON gcc_stripe_webhook_events (processed_at DESC);

-- Owner admin entitlement change audit (no secrets)
CREATE TABLE IF NOT EXISTS gcc_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gcc_admin_audit_org
  ON gcc_admin_audit (organization_id, created_at DESC);
