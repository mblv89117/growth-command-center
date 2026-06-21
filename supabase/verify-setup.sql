-- Growth Command Center — post-setup verification (read-only checks)
-- Safe to re-run. Returns PASS/FAIL rows only.

SELECT * FROM (
  SELECT 1 AS sort, 'gcc tables exist' AS check,
    CASE WHEN COUNT(*) = 8 THEN 'PASS' ELSE 'FAIL' END AS result,
    COUNT(*)::text AS detail
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'gcc_organizations', 'gcc_profiles', 'gcc_financial_snapshots',
      'gcc_monthly_trends', 'gcc_budget_vs_actual', 'gcc_kpis',
      'gcc_alerts', 'gcc_integration_connections'
    )

  UNION ALL

  SELECT 2, 'RLS enabled',
    CASE WHEN COUNT(*) = 8 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*)::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'gcc_organizations', 'gcc_profiles', 'gcc_financial_snapshots',
      'gcc_monthly_trends', 'gcc_budget_vs_actual', 'gcc_kpis',
      'gcc_alerts', 'gcc_integration_connections'
    )
    AND c.relrowsecurity = true

  UNION ALL

  SELECT 3, 'policies exist',
    CASE WHEN COUNT(*) >= 10 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*)::text
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename LIKE 'gcc_%'

  UNION ALL

  SELECT 4, 'signup trigger exists',
    CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*)::text
  FROM pg_trigger
  WHERE tgname = 'gcc_on_auth_user_created'

  UNION ALL

  SELECT 5, 'gcc_handle_new_user exists',
    CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*)::text
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'gcc_handle_new_user'

  UNION ALL

  SELECT 6, 'default orgs exist',
    CASE WHEN COUNT(*) >= 2 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*)::text
  FROM gcc_organizations
  WHERE id IN ('org-apex', 'org-summit')

  UNION ALL

  SELECT 7, 'platform_admin support',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'gcc_profiles'
        AND column_name = 'role'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'gcc_profiles.role column'

  UNION ALL

  SELECT 8, 'platform_admin assigned',
    CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*)::text
  FROM gcc_profiles
  WHERE role = 'platform_admin'
) checks
ORDER BY sort;
