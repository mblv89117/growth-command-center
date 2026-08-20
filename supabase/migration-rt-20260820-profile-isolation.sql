-- GCC-RT-01 / GCC-RT-02 remediation migration (apply on existing projects)
-- Fail-closed signup + immutable role/organization_id from client sessions.

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
    'staff',
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "gcc profile update" ON gcc_profiles;
CREATE POLICY "gcc profile update" ON gcc_profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM gcc_profiles p WHERE p.id = auth.uid())
    AND organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM gcc_profiles p WHERE p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "gcc profile insert" ON gcc_profiles;
CREATE POLICY "gcc profile insert" ON gcc_profiles
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND role = 'staff'
    AND organization_id IS NULL
  );

CREATE OR REPLACE FUNCTION gcc_prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
       AND current_user NOT IN ('service_role', 'supabase_admin', 'postgres') THEN
      RAISE EXCEPTION 'gcc_profiles.role and organization_id are immutable from client sessions';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gcc_profile_privilege_guard ON gcc_profiles;
CREATE TRIGGER gcc_profile_privilege_guard
  BEFORE UPDATE ON gcc_profiles
  FOR EACH ROW
  EXECUTE FUNCTION gcc_prevent_profile_privilege_escalation();
