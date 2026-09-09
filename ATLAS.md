# ATLAS.md

```
CONSTITUTION = HVCG-CONSTITUTION-2026-09-04-v1.0
CANONICAL_GOVERNANCE = mblv89117/hvcg-platform-governance
PLATFORM = Atlas
PLATFORM_MODEL = ONE_PLATFORM_MULTI_REPO
REPOSITORY_ROLE = ATLAS_FINANCIAL_INTELLIGENCE_MODULE
CONSTITUTION_PRECEDENCE = TRUE
```

## Authority

This repository is an **Atlas module runtime**, not a second HVCG master platform.
Canonical governance and Constitution live in `mblv89117/hvcg-platform-governance`.
Do not copy the full Constitution into this repository.

Instruction precedence: Constitution → legal/security → approved governance → Owner Directives → Master Execution Directive → repo instructions → task instructions.

## Client identity

Default durable business key: **Atlas ClientCode**.
Unknown ClientCode: **FAIL CLOSED**. No default client routing.
Map local org/tenant IDs; do not delete local identity tables first.

## Preserve

Keep validated domain engines and production behavior. Prefer adapters over rebuilds.
