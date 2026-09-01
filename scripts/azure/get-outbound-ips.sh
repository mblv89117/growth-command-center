#!/usr/bin/env bash
# Report Container Apps environment outbound/static IP guidance for Intuit disclosure.
set -euo pipefail

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-gcc-prod}"
ENV_NAME="${CONTAINER_APPS_ENV:-}"

if [ -z "$ENV_NAME" ]; then
  ENV_NAME=$(az deployment group list --resource-group "$RESOURCE_GROUP" --query "[0].properties.outputs.managedEnvironmentName.value" -o tsv)
fi

APP_NAME="${CONTAINER_APP_NAME:-$(az deployment group list --resource-group "$RESOURCE_GROUP" --query "[0].properties.outputs.containerAppName.value" -o tsv)}"

echo "=== Container Apps Environment ==="
az containerapp env show --name "$ENV_NAME" --resource-group "$RESOURCE_GROUP" \
  --query "{staticIp:properties.staticIp,location:location,id:id}" -o json

echo "=== Container App ingress (inbound) ==="
az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --query "{fqdn:properties.configuration.ingress.fqdn,customDomains:properties.configuration.ingress.customDomains}" -o json

echo ""
echo "Intuit 'where is your app hosted': Microsoft Azure Container Apps — $(az containerapp env show --name "$ENV_NAME" --resource-group "$RESOURCE_GROUP" --query location -o tsv)"
echo "Static outbound IP requires optional VNet + NAT Gateway — see docs/azure-hosting-migration.md"
