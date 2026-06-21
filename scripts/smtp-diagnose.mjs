#!/usr/bin/env node
/**
 * Diagnose Supabase Auth email provider and rate limits (no secrets printed).
 */
import { loadLocalEnv } from "./load-local-env.mjs";
import { EMAIL_RATE_LIMIT } from "./smtp-providers.mjs";

loadLocalEnv();

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "igyaebtymornywjeidrl";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("FAIL: Set SUPABASE_ACCESS_TOKEN");
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

const host = cfg.smtp_host ?? "";
const hasCustomSmtp = Boolean(host && cfg.smtp_pass);

console.log("--- Email provider ---");
if (hasCustomSmtp && host === "smtp.resend.com") {
  console.log("Provider: Custom SMTP (Resend)");
} else if (hasCustomSmtp && host === "smtp.office365.com") {
  console.log("Provider: Custom SMTP (Microsoft 365 — should migrate to Resend)");
} else if (host) {
  console.log("Provider: Custom SMTP host set but smtp_pass missing — incomplete config");
} else {
  console.log("Provider: Supabase default email (NOT custom SMTP)");
}

console.log(`smtp_host: ${host || "(not set)"}`);
console.log(`smtp_port: ${cfg.smtp_port ?? "(not set)"}`);
console.log(`smtp_user: ${cfg.smtp_user ?? "(not set)"}`);
console.log(`smtp_admin_email: ${cfg.smtp_admin_email ?? "(not set)"}`);

console.log("");
console.log("--- Auth rate limits (Supabase GoTrue) ---");
console.log(`rate_limit_email_sent: ${cfg.rate_limit_email_sent ?? "(not in response)"} (expected ${EMAIL_RATE_LIMIT})`);

console.log("");
console.log("--- URLs ---");
console.log(`site_url: ${cfg.site_url ?? "(empty)"}`);
console.log(`uri_allow_list: ${cfg.uri_allow_list ?? "(empty)"}`);
