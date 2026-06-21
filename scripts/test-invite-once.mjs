#!/usr/bin/env node
/**
 * One controlled invite probe via Supabase Admin API (same path as production).
 * Never prints secrets. Uses .env.local for service role.
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-invite-once.mjs [email]
 */
import { loadLocalEnv } from "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";

loadLocalEnv();

const email =
  process.argv[2] ??
  process.env.INVITE_TEST_EMAIL ??
  `gcc-invite-probe-${Date.now()}@example.com`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://growth-command-center-lbnt.vercel.app";

if (!url || !key) {
  console.error("FAIL: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

console.log(`--- Controlled invite test ---`);
console.log(`target_email: ${email}`);
console.log(`redirect: ${appUrl}/auth/callback`);

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
  data: { organization_id: "org-apex", role: "staff" },
  redirectTo: `${appUrl}/auth/callback`,
});

if (error) {
  console.log(`api_status: ${error.status ?? "error"}`);
  console.log(`success: false`);
  console.log(`error_message: ${error.message}`);
  console.log(`email_sent: no`);
  console.log(`from_address: n/a`);
  process.exit(1);
}

console.log(`api_status: 200`);
console.log(`success: true`);
console.log(`user_id: ${data.user?.id ?? "n/a"}`);
console.log(`email_sent: yes (check inbox for From header)`);
console.log(`expected_from: Growth Command Center <connect@highvaluecapitalgroup.com>`);
console.log(`note: confirm From in inbox — if manny@ appears, alias sending is blocked`);
