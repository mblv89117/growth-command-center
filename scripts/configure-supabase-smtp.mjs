#!/usr/bin/env node
/**
 * Configure Supabase Auth custom SMTP (Microsoft 365) via Management API.
 *
 * Microsoft 365 layout:
 *   - SMTP username (login): manny@highvaluecapitalgroup.com (primary mailbox)
 *   - Sender / From:         connect@highvaluecapitalgroup.com (alias on manny@)
 *
 * Password is read from SMTP_MAILBOX_PASSWORD env var only — never printed.
 * Use the manny@ mailbox password (not pasted into chat).
 *
 * Usage:
 *   export SUPABASE_ACCESS_TOKEN="..."     # https://supabase.com/dashboard/account/tokens
 *   export SMTP_MAILBOX_PASSWORD="..."     # manny@ password; enter locally only
 *   node scripts/configure-supabase-smtp.mjs
 *
 * Optional overrides:
 *   SMTP_USERNAME=manny@... SMTP_SENDER_EMAIL=connect@...
 *
 * Dry run (no PATCH, no secrets):
 *   node scripts/configure-supabase-smtp.mjs --dry-run
 */
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "igyaebtymornywjeidrl";
const PRODUCTION_SITE_URL = "https://growth-command-center-lbnt.vercel.app";
const PRODUCTION_CALLBACK = `${PRODUCTION_SITE_URL}/auth/callback`;

const SMTP = {
  host: "smtp.office365.com",
  /** Supabase Management API expects smtp_port as a string */
  port: "587",
  /** Primary mailbox — used for SMTP AUTH login */
  user: process.env.SMTP_USERNAME ?? "manny@highvaluecapitalgroup.com",
  /** Alias — used as From / sender email if Microsoft allows alias sending */
  adminEmail: process.env.SMTP_SENDER_EMAIL ?? "connect@highvaluecapitalgroup.com",
  senderName: "Growth Command Center",
};

const dryRun = process.argv.includes("--dry-run");
const token = process.env.SUPABASE_ACCESS_TOKEN;
const password = process.env.SMTP_MAILBOX_PASSWORD;

if (!dryRun && !token) {
  console.error("FAIL: Set SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}
if (!password && !dryRun) {
  console.error(
    "FAIL: Set SMTP_MAILBOX_PASSWORD locally (manny@ mailbox password — do not paste into chat)"
  );
  process.exit(1);
}

const payload = {
  external_email_enabled: true,
  mailer_secure_email_change_enabled: true,
  mailer_autoconfirm: false,
  site_url: PRODUCTION_SITE_URL,
  uri_allow_list: PRODUCTION_CALLBACK,
  smtp_host: SMTP.host,
  smtp_port: SMTP.port,
  smtp_user: SMTP.user,
  smtp_pass: password ?? "(dry-run — unchanged)",
  smtp_admin_email: SMTP.adminEmail,
  smtp_sender_name: SMTP.senderName,
};

if (dryRun) {
  const { smtp_pass: _p, ...safe } = payload;
  console.log("DRY RUN — would PATCH auth config with:");
  console.log(JSON.stringify({ ...safe, smtp_pass: "(hidden)" }, null, 2));
  console.log("");
  console.log("Note: smtp_user = primary mailbox login; smtp_admin_email = From alias.");
  console.log("If invite emails show From: manny@ instead of connect@, alias sending is blocked.");
  console.log("Fix: shared mailbox for connect@, or switch to Resend/Postmark.");
  process.exit(0);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

if (!res.ok) {
  console.error(`FAIL: PATCH ${res.status} — ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

console.log("PASS: Supabase Auth SMTP configured (Microsoft 365)");
console.log(`  Host: ${SMTP.host}:${SMTP.port} (STARTTLS)`);
console.log(`  SMTP username: ${SMTP.user}`);
console.log(`  Sender: ${SMTP.senderName} <${SMTP.adminEmail}>`);
console.log(`  Site URL: ${PRODUCTION_SITE_URL}`);
console.log(`  Redirect: ${PRODUCTION_CALLBACK}`);
console.log("");
console.log("Run: npm run smtp:verify");
console.log("Then test Team invite — confirm From is connect@, not manny@.");
