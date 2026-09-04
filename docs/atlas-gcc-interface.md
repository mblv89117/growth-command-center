# Atlas → GCC Interface Contract

Growth Command Center (GCC) is a separate commercial product from Atlas Hub/Elite.
This document defines the **GCC-side interface contract only**. Atlas implementation is out of scope.

## Activation Handoff (`atlas-gcc-client-activation.v1`)

- **Idempotency key format:** `gcc-activate|{ClientCode}|{eventId}`
- **Auto-provision:** `false` — GCC never auto-creates tenants from Atlas without explicit owner authorization
- **Observation-only payloads:** Atlas may send SYN01 Active Client observation data; GCC records intent only
- **Lead-stage rejection:** Lead-stage clients must not trigger GCC provisioning

## Value Signals (`gcc-value-signal.v1`)

GCC accepts structured value-creation signals when provided:

```json
{
  "schema": "gcc-value-signal.v1",
  "clientCode": "SYN01",
  "organizationId": "org-syn01",
  "signalType": "margin_opportunity",
  "confidence": "VERIFIED",
  "finding": "string",
  "evidence": "string",
  "financialImpact": 0,
  "recommendedAction": "string"
}
```

- `confidence` must be one of: `VERIFIED`, `ESTIMATED`, `INFERRED`
- `INFERRED` signals must not claim `financialImpact > 0`
- GCC stores signals in tenant-scoped tables; never exposes cross-tenant data

## GCC Responsibilities

1. Validate HMAC/signature when live dispatch is enabled (owner-gated)
2. Map `ClientCode` → `organizationId` via secure lookup
3. Reject cross-tenant signal injection
4. Surface signals in `/value-creation` with evidence labels

## Out of Scope (Atlas Side)

- Atlas Hub/Elite deployment
- Atlas schema changes
- Atlas CRM duplication
- Live provisioning without owner approval

## ClientCode mapping (Wave 2)

- Canonical key: Atlas `ClientCode`
- Lookup: `src/lib/atlas/clientCodeMap.ts`
- Unknown ClientCode: **FAIL CLOSED** (no default tenant)
- Dual-resolve required when both `clientCode` and `organizationId` are present
- Auto-provision remains `false`
- Additive mapping rows only — local `gcc_organizations.id` values are retained
