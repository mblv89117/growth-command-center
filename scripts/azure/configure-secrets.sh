#!/usr/bin/env bash
# Apply production secrets/env vars to Azure Container App from a local env file.
# Usage: ENV_FILE=.env.production ./scripts/azure/configure-secrets.sh
#
# Never commit .env.production. Copy from Vercel export or maintain in Azure Key Vault.
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-gcc-prod}"
APP_NAME="${CONTAINER_APP_NAME:-}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing ${ENV_FILE}. Create from docs/azure-hosting-migration.md inventory." >&2
  exit 1
fi

if [ -z "$APP_NAME" ]; then
  APP_NAME=$(az deployment group list --resource-group "$RESOURCE_GROUP" --query "[0].properties.outputs.containerAppName.value" -o tsv)
fi

declare -a SECRET_NAMES=()
declare -a ENV_VARS=()

while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%#*}"
  line="$(echo "$line" | xargs)"
  [ -z "$line" ] && continue
  key="${line%%=*}"
  value="${line#*=}"
  [ -z "$key" ] || [ -z "$value" ] && continue

  case "$key" in
    NEXT_PUBLIC_*)
      ENV_VARS+=("${key}=${value}")
      ;;
    *)
      SECRET_NAMES+=("$key")
      az containerapp secret set \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --secrets "${key}=${value}" \
        --output none
      ENV_VARS+=("${key}=secretref:${key}")
      ;;
  esac
done < "$ENV_FILE"

if [ "${#ENV_VARS[@]}" -gt 0 ]; then
  az containerapp update \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --set-env-vars "${ENV_VARS[@]}"
fi

echo "Secrets and environment variables applied to ${APP_NAME}."
