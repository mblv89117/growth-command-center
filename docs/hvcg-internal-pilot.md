# HVCG Internal Pilot Runbook

**Mission:** GCC-HVCG-INTERNAL-PILOT-001  
**Production:** https://growth-command-center-lbnt.vercel.app  
**Pilot company:** High Value Capital Group LLC  
**Certification path:** Real user (no service role)

---

## 1. Pilot status

| Step | Status | Notes |
|------|--------|-------|
| Signup initiated | ✅ | `manny.barela2026+hvcg-pilot@gmail.com` + company **High Value Capital Group LLC** |
| Email confirmation | ⏳ Owner | Gmail inbox — click Supabase confirmation link |
| Authenticated session | ⏳ | Blocked until email confirmed |
| HVCG data import | ⏳ Owner | `docs/hvcg-pilot-data-OWNER-INPUT-REQUIRED.md` |
| Full journey certification | ⏳ | `npm run pilot:hvcg` after above |

**Do not use:** `org-apex`, `org-summit`, or synthetic UAT data for HVCG pilot proof.

---

## 2. Owner steps (one batched action)

1. **Confirm email** — Open Gmail for `manny.barela2026@gmail.com`, find the GCC confirmation for `manny.barela2026+hvcg-pilot@gmail.com`, click the link.
2. **Sign in** — https://growth-command-center-lbnt.vercel.app/login  
   Email: `manny.barela2026+hvcg-pilot@gmail.com`  
   Password: (set at signup — store in your password manager)
3. **Complete onboarding** — Company profile, priorities, KPI targets.
4. **Fill pilot data** — Complete `docs/hvcg-pilot-data-template.csv` and monthly template with authorized HVCG figures (see OWNER-INPUT-REQUIRED doc). Save as `hvcg-pilot-data-filled.csv` locally.
5. **Import** — Integrations → Import data → upload snapshot + monthly trends → Preview → Commit.
6. **Re-run certification** (optional, agent can run after you confirm):

```bash
PILOT_EMAIL="manny.barela2026+hvcg-pilot@gmail.com" \
PILOT_PASSWORD="..." \
PILOT_SNAPSHOT_CSV="path/to/hvcg-pilot-data-filled.csv" \
npm run pilot:hvcg
```

---

## 3. Real-user certification script

`scripts/hvcg-real-user-pilot.mjs` uses **signInWithPassword** only — not service role.

Verifies:
- HVCG tenant (not demo org)
- Import → recompute → dashboard
- Forecast, KPIs, value creation, AI CFO
- Session persistence (logout/login)
- Cross-tenant isolation (403 on org-apex)

---

## 4. Pilot friction log (this run)

| Level | Item |
|-------|------|
| **BLOCKER** | Email confirmation required — cannot automate Gmail inbox access |
| **BLOCKER** | Authorized HVCG financial snapshot not in execution environment |
| **HIGH FRICTION** | `manny.barela2026@gmail.com` may already exist with different password — use `+hvcg-pilot` alias for clean tenant |
| **HIGH FRICTION** | Disposable email (Mailinator) does not receive Supabase confirmation emails |
| **HIGH FRICTION** | No "Forgot password?" link on login (fixed in this PR) |
| **LOW FRICTION** | Post-signup message could mention spam folder |
| **COSMETIC** | — |

---

## 5. Success criteria

```
GCC_HVCG_INTERNAL_PILOT = LIVE
GCC_AUTHENTICATED_PRODUCTION_JOURNEY = PASS
GCC_COMMERCIAL_GOLIVE_CERTIFICATION = PASS
PILOT_BLOCKERS = 0
```

---

## 6. After HVCG passes

Proceed to **first external pilot** — see `docs/external-pilot-package.md`.

Do not build accounting connectors or change $149 pricing without customer signal.
