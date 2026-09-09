-- Grants + table ownership. gcc_service owns public GCC tables (owner bypasses RLS).
-- Isolation tests use SET ROLE gcc_app / authenticated with auth.uid() GUC.

GRANT USAGE ON SCHEMA public TO gcc_app, gcc_service, authenticated, anon;
GRANT USAGE ON SCHEMA auth TO gcc_app, gcc_service, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gcc_app, gcc_service, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gcc_app, gcc_service, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gcc_app, gcc_service, authenticated;

REVOKE ALL ON TABLE gcc_integration_connections FROM anon, authenticated, gcc_app;
REVOKE ALL ON TABLE gcc_identity_links FROM anon, authenticated, gcc_app;
REVOKE ALL ON TABLE gcc_team_invites FROM anon, authenticated, gcc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gcc_integration_connections TO gcc_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gcc_identity_links TO gcc_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gcc_team_invites TO gcc_service;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'gcc_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO gcc_service', r.tablename);
  END LOOP;
END $$;

DROP ROLE IF EXISTS gcc_testrole;

DROP TRIGGER IF EXISTS gcc_on_auth_user_created ON auth.users;
CREATE TRIGGER gcc_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION gcc_handle_new_user();
