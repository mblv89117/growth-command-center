# Microsoft Entra External ID — GCC Stage 3 Setup

**Mission:** `GCC-AZURE-NATIVE-CUTOVER-AND-SUPABASE-EXIT-001`

Customer authentication target for GCC (replaces Supabase Auth). This is **workforce Entra ID** vs **Entra External ID (CIAM)** — use External ID for client tenants.

---

## 1. Create External ID tenant

1. Open [Microsoft Entra admin center](https://entra.microsoft.com/)
2. **Identity** → **Overview** → **Manage your tenant** → **Create**
3. Choose **Customer** (External ID / CIAM)
4. Record **Tenant ID** → `ENTRA_EXTERNAL_TENANT_ID`

---

## 2. Register application

1. **Applications** → **App registrations** → **New registration**
2. Name: `Growth Command Center`
3. Supported account types: **Accounts in this organizational directory only** (External ID users)
4. Redirect URI (Web): `https://app.growthcommandcenter.com/auth/callback`
5. Record **Application (client) ID** → `ENTRA_EXTERNAL_CLIENT_ID`

Create client secret → **Certificates & secrets** → `ENTRA_EXTERNAL_CLIENT_SECRET`

---

## 3. User flows

1. **External Identities** → **User flows**
2. Create **Sign up and sign in** flow
3. Enable email signup, password reset
4. Link application to user flow

---

## 4. Identity migration (from Supabase)

Do **not** export plaintext passwords.

1. Export Supabase users (email, id, created_at) via service role / SQL
2. Create `gcc_identity_links` table mapping `supabase_user_id` → `entra_object_id`
3. Send **account activation** email via Entra invitation API
4. On first Entra login, link profile in `gcc_profiles`

---

## 5. Application configuration

Set in Azure Container App secrets / GitHub Actions:

| Variable | Purpose |
|----------|---------|
| `AUTH_PROVIDER` | Set to `entra` when ready (default `supabase`) |
| `ENTRA_EXTERNAL_TENANT_ID` | CIAM tenant GUID |
| `ENTRA_EXTERNAL_CLIENT_ID` | App registration client ID |
| `ENTRA_EXTERNAL_CLIENT_SECRET` | Client secret |
| `ENTRA_EXTERNAL_REDIRECT_URI` | OAuth callback |
| `DATABASE_URL` | Azure PostgreSQL connection string |

Code scaffold: `src/lib/auth/entra/config.ts`

---

## 6. Rollback

Keep `AUTH_PROVIDER=supabase` until Entra UAT passes. Dual-auth period max 2 weeks recommended.

---

## 7. Owner interactive gates

- External ID tenant creation (requires Microsoft account with billing)
- Admin consent for app permissions
- Custom domain for branded login (optional)

Agent cannot complete these without owner Microsoft portal access.
