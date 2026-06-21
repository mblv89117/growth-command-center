-- Growth Command Center — KPI editing columns (minimal, idempotent)
-- Run in Supabase SQL Editor before enabling KPI editing in production.

ALTER TABLE gcc_kpis ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'green'
  CHECK (status IN ('green', 'yellow', 'red'));
ALTER TABLE gcc_kpis ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE gcc_kpis ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE gcc_kpis ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_gcc_kpis_org_updated
  ON gcc_kpis (organization_id, updated_at DESC);
