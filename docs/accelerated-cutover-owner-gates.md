# GCC Accelerated Cutover — Owner Gates

**Mission:** `GCC-AZURE-NATIVE-CUTOVER-AND-SUPABASE-EXIT-001`  
**Repo:** https://github.com/mblv89117/growth-command-center

Agent cannot read/write GitHub Actions secret **values** (API 403). Presence is verified only by workflow runs.

---

## Current certification status (2026-09-02, run `33605754558`)

| Gate | Status |
|------|--------|
| Required Supabase secrets present | **PASS** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`) |
| `SUPABASE_DB_PASSWORD` / `SUPABASE_DATABASE_URL` | ABSENT (OK — Management API path used) |
| `SUPABASE_KEY_COMPATIBILITY` (legacy anon/service_role) | **PASS** |
| `RLS_MIGRATION_APPLIED` | **PASS** |
| Anonymous tenant / server table access | **DENIED** |
| Cross-tenant leakage | **0** |
| Azure Container App | **LIVE_GCC** `azapprngzn` (not helloworld) |
| Environment | `azcaerngzn` |
| Revision | `azapprngzn--0000013` ready; `azapprngzn--0000015` created |
| Default FQDN health | **PASS** — https://azapprngzn.nicecoast-be020962.eastus.azurecontainerapps.io/api/health |
| Pre-cutover UAT | **PASS** (`GCC_COMMERCIAL_GOLIVE_CERTIFICATION = PASS`) |
| Host-header domain smoke | **DEFERRED** until custom domains bound |
| Vercel rollback | **AVAILABLE** (DNS still on Vercel) |

---

## Owner action NOW — Stage 2b DNS

Do **not** invent DNS values. Run the binder workflow, then apply only printed records.

### 1) Run binder

1. Open: https://github.com/mblv89117/growth-command-center/actions/workflows/azure-bind-custom-domains.yml
2. **Run workflow** → branch `main` (after merge) → Run
3. Download artifact `gcc-azure-dns-records` or copy from job summary

### 2) Add GoDaddy records (exact values from Azure output)

```
HOST = asuid
TYPE = TXT
VALUE = <CUSTOM_DOMAIN_VERIFICATION_ID from workflow>
TTL = 600
PURPOSE = Azure domain verification (apex)

HOST = asuid.www
TYPE = TXT
VALUE = <same verification id>
TTL = 600
PURPOSE = Azure domain verification (www)

HOST = asuid.app
TYPE = TXT
VALUE = <same verification id>
TTL = 600
PURPOSE = Azure domain verification (app)

HOST = @
TYPE = A
VALUE = <ENVIRONMENT_STATIC_IP from workflow>
TTL = 600
PURPOSE = Apex → Azure Container Apps

HOST = www
TYPE = CNAME
VALUE = azapprngzn.nicecoast-be020962.eastus.azurecontainerapps.io
TTL = 600
PURPOSE = www → Azure default FQDN

HOST = app
TYPE = CNAME
VALUE = azapprngzn.nicecoast-be020962.eastus.azurecontainerapps.io
TTL = 600
PURPOSE = app → Azure default FQDN
```

### 3) Records to remove/replace at cutover (current Vercel)

```
HOST = @
TYPE = A
VALUE = 216.150.1.1
PURPOSE = REPLACE — Vercel apex

HOST = www
TYPE = CNAME
VALUE = growthcommandcenter.com
PURPOSE = REPLACE — currently aliases apex/Vercel

HOST = app
TYPE = CNAME
VALUE = c180f1d2697e4ac8.vercel-dns-017.com
PURPOSE = REPLACE — Vercel app hostname
```

### Cutover order

1. Create TXT `asuid*` first; wait for Azure hostname = Succeeded/Provisioned
2. Switch A/CNAME traffic
3. Re-run Host-header smoke against `https://app.growthcommandcenter.com`
4. Keep Vercel project live until Azure production is stable

---

## Stage 3 — Supabase exit (after DNS)

### 3a. Azure PostgreSQL

1. https://github.com/mblv89117/growth-command-center/settings/secrets/actions → **New repository secret**
2. Name: `AZURE_POSTGRES_ADMIN_PASSWORD`
3. Value: 32+ char password (do not paste in chat)
4. Run workflow **Azure PostgreSQL Stage 3 Provision** with confirm=`PROVISION`
5. Add `AZURE_DATABASE_URL` from printed FQDN (GitHub UI only)

### 3b. Entra External ID

Follow click-by-click: `docs/entra-external-id-setup.md`

Secrets to create (values only in GitHub UI):

- `ENTRA_EXTERNAL_TENANT_ID`
- `ENTRA_EXTERNAL_CLIENT_ID`
- `ENTRA_EXTERNAL_CLIENT_SECRET`
- `ENTRA_EXTERNAL_REDIRECT_URI` = `https://app.growthcommandcenter.com/auth/callback`

### 3c. Identity migration

`npm run export:identity-map` exports email + user id only.  
`PLAINTEXT_PASSWORDS_HANDLED = 0`

---

## Do not

- Paste secret values in chat or commits
- Cut DNS before Azure hostname bindings are Provisioned
- Decommission Supabase or Vercel until Azure-native UAT PASS
- Switch to Supabase `sb_publishable` / `sb_secret` keys during this cutover
