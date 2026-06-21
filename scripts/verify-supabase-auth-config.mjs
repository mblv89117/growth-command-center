#!/usr/bin/env node
/**
 * Read Supabase Auth config via Management API — never prints secrets.
 *
 * Usage:
 *   export SUPABASE_ACCESS_TOKEN="..."   # https://supabase.com/dashboard/account/tokens
 *   node scripts/verify-supabase-auth-config.mjs
 */
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "igyaebtymornywjeidrl";
const PRODUCTION_SITE_URL = "https://growth-command-center-lbnt.vercel.app";
const PRODUCTION_CALLBACK = `${PRODUCTION_SITE_URL}/auth/callback`;
const EXPECTED_SMTP_HOST = "smtp.office365.com";
const EXPECTED_SMTP_PORT = "587";
const EXPECTED_SMTP_USER = process.env.SMTP_USERNAME ?? "manny@highvaluecapitalgroup.com";
const EXPECTED_SENDER = process.env.SMTP_SENDER_EMAIL ?? "connect@highvaluecapitalgroup.com";
const EXPECTED_SENDER_NAME = "Growth Command Center";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("FAIL: Set SUPABASE_ACCESS_TOKEN (Supabase Dashboard → Account → Access Tokens)");
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  headers: { Authorization: `Bearer ${token}` },
});

if (!res.ok) {
  console.error(`FAIL: Management API ${res.status} — ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}

const cfg = await res.json();

function pass(label) {
  console.log(`PASS: ${label}`);
}
function fail(label, detail = "") {
  console.log(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

const siteUrl = cfg.site_url ?? "";
const allowList = cfg.uri_allow_list ?? cfg.additional_redirect_urls ?? "";

console.log("--- Supabase Auth URLs ---");
console.log(`site_url: ${siteUrl || "(empty)"}`);
console.log(`redirect allowlist: ${allowList || "(empty)"}`);

if (siteUrl === PRODUCTION_SITE_URL) pass("Site URL matches production");
else fail("Site URL", `expected ${PRODUCTION_SITE_URL}`);

const allowText = Array.isArray(allowList) ? allowList.join(",") : String(allowList);
if (allowText.includes(PRODUCTION_CALLBACK)) pass("Redirect allowlist includes /auth/callback");
else fail("Redirect allowlist", `expected ${PRODUCTION_CALLBACK}`);

console.log("");
console.log("--- Supabase SMTP (redacted) ---");
const host = cfg.smtp_host ?? "";
const port = cfg.smtp_port ?? null;
const smtpUser = cfg.smtp_user ?? "";
const adminEmail = cfg.smtp_admin_email ?? "";
const senderName = cfg.smtp_sender_name ?? "";
const hasPassword = Boolean(cfg.smtp_pass);

console.log(`smtp_host: ${host || "(not set)"}`);
console.log(`smtp_port: ${port ?? "(not set)"}`);
console.log(`smtp_user: ${smtpUser ? smtpUser.replace(/(.{2}).*(@.*)/, "$1***$2") : "(not set)"}`);
console.log(`smtp_admin_email: ${adminEmail || "(not set)"}`);
console.log(`smtp_sender_name: ${senderName || "(not set)"}`);
console.log(`smtp_pass configured: ${hasPassword ? "yes (hidden)" : "no"}`);

let smtpOk = true;
if (host !== EXPECTED_SMTP_HOST) {
  fail("SMTP host", `expected ${EXPECTED_SMTP_HOST}`);
  smtpOk = false;
} else pass("SMTP host");

if (String(port) !== EXPECTED_SMTP_PORT) {
  fail("SMTP port", `expected "${EXPECTED_SMTP_PORT}"`);
  smtpOk = false;
} else pass("SMTP port");

if (smtpUser.toLowerCase() !== EXPECTED_SMTP_USER.toLowerCase()) {
  fail("SMTP username", `expected ${EXPECTED_SMTP_USER} (primary mailbox, not alias)`);
  smtpOk = false;
} else pass("SMTP username (primary mailbox)");

if (adminEmail.toLowerCase() !== EXPECTED_SENDER.toLowerCase()) {
  fail("Sender email", `expected ${EXPECTED_SENDER} (alias From)`);
  smtpOk = false;
} else pass("Sender email (alias From)");

if (senderName !== EXPECTED_SENDER_NAME) {
  fail("Sender name", `expected ${EXPECTED_SENDER_NAME}`);
  smtpOk = false;
} else pass("Sender name");

if (!hasPassword) {
  fail("SMTP password", "smtp_pass not set");
  smtpOk = false;
} else pass("SMTP password present");

console.log("");
if (smtpOk) {
  console.log("SMTP configured overall: PASS");
  console.log("Reminder: test a Team invite and confirm From is connect@, not manny@.");
} else {
  console.log("SMTP configured overall: FAIL");
}
process.exit(smtpOk ? 0 : 1);
