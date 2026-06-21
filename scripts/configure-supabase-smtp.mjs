#!/usr/bin/env node
/**
 * Configure Supabase Auth custom SMTP via Management API.
 * Default provider: Resend (SMTP_PROVIDER=resend).
 *
 * Resend:
 *   export SUPABASE_ACCESS_TOKEN="..."
 *   export RESEND_API_KEY="..."
 *   node scripts/configure-supabase-smtp.mjs
 *
 * Legacy Microsoft 365 (not recommended — Security Defaults blocks SMTP AUTH):
 *   SMTP_PROVIDER=m365 SMTP_MAILBOX_PASSWORD="..." node scripts/configure-supabase-smtp.mjs
 *
 * Dry run:
 *   npm run smtp:dry-run
 */
import { loadLocalEnv } from "./load-local-env.mjs";
import {
  buildAuthSmtpPayload,
  PRODUCTION_CALLBACK,
  PRODUCTION_SITE_URL,
  resolveSmtpProvider,
} from "./smtp-providers.mjs";

loadLocalEnv();

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "igyaebtymornywjeidrl";
const dryRun = process.argv.includes("--dry-run");
const token = process.env.SUPABASE_ACCESS_TOKEN;

let provider;
try {
  provider = resolveSmtpProvider();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}

const password = process.env[provider.passwordEnv];

if (!dryRun && !token) {
  console.error("FAIL: Set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)");
  process.exit(1);
}
if (!password && !dryRun) {
  console.error(`FAIL: Set ${provider.passwordEnv} locally (do not paste into chat)`);
  process.exit(1);
}

const payload = buildAuthSmtpPayload(provider, password ?? "(dry-run — unchanged)");

if (dryRun) {
  const { smtp_pass: _p, ...safe } = payload;
  console.log(`DRY RUN — provider: ${provider.label} (${provider.id})`);
  console.log(JSON.stringify({ ...safe, smtp_pass: "(hidden)" }, null, 2));
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

console.log(`PASS: Supabase Auth SMTP configured (${provider.label})`);
console.log(`  Host: ${provider.host}:${provider.port}`);
console.log(`  SMTP username: ${provider.user}`);
console.log(`  Sender: ${provider.senderName} <${provider.adminEmail}>`);
console.log(`  Site URL: ${PRODUCTION_SITE_URL}`);
console.log(`  Redirect: ${PRODUCTION_CALLBACK}`);
console.log(`  rate_limit_email_sent: ${payload.rate_limit_email_sent}`);
console.log("");
console.log("Run: npm run smtp:verify && npm run smtp:diagnose");
