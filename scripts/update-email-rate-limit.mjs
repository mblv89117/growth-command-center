#!/usr/bin/env node
/**
 * Update Supabase Auth rate_limit_email_sent via Management API.
 * Never prints SUPABASE_ACCESS_TOKEN.
 *
 * Usage:
 *   export SUPABASE_ACCESS_TOKEN="..."   # or set in .env.smtp.local / .env.local
 *   node scripts/update-email-rate-limit.mjs [limit]
 *
 * Default limit: 100
 */
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "igyaebtymornywjeidrl";
const limit = Number(process.argv[2] ?? process.env.EMAIL_RATE_LIMIT ?? 100);

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("FAIL: Set SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}
if (!Number.isFinite(limit) || limit < 1) {
  console.error("FAIL: limit must be a positive number");
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ rate_limit_email_sent: limit }),
});

if (!res.ok) {
  console.error(`FAIL: PATCH ${res.status} — ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

const cfg = await res.json();
const applied = cfg.rate_limit_email_sent;

if (Number(applied) === limit) {
  console.log(`PASS: rate_limit_email_sent updated to ${applied}`);
  process.exit(0);
}

console.log(`WARN: PATCH succeeded but rate_limit_email_sent is ${applied ?? "(missing)"}, expected ${limit}`);
process.exit(applied === limit ? 0 : 1);
