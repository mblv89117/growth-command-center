#!/usr/bin/env node
/**
 * Sync production secrets from Vercel → GitHub Actions (for Azure deploy workflow).
 *
 * Requires:
 *   VERCEL_TOKEN — Vercel personal/team token with project read
 *   GITHUB_TOKEN or gh auth — token with repo secrets write (admin:repo_hook or actions:write)
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/sync-production-secrets.mjs
 *   node scripts/sync-production-secrets.mjs --dry-run
 *
 * Never prints secret values. Never writes .env files to disk.
 */
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const REPO = process.env.GITHUB_REPOSITORY ?? "mblv89117/growth-command-center";
const VERCEL_PROJECT = process.env.VERCEL_PROJECT ?? "growth-command-center";
const VERCEL_ORG = process.env.VERCEL_ORG_ID ?? process.env.VERCEL_TEAM_ID ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const OPTIONAL = [
  "ANTHROPIC_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_STARTER_PRICE_ID",
  "STRIPE_GROWTH_PRICE_ID",
  "STRIPE_ENTERPRISE_PRICE_ID",
  "QUICKBOOKS_CLIENT_ID",
  "QUICKBOOKS_CLIENT_SECRET",
  "QUICKBOOKS_REDIRECT_URI",
  "QUICKBOOKS_ENV",
  "PLAID_CLIENT_ID",
  "PLAID_SECRET",
  "PLAID_ENV",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "HUBSPOT_CLIENT_ID",
  "GUSTO_CLIENT_ID",
  "SALESFORCE_CLIENT_ID",
];

function parseEnvOutput(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function fetchVercelProductionEnv() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;

  try {
    const tmp = path.join(os.tmpdir(), `gcc-vercel-env-${Date.now()}.env`);
    const scopeFlag = VERCEL_ORG ? `--scope ${VERCEL_ORG}` : "";
    execSync(
      `npx --yes vercel env pull "${tmp}" --environment=production --yes ${scopeFlag}`,
      {
        env: { ...process.env, VERCEL_TOKEN: token, VERCEL_PROJECT },
        stdio: ["pipe", "pipe", "pipe"],
      }
    );
    const out = fs.readFileSync(tmp, "utf8");
    fs.unlinkSync(tmp);
    return parseEnvOutput(out);
  } catch {
    return null;
  }
}

function setGitHubSecret(name, value) {
  if (DRY_RUN) {
    console.log(`[dry-run] would set GitHub secret: ${name}`);
    return true;
  }
  try {
    execSync(`gh secret set "${name}" --repo "${REPO}" --body "${value.replace(/"/g, '\\"')}"`, {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
    });
    console.log(`SET: ${name}`);
    return true;
  } catch (err) {
    console.error(`FAIL: ${name} — ${err.message?.slice(0, 80) ?? "unknown"}`);
    return false;
  }
}

async function main() {
  console.log("Production secret sync — Vercel → GitHub Actions");
  console.log(`Repository: ${REPO}`);

  const vercelEnv = fetchVercelProductionEnv();
  if (!vercelEnv) {
    console.error("BLOCKER: VERCEL_TOKEN not set or vercel env pull failed.");
    console.error("Owner action: add GitHub repository secrets manually (Settings → Secrets → Actions):");
    for (const k of [...REQUIRED, ...OPTIONAL]) {
      console.error(`  - ${k}`);
    }
    process.exit(2);
  }

  const missing = REQUIRED.filter((k) => !vercelEnv.get(k));
  if (missing.length) {
    console.error("BLOCKER: Vercel production missing required vars:", missing.join(", "));
    process.exit(2);
  }

  let synced = 0;
  for (const key of [...REQUIRED, ...OPTIONAL]) {
    const value = vercelEnv.get(key);
    if (!value) continue;
    if (setGitHubSecret(key, value)) synced += 1;
  }

  console.log(`\nSynced ${synced} secret(s)${DRY_RUN ? " (dry-run)" : ""}.`);
  console.log("Next: gh workflow run \"Azure Production Deploy\" --ref main");
}

main();
