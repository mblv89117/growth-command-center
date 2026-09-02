#!/usr/bin/env node
/**
 * Export Supabase Auth identity map for Entra External ID migration.
 * NEVER exports password hashes or plaintext passwords.
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Output: JSON lines to stdout (email, supabase_user_id, created_at, last_sign_in_at, banned)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("MISSING: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pageSize = 200;
let page = 1;
let total = 0;

console.error("IDENTITY_EXPORT_START (no passwords)");

for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize });
  if (error) {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  }
  const users = data?.users ?? [];
  if (users.length === 0) break;

  for (const u of users) {
    const row = {
      supabase_user_id: u.id,
      email: u.email ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
      created_at: u.created_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
      banned: Boolean(u.banned_until),
      app_metadata_keys: Object.keys(u.app_metadata ?? {}),
      user_metadata_keys: Object.keys(u.user_metadata ?? {}),
    };
    // Explicitly refuse any password-bearing fields.
    if ("encrypted_password" in row || "password" in row) {
      console.error("REFUSING_PASSWORD_FIELD");
      process.exit(1);
    }
    console.log(JSON.stringify(row));
    total += 1;
  }

  if (users.length < pageSize) break;
  page += 1;
}

console.error(`IDENTITY_EXPORT_COMPLETE count=${total}`);
console.error("PLAINTEXT_PASSWORDS_HANDLED=0");
console.error("NEXT: invite/activate via Entra External ID; link on first login in gcc_identity_links");
