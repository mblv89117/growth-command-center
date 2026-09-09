#!/usr/bin/env bash
# Stage 3 preflight — no secrets printed. Fails closed when the target region
# has an empty Flexible Server version list (the ARM "Version should be in: []" case).
set -euo pipefail

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-gcc-prod}"
POSTGRES_LOCATION="${AZURE_POSTGRES_LOCATION:-eastus2}"
POSTGRES_VERSION="${AZURE_POSTGRES_VERSION:-16}"
POSTGRES_SKU="${AZURE_POSTGRES_SKU:-Standard_B1ms}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --resource-group) RESOURCE_GROUP="$2"; shift 2 ;;
    --postgres-location) POSTGRES_LOCATION="$2"; shift 2 ;;
    --version) POSTGRES_VERSION="$2"; shift 2 ;;
    --sku) POSTGRES_SKU="$2"; shift 2 ;;
    *) echo "UNKNOWN_ARG=$1" >&2; exit 2 ;;
  esac
done

out() {
  echo "$1"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "$1" >> "$GITHUB_OUTPUT"
  fi
}

echo "TARGET_LOCATION=${POSTGRES_LOCATION}"
echo "TARGET_VERSION=${POSTGRES_VERSION}"
echo "TARGET_SKU=${POSTGRES_SKU}"
echo "TARGET_RESOURCE_GROUP=${RESOURCE_GROUP}"
echo "SUBSCRIPTION=$(az account show --query id -o tsv)"

az bicep build --file "$ROOT/infra/azure/postgres.bicep" --outfile /tmp/gcc-postgres.json >/dev/null
echo "BICEP_COMPILE=PASS"

NAME_JSON=$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --name gcc-pg-name-resolve \
  --template-file "$ROOT/infra/azure/postgres-name.bicep" \
  --query properties.outputs.postgresServerName.value -o tsv)
TARGET_SERVER_NAME="$NAME_JSON"
echo "TARGET_SERVER_NAME=${TARGET_SERVER_NAME}"
out "server=${TARGET_SERVER_NAME}"

EXISTING_SERVER=NO
EXISTING_SERVER_VERSION=""
EXISTING_SERVER_STATE=""
EXISTING_SERVER_SKU=""
EXISTING_SERVER_LOCATION=""
if az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$TARGET_SERVER_NAME" >/tmp/gcc-pg-existing.json 2>/dev/null; then
  EXISTING_SERVER=YES
  EXISTING_SERVER_VERSION=$(jq -r '.version // empty' /tmp/gcc-pg-existing.json)
  EXISTING_SERVER_STATE=$(jq -r '.state // empty' /tmp/gcc-pg-existing.json)
  EXISTING_SERVER_SKU=$(jq -r '.sku.name // empty' /tmp/gcc-pg-existing.json)
  EXISTING_SERVER_LOCATION=$(jq -r '.location // empty' /tmp/gcc-pg-existing.json)
fi
echo "EXISTING_SERVER=${EXISTING_SERVER}"
echo "EXISTING_SERVER_VERSION=${EXISTING_SERVER_VERSION:-none}"
echo "EXISTING_SERVER_STATE=${EXISTING_SERVER_STATE:-none}"
echo "EXISTING_SERVER_SKU=${EXISTING_SERVER_SKU:-none}"
echo "EXISTING_SERVER_LOCATION=${EXISTING_SERVER_LOCATION:-none}"
out "existing=${EXISTING_SERVER}"
out "existing_state=${EXISTING_SERVER_STATE:-none}"

CAPS_RAW=$(az postgres flexible-server list-skus --location "$POSTGRES_LOCATION" -o json)
CAPS_JSON=$(python3 -c 'import json,sys; raw=sys.stdin.read(); print(raw[raw.find("["):])' <<<"$CAPS_RAW")
python3 - "$POSTGRES_LOCATION" "$POSTGRES_VERSION" "$POSTGRES_SKU" "$CAPS_JSON" <<'PY'
import json, sys
loc, version, sku, raw = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
top = json.loads(raw)[0]
reason = top.get("reason") or ""
editions = top.get("supportedServerEditions") or []
versions = [str(v.get("name")) for v in (top.get("supportedServerVersions") or [])]
skus = []
for ed in editions:
    for s in ed.get("supportedServerSkus") or []:
        skus.append(s.get("name"))
