#!/usr/bin/env node
/**
 * Add domain to Resend (if missing) and print DNS records — no secrets printed.
 *
 * Usage:
 *   node scripts/resend-domain-dns.mjs
 *   node scripts/resend-domain-dns.mjs --verify-only
 */
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const DOMAIN = process.env.RESEND_DOMAIN ?? "highvaluecapitalgroup.com";
const verifyOnly = process.argv.includes("--verify-only");
const key = process.env.RESEND_API_KEY;

if (!key) {
  console.error("FAIL: Set RESEND_API_KEY in .env.smtp.local");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function listDomains() {
  const res = await fetch("https://api.resend.com/domains", { headers });
  if (!res.ok) throw new Error(`list domains ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return body.data ?? [];
}

async function createDomain() {
  const res = await fetch("https://api.resend.com/domains", {
    method: "POST",
    headers,
    body: JSON.stringify({ name: DOMAIN }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`create domain ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function getDomain(id) {
  const res = await fetch(`https://api.resend.com/domains/${id}`, { headers });
  if (!res.ok) throw new Error(`get domain ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function printDnsTable(records, domain) {
  console.log("");
  console.log(`--- DNS records for ${domain} (add at your DNS host) ---`);
  console.log("| Type | Name/Host | Value | Priority | TTL | Status |");
  console.log("|------|-----------|-------|----------|-----|--------|");
  for (const r of records) {
    const host = r.name?.includes(".") ? r.name : `${r.name}.${domain}`;
    const value = String(r.value ?? "").replace(/\|/g, "\\|");
    console.log(
      `| ${r.type ?? ""} | ${host} | ${value} | ${r.priority ?? "—"} | ${r.ttl ?? "Auto"} | ${r.status ?? ""} |`
    );
  }
  console.log("");
  console.log("Copy/paste notes:");
  for (const r of records) {
    const host = r.name?.includes(".") ? r.name : `${r.name}.${domain}`;
    console.log(`- ${r.type}  ${host}  →  ${r.value}${r.priority != null ? `  (priority ${r.priority})` : ""}`);
  }
}

let domains = await listDomains();
let domain = domains.find((d) => d.name === DOMAIN);

if (!domain && !verifyOnly) {
  console.log(`Creating domain in Resend: ${DOMAIN}`);
  const created = await createDomain();
  domain = { id: created.id, name: created.name, status: created.status };
  if (created.records?.length) {
    printDnsTable(created.records, DOMAIN);
  }
}

if (!domain) {
  console.log(`FAIL: ${DOMAIN} not in Resend account`);
  process.exit(1);
}

const detail = await getDomain(domain.id);
console.log(`Domain: ${detail.name}`);
console.log(`Status: ${detail.status}`);
console.log(`Region: ${detail.region ?? "n/a"}`);

if (detail.records?.length) {
  printDnsTable(detail.records, DOMAIN);
}

if (detail.status === "verified") {
  console.log("PASS: domain verified");
  process.exit(0);
}

console.log(`PENDING: domain status is "${detail.status}" — add DNS records above, then re-run npm run smtp:check-resend`);
process.exit(1);
