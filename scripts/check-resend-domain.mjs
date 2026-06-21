#!/usr/bin/env node
/**
 * Check Resend domain verification status (no secrets printed).
 *
 * Usage:
 *   export RESEND_API_KEY="..."
 *   node scripts/check-resend-domain.mjs
 */
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const DOMAIN = process.env.RESEND_DOMAIN ?? "highvaluecapitalgroup.com";
const key = process.env.RESEND_API_KEY;

if (!key) {
  console.error("FAIL: Set RESEND_API_KEY");
  process.exit(1);
}

const res = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${key}` },
});

if (!res.ok) {
  console.error(`FAIL: Resend API ${res.status} — ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}

const body = await res.json();
const domains = body.data ?? [];

console.log("--- Resend domains ---");
if (domains.length === 0) {
  console.log("domains: none found");
  console.log("NOT VERIFIED: add highvaluecapitalgroup.com in Resend dashboard");
  process.exit(1);
}

for (const d of domains) {
  console.log(`- ${d.name}: status=${d.status ?? "unknown"}`);
}

const match = domains.find(
  (d) => d.name === DOMAIN || d.name === `www.${DOMAIN}` || DOMAIN.endsWith(d.name)
);

if (!match) {
  console.log(`NOT VERIFIED: ${DOMAIN} not found in Resend account`);
  process.exit(1);
}

if (match.status === "verified") {
  console.log(`PASS: ${match.name} verified in Resend`);
  console.log(`sender allowed: connect@${DOMAIN} (requires verified domain)`);
  process.exit(0);
}

console.log(`FAIL: ${match.name} status is "${match.status}" — complete DNS in Resend dashboard`);
process.exit(1);