print(f"AVAILABLE_SKU_VERSION_EVIDENCE location={loc}")
print(f"CAPABILITY_REASON={reason or 'none'}")
print(f"SUPPORTED_VERSIONS={','.join(versions) if versions else '[]'}")
print(f"SUPPORTED_EDITIONS={len(editions)}")
print(f"B1MS_PRESENT={'yes' if sku in skus else 'no'}")
if not versions:
    print("ROOT_CAUSE=REGION_POSTGRES_PROVISIONING_RESTRICTED")
    print(f"ACTIONABLE=Azure Flexible Server supportedServerVersions is empty in {loc}.")
    print("ACTIONABLE=Do not retry the same region. Use an unrestricted region (evidenced: eastus2) or open a quota exception.")
    sys.exit(3)
if version not in versions:
    print(f"ROOT_CAUSE=VERSION_NOT_IN_REGION_CAPABILITIES requested={version} allowed={','.join(versions)}")
    sys.exit(3)
if sku not in skus:
    print(f"ROOT_CAUSE=SKU_NOT_IN_REGION_CAPABILITIES requested={sku} sample={','.join(skus[:8])}")
    sys.exit(3)
print("CAPABILITIES_MATCH=PASS")
PY

if [[ "$EXISTING_SERVER" == "YES" ]]; then
  if [[ "$EXISTING_SERVER_STATE" == "Ready" && "$EXISTING_SERVER_VERSION" == "$POSTGRES_VERSION" ]]; then
    if [[ -n "$EXISTING_SERVER_SKU" && "$EXISTING_SERVER_SKU" != "$POSTGRES_SKU" ]]; then
      echo "CONFLICT=EXISTING_SERVER_SKU_MISMATCH have=${EXISTING_SERVER_SKU} want=${POSTGRES_SKU}"
      echo "AZURE_POSTGRES_INFRA=CONFLICT"
      out "infra=CONFLICT"
      exit 4
    fi
    echo "AZURE_POSTGRES_INFRA=EXISTING_VALID"
    out "infra=EXISTING_VALID"
    out "skip_create=true"
    echo "ARM_VALIDATION_RESULT=SKIPPED_EXISTING_VALID"
    exit 0
  fi
  if [[ "$EXISTING_SERVER_STATE" == "Ready" && "$EXISTING_SERVER_VERSION" != "$POSTGRES_VERSION" ]]; then
    echo "CONFLICT=LIVE_MAJOR_VERSION_MISMATCH have=${EXISTING_SERVER_VERSION} want=${POSTGRES_VERSION}"
    echo "AZURE_POSTGRES_INFRA=CONFLICT"
    out "infra=CONFLICT"
    exit 4
  fi
  echo "EXISTING_SERVER_NOT_READY state=${EXISTING_SERVER_STATE}"
fi

echo "ARM_VALIDATE_START"
set +e
az deployment group validate \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$ROOT/infra/azure/postgres.bicep" \
  --parameters postgresAdminPassword='PreflightValidateOnly1!' \
  --parameters location=eastus \
  --parameters postgresLocation="$POSTGRES_LOCATION" \
  --parameters postgresVersion="$POSTGRES_VERSION" \
  --parameters postgresSkuName="$POSTGRES_SKU" \
  --query error -o json > /tmp/gcc-pg-validate.json
VALIDATE_EXIT=$?
set -e
if python3 - <<'PY'
from pathlib import Path
p = Path("/tmp/gcc-pg-validate.json")
text = p.read_text().strip() if p.exists() else ""
if not text or text in ("null", "{}", "[]"):
    raise SystemExit(0)
print(text[:1500])
raise SystemExit(1)
PY
then
  if [[ "$VALIDATE_EXIT" -eq 0 ]]; then
    echo "ARM_VALIDATION_RESULT=PASS"
  else
    echo "ARM_VALIDATION_RESULT=FAIL (az exit ${VALIDATE_EXIT})"
    exit 5
  fi
else
  echo "ARM_VALIDATION_RESULT=FAIL"
  exit 5
fi

out "infra=CREATE_REQUIRED"
out "skip_create=false"
echo "AZURE_POSTGRES_INFRA=CREATE_REQUIRED"
