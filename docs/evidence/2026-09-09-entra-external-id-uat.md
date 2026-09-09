# Entra External ID UAT — 2026-09-09

## Verdict
`ENTRA_UAT=PASS` (24/24). `PLAINTEXT_PASSWORDS_HANDLED=0`.
No Supabase password or hash migration.

## Tenant / app (public)
- CIAM tenant: `d253f611-43e0-4d62-ac29-4cf144d48c5f`
- Domain: `gcccustomers.onmicrosoft.com`
- Display: Growth Command Center Customers
- App: Growth Command Center (`ce91aaa0-8f77-428b-8ff1-acbf5cb940f8`)
- Redirect: `https://app.growthcommandcenter.com/auth/callback`
- Logout: `https://app.growthcommandcenter.com/login`
- User flow: `gcc_signup_signin` (`externalUsersSelfServiceSignUpEventsFlow`, email OTP + password, signup allowed)
- Authority: `https://d253f611-43e0-4d62-ac29-4cf144d48c5f.ciamlogin.com/d253f611-43e0-4d62-ac29-4cf144d48c5f`
- OIDC issuer/jwks/authorize/end_session: PASS

## GitHub secret names present (values not read)
`ENTRA_EXTERNAL_TENANT_ID`, `ENTRA_EXTERNAL_CLIENT_ID`, `ENTRA_EXTERNAL_CLIENT_SECRET`, `ENTRA_EXTERNAL_REDIRECT_URI`, `SESSION_SECRET`

Runtime cutover uses Key Vault names `GccEntraExternal*` + `GccEntraSessionSecret` (32-byte A256GCM).

## UAT method
CIAM does not support ROPC (`AADSTS90002`). Login used Playwright + Chrome against the real CIAM authorize page with PKCE; authorization code was exchanged locally. Production callback remained on AUTH_PROVIDER≠entra during UAT.

## Coverage
login, callback, token, id_token, session, expired/tampered session, logout URL, signup config, password-reset UI, identity linking, ClientCode fail-closed, admin role gate, tenant isolation, disabled user, unknown user, Graph disable, session revocation.

## Signup / password-reset email OTP
Email OTP cannot be completed in this environment (no inbox). Config + login-page Forgot password control verified.

## Identity map
25 users exported (ids + emails + timestamps only). Stored as `GccEntraUatUserMap`.
