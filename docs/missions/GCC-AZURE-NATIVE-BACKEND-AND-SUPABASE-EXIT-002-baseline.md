# Azure hosting baseline — GCC-AZURE-NATIVE-BACKEND-AND-SUPABASE-EXIT-002

Captured: 2026-09-02T20:30:00Z

| Field | Value |
|-------|-------|
| Canonical main SHA | ea4877700004bcb9888f930e0ca500546fae8abc |
| Baseline PR lineage | #111 → #112 (ea48777) |
| Health | https://app.growthcommandcenter.com/api/health → HTTP 200 |
| Login | https://app.growthcommandcenter.com/login → HTTP 200 |
| Apex / WWW | HTTP 200 (custom domains + managed certs) |
| Hosting | Azure Container Apps — DO NOT reopen DNS |
| Auth runtime (current) | Supabase Auth |
| DB runtime (current) | Supabase Postgres via @supabase/ssr |
| Storage / Realtime | NONE |
| Vercel | Rollback only until Azure-native backend stable |

AZURE_HOSTING_BASELINE_CAPTURED = PASS
