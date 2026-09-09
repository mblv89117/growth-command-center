# Microsoft-Native GCC Migration Plan

**Mission:** `GCC-AZURE-CUTOVER-SUPABASE-HARDENING-001`  
**Status:** Azure PostgreSQL production data plane is live (2026-09-09). Auth remains Supabase until Entra External ID Owner gates + UAT PASS. Microsoft-native cutover is **not** complete. See `docs/missions/CURRENT_PROGRAM_STATE.md`.

## Current vs interim vs target

| Layer | Current (production) | Phase 1 (this mission) | Target (Microsoft-native) |
|-------|----------------------|-------------------------|---------------------------|
| Compute | Azure Container Apps | Azure Container Apps | Azure Container Apps |
| Database | Azure PostgreSQL Flexible Server (`azpg3uejm`) | Azure PostgreSQL (live) | Azure Database for PostgreSQL Flexible Server |
| Auth | Supabase Auth | Supabase Auth | Microsoft Entra External ID (CIAM) |
| File storage | Not used (imports in-memory/DB) | Not used | Azure Blob Storage (when needed) |
| Secrets | Azure Container App secrets + Key Vault | Azure Container App secrets | Azure Key Vault + managed identity |
| Observability | Log Analytics + Azure Monitor | Log Analytics + Azure Monitor | Application Insights |

---

The remainder of this document is the original planning record. Phase 4 (database cutover) is **complete**. Phase 5 (Entra) is the open Owner gate. Do not decommission Supabase Auth until Entra UAT PASS and the rollback window elapses.
