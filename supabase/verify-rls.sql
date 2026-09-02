-- Growth Command Center — RLS verification (read-only)
-- Run via: node scripts/run-supabase-sql.mjs verify-rls

SELECT * FROM (
  SELECT 1 AS sort,
    'public tables without RLS' AS check,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
    COALESCE(string_agg(tablename, ', ' ORDER BY tablename), 'none') AS detail
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
  WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'pg_%'
    AND t.tablename NOT LIKE 'sql_%'
    AND c.relrowsecurity = false

  UNION ALL

  SELECT 2,
    'gcc_* tables with RLS',
    CASE
      WHEN COUNT(*) FILTER (WHERE NOT c.relrowsecurity) = 0 THEN 'PASS'
      ELSE 'FAIL'
    END,
    COUNT(*) FILTER (WHERE c.relrowsecurity)::text || '/' || COUNT(*)::text
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
  WHERE t.schemaname = 'public' AND t.tablename LIKE 'gcc_%'

  UNION ALL

  SELECT 3,
    'server-only tables revoked from anon',
    CASE
      WHEN COUNT(*) = 0 THEN 'PASS'
      ELSE 'WARN'
    END,
    COALESCE(string_agg(tablename, ', '), 'none')
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'gcc_import_jobs', 'gcc_job_runs', 'gcc_forecast_versions',
      'gcc_ai_conversations', 'gcc_ai_messages', 'gcc_connector_sync_jobs',
      'gcc_data_provenance', 'gcc_connector_audit', 'gcc_pdf_import_jobs',
      'gcc_api_rate_limits', 'gcc_integration_connections'
    )
    AND has_table_privilege('anon', 'public.' || t.tablename, 'SELECT')

  UNION ALL

  SELECT 4,
    'RLS helper functions',
    CASE WHEN COUNT(*) = 3 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*)::text
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('gcc_auth_org_id', 'gcc_is_platform_admin', 'gcc_tenant_can_access')

  UNION ALL

  SELECT 5,
    'platform_admin exists',
    CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'WARN' END,
    COUNT(*)::text
  FROM gcc_profiles
  WHERE role = 'platform_admin'
) checks
ORDER BY sort;
