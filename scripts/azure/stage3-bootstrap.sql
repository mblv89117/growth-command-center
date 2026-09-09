-- Azure PG bootstrap for GCC Stage 3. Idempotent. No secrets.
-- PostgreSQL 16 provides gen_random_uuid() in core.
-- Do not CREATE ROLE ... BYPASSRLS here: Entra admin cannot grant BYPASSRLS.
-- gcc_service will own public tables so it bypasses RLS like a service role.

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE gcc_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE gcc_service NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, gcc_app, gcc_service;
GRANT USAGE ON SCHEMA auth TO authenticated, gcc_app, gcc_service;
GRANT authenticated TO gcc_app;
