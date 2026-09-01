#!/usr/bin/env bash
# Bind GCC custom domains to Azure Container App with managed certificates.
# Run AFTER production certification on the default *.azurecontainerapps.io FQDN.
set -euo pipefail

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-gcc-prod}"
APP_NAME="${CONTAINER_APP_NAME:-}"
ENV_NAME="${CONTAINER_APPS_ENV:-}"

if [ -z "$APP_NAME" ]; then
  APP_NAME=$(az deployment group list --resource-group "$RESOURCE_GROUP" --query "[0].properties.outputs.containerAppName.value" -o tsv)
fi
if [ -z "$ENV_NAME" ]; then
  ENV_NAME=$(az deployment group list --resource-group "$RESOURCE_GROUP" --query "[0].properties.outputs.managedEnvironmentName.value" -o tsv)
fi

DOMAINS=(
  "growthcommandcenter.com"
  "www.growthcommandcenter.com"
  "app.growthcommandcenter.com"
)

echo "Binding custom domains to ${APP_NAME}..."
for domain in "${DOMAINS[@]}"; do
  echo "Adding hostname: ${domain}"
  az containerapp hostname add \
    --hostname "$domain" \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --output none || true

  echo "Binding managed certificate for ${domain}..."
  az containerapp hostname bind \
    --hostname "$domain" \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ENV_NAME" \
    --validation-method CNAME \
    --output none || true
done

echo "Custom domain bind initiated. Complete DNS validation records in GoDaddy before cutover."
az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query "properties.configuration.ingress.customDomains" -o json
