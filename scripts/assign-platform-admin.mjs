#!/usr/bin/env node
/**
 * Assign platform_admin role to a user by email (service role, no secret output).
 */
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2] ?? "manny.barela2026@gmail.com";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("FAIL: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: list, error: listError } = await admin.auth.admin.listUsers();
if (listError) {
  console.error(`FAIL: listUsers — ${listError.message}`);
  process.exit(1);
}

const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.log(`NO_USER: ${email}`);
  console.log("Sign up at https://growth-command-center-lbnt.vercel.app/signup then re-run.");
  process.exit(2);
}

const { error: updateError } = await admin
  .from("gcc_profiles")
  .update({ role: "platform_admin" })
  .eq("id", user.id);

if (updateError) {
  console.error(`FAIL: update profile — ${updateError.message}`);
  process.exit(1);
}

const { data: profile } = await admin
  .from("gcc_profiles")
  .select("id, role")
  .eq("id", user.id)
  .single();

console.log(
  JSON.stringify({
    status: "PASS",
    email,
    userId: user.id,
    role: profile?.role ?? null,
  })
);
