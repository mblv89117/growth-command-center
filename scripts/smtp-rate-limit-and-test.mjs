#!/usr/bin/env node
/**
 * Update rate limit, diagnose, then one controlled invite test.
 * Never prints secrets. Loads .env.smtp.local / .env.local automatically.
 */
import { loadLocalEnv } from "./load-local-env.mjs";
import { spawnSync } from "node:child_process";

loadLocalEnv();

function run(label, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync("node", args, {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("Update rate_limit_email_sent to 100", ["scripts/update-email-rate-limit.mjs", "100"]);
run("Diagnose SMTP and rate limits", ["scripts/smtp-diagnose.mjs"]);

const inviteEmail =
  process.argv[2] ?? process.env.INVITE_TEST_EMAIL ?? "manny.barela2026@gmail.com";
run(`Controlled invite test (${inviteEmail})`, [
  "--env-file=.env.local",
  "scripts/test-invite-once.mjs",
  inviteEmail,
]);
