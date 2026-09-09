# Deprecated Vercel configuration (archived)

**Production source of truth:** Azure Container Apps + `.github/workflows/azure-production.yml`.

This directory preserves the former root `vercel.json` for historical reference only. It is **not** used by production deploys or the Next.js build.

- Daily health checks: `.github/workflows/azure-health-ping.yml` (replaces Vercel cron on `/api/health`).
- Do not restore `vercel.json` to the repo root unless explicitly rolling back hosting (not recommended).
