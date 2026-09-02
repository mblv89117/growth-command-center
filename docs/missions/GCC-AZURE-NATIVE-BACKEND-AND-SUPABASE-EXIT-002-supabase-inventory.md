# Supabase dependency inventory (current mainline code)

| Category | Severity | Evidence |
|----------|----------|----------|
| DATABASE | HIGH | All `src/lib/data/*`, RLS, migrations under `supabase/` |
| AUTH | HIGH | `@supabase/ssr` middleware, login/signup, `getAuthContext` Bearer path |
| SDK | HIGH | `@supabase/supabase-js`, `@supabase/ssr` in package.json + runtime clients |
| SESSION MANAGEMENT | HIGH | Supabase auth cookies; Entra cookie scaffolded but inactive |
| PASSWORD RESET | HIGH | `resetPasswordForEmail` in login form |
| USER INVITATION | MEDIUM | Invite scripts + admin flows via Supabase Auth |
| EMAIL AUTH | HIGH | Supabase SMTP / auth emails |
| RLS | HIGH | `supabase/migrations/*_rls*.sql`, apply workflows |
| RPC | LOW/NONE | No critical RPC surface found in app paths |
| TRIGGERS | LOW | Schema triggers in SQL setup if present |
| MIGRATIONS | HIGH | `supabase/setup.sql`, `supabase/migrations/` |
| STORAGE | NONE | No Storage bucket usage in app code |
| REALTIME | NONE | No Realtime subscriptions in app code |
| EDGE FUNCTIONS | NONE | No edge function runtime dependency |
| SERVER CLIENT | HIGH | `src/lib/supabase/server.ts`, admin client |
| BROWSER CLIENT | HIGH | `src/lib/supabase/client.ts`, auth forms |

`SUPABASE_DEPENDENCY_INVENTORY = PASS`
