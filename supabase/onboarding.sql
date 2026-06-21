-- Growth Command Center — onboarding schema (minimal, idempotent)
-- Run this in Supabase SQL Editor if onboarding tables/columns are not yet applied.
-- Safe to re-run.

ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'welcome';
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS business_priorities JSONB DEFAULT '[]'::jsonb;
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS collected_software JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS gcc_onboarding_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gcc_onboarding_messages_org
  ON gcc_onboarding_messages (organization_id, created_at);

ALTER TABLE gcc_onboarding_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gcc onboarding messages read" ON gcc_onboarding_messages;
CREATE POLICY "gcc onboarding messages read" ON gcc_onboarding_messages FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
