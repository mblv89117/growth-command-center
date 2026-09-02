-- Stage 3 prep: map Supabase Auth users to Entra External ID objects.
-- No passwords stored. Used during AUTH_PROVIDER transition.

create table if not exists public.gcc_identity_links (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid not null unique,
  email text,
  entra_object_id text unique,
  entra_tenant_id text,
  linked_at timestamptz,
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gcc_identity_links_email_idx on public.gcc_identity_links (lower(email));

alter table public.gcc_identity_links enable row level security;

-- No anon/authenticated policies: service role / server only during migration.
revoke all on table public.gcc_identity_links from anon, authenticated;
grant select, insert, update, delete on table public.gcc_identity_links to service_role;
