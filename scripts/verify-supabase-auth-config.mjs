#!/usr/bin/env node
/**
 * Verify Supabase Auth SMTP config — never prints secrets.
 *
 * Usage:
 *   export SUPABASE_ACCESS_TOKEN="..."
 *   npm run smtp:verify
 *
 * Provider (default resend):
 *   SMTP_PROVIDER=resend npm run smtp:verify
 */
import { loadLocalEnv } from "./load-local-env.mjs";
import {
  EMAIL_RATE_LIMIT,
  PRODUCTION_CALLBACK,
  PRODUCTION_SITE_URL,
  resolveSmtpProvider,
} from "./smtp-providers.mjs";

loadLocalEnv();

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "igyaebtymornywjeidrl";

let expected;
try {
  expected = resolveSmtpProvider();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("FAIL: Set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)");
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

console.log(`--- Supabase Auth URLs (provider: ${expected.label}) ---`);
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
console.log(`smtp_user: ${smtpUser || "(not set)"}`);
console.log(`smtp_admin_email: ${adminEmail || "(not set)"}`);
console.log(`smtp_sender_name: ${senderName || "(not set)"}`);
console.log(`smtp_pass configured: ${hasPassword ? "yes (hidden)" : "no"}`);

let smtpOk = true;
if (host !== expected.host) {
  fail("SMTP host", `expected ${expected.host}`);
  smtpOk = false;
} else pass("SMTP host");

if (String(port) !== expected.port) {
  fail("SMTP port", `expected "${expected.port}"`);
  smtpOk = false;
} else pass("SMTP port");

if (smtpUser.toLowerCase() !== expected.user.toLowerCase()) {
  fail("SMTP username", `expected ${expected.user}`);
  smtpOk = false;
} else pass("SMTP username");

if (adminEmail.toLowerCase() !== expected.adminEmail.toLowerCase()) {
  fail("Sender email", `expected ${expected.adminEmail}`);
  smtpOk = false;
} else pass("Sender email");

if (senderName !== expected.senderName) {
  fail("Sender name", `expected ${expected.senderName}`);
  smtpOk = false;
} else pass("Sender name");

if (!hasPassword) {
  fail("SMTP password", "smtp_pass not set");
  smtpOk = false;
} else pass("SMTP password present");

console.log("");
console.log("--- Email provider & rate limits ---");
const usingCustomSmtp = Boolean(host && hasPassword);
if (usingCustomSmtp && host === "smtp.resend.com") {
  console.log("provider: Custom SMTP (Resend)");
} else if (usingCustomSmtp && host === "smtp.office365.com") {
  console.log("provider: Custom SMTP (Microsoft 365 — migrate to Resend)");
} else if (host) {
  console.log("provider: Incomplete custom SMTP");
  smtpOk = false;
} else {
  console.log("provider: Supabase default email");
  smtpOk = false;
}

const emailRateLimit = cfg.rate_limit_email_sent;
console.log(`rate_limit_email_sent: ${emailRateLimit ?? "(not returned)"}`);
if (Number(emailRateLimit) === EMAIL_RATE_LIMIT) pass("Rate limit");
else fail("Rate limit", `expected ${EMAIL_RATE_LIMIT}`);

console.log("");
console.log(`SMTP configured overall: ${smtpOk ? "PASS" : "FAIL"}`);
process.exit(smtpOk ? 0 : 1);
