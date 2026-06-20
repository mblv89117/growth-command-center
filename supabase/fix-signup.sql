-- Fix "Database error saving new user" on signup
-- Run in Supabase SQL Editor

-- 1. Ensure default organization exists (FK target for new profiles)
INSERT INTO gcc_organizations (id, name, slug, industry, plan)
VALUES
  ('org-apex', 'Apex Construction Group', 'apex-construction', 'Commercial Construction', 'growth'),
  ('org-summit', 'Summit Renovations LLC', 'summit-renovations', 'Residential Renovation', 'starter')
ON CONFLICT (id) DO NOTHING;

-- 2. Recreate trigger function with safe search_path (Supabase requirement)
CREATE OR REPLACE FUNCTION gcc_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.gcc_profiles (id, full_name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'founder'),
    COALESCE(NEW.raw_user_meta_data->>'organization_id', 'org-apex')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gcc_on_auth_user_created ON auth.users;
CREATE TRIGGER gcc_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION gcc_handle_new_user();
