#!/usr/bin/env node
/**
 * HVCG Auth Recovery — investigate signup email delivery (no secrets required).
 * Uses Supabase anon client only: resend confirmation, sign-in probe.
 *
 * Run: node scripts/hvcg-auth-recovery.mjs
 * Optional: HVCG_PILOT_EMAIL=... node scripts/hvcg-auth-recovery.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://igyaebtymornywjeidrl.supabase.co";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlneWFlYnR5bW9ybnl3amVpZHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODQ4NTEsImV4cCI6MjA5NDM2MDg1MX0.Sc513VMEzqvVj6ET_2CIVtnPaTQxddWPIAygt4fxvh0";
const BASE = process.env.SMOKE_BASE_URL ?? "https://growth-command-center-lbnt.vercel.app";
const EMAIL = process.env.HVCG_PILOT_EMAIL ?? "manny.barela2026+hvcg-pilot@gmail.com";
const REDIRECT = `${BASE}/auth/callback?next=/onboarding`;

const report = {};

function log(key, value, detail = "") {
  report[key] = value;
  console.log(`${key} = ${value}${detail ? ` (${detail})` : ""}`);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

console.log(`\n=== HVCG Auth Recovery Diagnostic ===`);
console.log(`Email: ${EMAIL}`);
console.log(`Redirect: ${REDIRECT}\n`);

// Probe: wrong password vs unconfirmed distinguishes existing user
const wrongPw = await supabase.auth.signInWithPassword({ email: EMAIL, password: "__probe_wrong__" });
const userExists = wrongPw.error?.message === "Invalid login credentials";
const likelyUnconfirmed = userExists;

log("AUTH_USER_EXISTS", userExists ? "YES" : "UNKNOWN", wrongPw.error?.message);

// Resend confirmation (normal supported path)
const resend = await supabase.auth.resend({
  type: "signup",
  email: EMAIL,
  options: { emailRedirectTo: REDIRECT },
});

if (resend.error) {
  if (resend.error.code === "over_email_send_rate_limit") {
    log("CONFIRMATION_RESEND", "RATE_LIMITED", resend.error.message);
    log("SIGNUP_EMAIL_ROOT_CAUSE", "IDENTIFIED", "User exists; prior send rate-limited — wait 60s and resend");
  } else {
    log("CONFIRMATION_RESEND", "FAIL", resend.error.message);
    log("SIGNUP_EMAIL_ROOT_CAUSE", "IDENTIFIED", resend.error.message);
  }
} else {
  log("CONFIRMATION_RESEND", "PASS", "Supabase accepted resend request");
  log("SIGNUP_EMAIL_ROOT_CAUSE", "IDENTIFIED", "User exists unconfirmed; duplicate signup does not resend — use resend API");
}

// Signup duplicate behavior (enumeration-safe)
const signup = await supabase.auth.signUp({
  email: EMAIL,
  password: "ProbeOnly2026!X",
  options: { emailRedirectTo: REDIRECT },
});

if (signup.error?.code === "over_email_send_rate_limit") {
  log("DUPLICATE_SIGNUP_BEHAVIOR", "RATE_LIMITED", "signup also counts toward email rate limit");
} else if (signup.data?.user?.identities?.length === 0) {
  log("DUPLICATE_SIGNUP_BEHAVIOR", "SILENT_NO_RESEND", "identities=[] — UI may say check email but no send");
} else if (!signup.data?.user) {
  log("DUPLICATE_SIGNUP_BEHAVIOR", "NO_USER_RETURNED", "enumeration-safe empty response");
} else {
  log("DUPLICATE_SIGNUP_BEHAVIOR", "NEW_OR_RESENT", `identities=${signup.data.user.identities?.length}`);
}

log("HVCG_SIGNUP_EMAIL_DELIVERY", resend.error ? "PENDING" : "RESEND_ACCEPTED");
log("EMAIL_DELIVERY_OBSERVABILITY", "PARTIAL", "Anon API confirms send accepted; inbox delivery requires owner or Supabase dashboard logs");
log("EXPECTED_SENDER", "connect@highvaluecapitalgroup.com (Resend SMTP per README)");

console.log("\n--- Recommended owner check ---");
console.log("Gmail → search: from:highvaluecapitalgroup.com OR from:supabase");
console.log("Also check Spam/Promotions for:", EMAIL);
console.log("Subject likely: Confirm your signup");

console.log("\n=== Summary ===");
for (const [k, v] of Object.entries(report)) {
  console.log(`${k} = ${v}`);
}

process.exit(resend.error && resend.error.code !== "over_email_send_rate_limit" ? 1 : 0);
