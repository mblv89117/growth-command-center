# Microsoft Entra External ID — GCC Stage 3 Setup

**Mission:** `GCC-AZURE-NATIVE-CUTOVER-AND-SUPABASE-EXIT-001`  
**Goal:** Replace Supabase Auth for customer login with **Microsoft Entra External ID (CIAM)**.  
Do **not** use workforce Entra ID as a substitute unless architecture explicitly requires it.

Code scaffold: `src/lib/auth/entra/config.ts`  
Keep `AUTH_PROVIDER=supabase` until Entra UAT passes.

---

## Owner gate A — Create External ID (CIAM) tenant

1. Open https://entra.microsoft.com/  
2. Sign in with the HVCG Microsoft account that can create tenants.  
3. Top-right directory switcher → **Create a tenant** (or **Identity** → **Overview** → **Manage tenants** → **Create**).  
4. Select **Customer** (this is External ID / CIAM — not Workforce).  
5. Organization name: `Growth Command Center Customers`  
6. Domain name: choose an available `*.onmicrosoft.com` (example pattern: `growthcommandcentercustomers`).  
7. Complete create; wait until the tenant is ready.  
8. Switch into the **new Customer tenant**.  
9. **Identity** → **Overview** → copy **Tenant ID**.  
10. GitHub → https://github.com/mblv89117/growth-command-center/settings/secrets/actions → **New repository secret**  
    - Name: `ENTRA_EXTERNAL_TENANT_ID`  
    - Value: paste Tenant ID (only in GitHub UI)

---

## Owner gate B — Register the GCC web app

Still in the **External ID customer tenant**:

1. **Applications** → **App registrations** → **New registration**  
2. Name: `Growth Command Center`  
3. Supported account types: **Accounts in this organizational directory only**  
4. Redirect URI:  
   - Platform: **Web**  
   - URI: `https://app.growthcommandcenter.com/auth/callback`  
5. Register.  
6. Copy **Application (client) ID** → GitHub secret `ENTRA_EXTERNAL_CLIENT_ID`  
7. **Certificates & secrets** → **New client secret**  
   - Description: `gcc-prod`  
   - Expires: 24 months (or org policy)  
   - **Add** → copy the **Value** once → GitHub secret `ENTRA_EXTERNAL_CLIENT_SECRET`  
8. GitHub secret `ENTRA_EXTERNAL_REDIRECT_URI` = `https://app.growthcommandcenter.com/auth/callback`  
9. (Optional) Authentication → Front-channel logout URL: `https://app.growthcommandcenter.com/login`

---

## Owner gate C — User flow (sign-up / sign-in / reset)

1. In External ID tenant: **External Identities** → **User flows** (wording may show **User flows** under CIAM).  
2. **New user flow** → **Sign up and sign in**  
3. Name: `gcc_signup_signin`  
4. Identity providers: **Email with password**  
5. User attributes: collect **Email**; return **Email**, **Display Name**  
6. Create flow → **Applications** → **Add application** → select `Growth Command Center`  
7. Confirm **Password reset** / self-service reset is enabled for the flow (or create a Reset password flow and link the same app)

---

## Owner gate D — API permissions / admin consent

1. App registration → **API permissions**  
2. Ensure Microsoft Graph delegated permissions needed for sign-in are present (typically `openid`, `offline_access`, `profile`, and any CIAM-required defaults).  
3. Click **Grant admin consent for \<tenant\>**  
4. Status must show granted (green)

---

## Owner gate E — Return values to GitHub (names only in chat)

| GitHub secret name | Portal field |
|--------------------|--------------|
| `ENTRA_EXTERNAL_TENANT_ID` | Tenant ID |
| `ENTRA_EXTERNAL_CLIENT_ID` | Application (client) ID |
| `ENTRA_EXTERNAL_CLIENT_SECRET` | Client secret **Value** |
| `ENTRA_EXTERNAL_REDIRECT_URI` | `https://app.growthcommandcenter.com/auth/callback` |

Also set Azure Container App secret / env when cutting auth:

| Name | Value |
|------|-------|
| `AUTH_PROVIDER` | `entra` (only after UAT) |
| `ENTRA_EXTERNAL_AUTHORITY` | usually `https://<tenant-id>.ciamlogin.com/<tenant-id>` |

---

## Identity migration (agent-automated; no passwords)

1. Export map: `npm run export:identity-map` (email + supabase user id only).  
2. Table `gcc_identity_links`: `supabase_user_id` → `entra_object_id`.  
3. Invite/activate users via Entra invitation / first-login link.  
4. **PLAINTEXT_PASSWORDS_HANDLED = 0** — never migrate password hashes/plaintext.

---

## Rollback

Keep Supabase Auth credentials and `AUTH_PROVIDER=supabase` until:

- Entra login/logout/session PASS  
- Owner/admin + client role parity PASS  
- Tenant isolation PASS  

Dual-auth window: max ~2 weeks, then remove Supabase Auth dependency.
