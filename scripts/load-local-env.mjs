import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

/** Load non-secret and secret env vars from local files (never logged). */
export function loadLocalEnv(cwd = process.cwd()) {
  for (const name of [".env.smtp.local", ".env.local"]) {
    const path = resolve(cwd, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }

  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    try {
      const fromLaunchctl = execSync("launchctl getenv SUPABASE_ACCESS_TOKEN", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (fromLaunchctl) process.env.SUPABASE_ACCESS_TOKEN = fromLaunchctl;
    } catch {
      /* not set in launchctl */
    }
  }

  if (!process.env.RESEND_API_KEY) {
    try {
      const fromLaunchctl = execSync("launchctl getenv RESEND_API_KEY", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (fromLaunchctl) process.env.RESEND_API_KEY = fromLaunchctl;
    } catch {
      /* not set in launchctl */
    }
  }

  const tokenFile = process.env.SUPABASE_ACCESS_TOKEN_FILE;
  if (!process.env.SUPABASE_ACCESS_TOKEN && tokenFile && existsSync(tokenFile)) {
    const value = readFileSync(tokenFile, "utf8").trim();
    if (value) process.env.SUPABASE_ACCESS_TOKEN = value;
  }
}
