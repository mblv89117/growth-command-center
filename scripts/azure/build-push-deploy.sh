#!/usr/bin/env bash
# Build GCC Docker image, push to ACR, and update the Container App revision.
set -euo pipefail

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-gcc-prod}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
IMAGE_NAME="${IMAGE_NAME:-gcc-web}"

if ! command -v az >/dev/null 2>&1 || ! command -v docker >/dev/null 2>&1; then
  echo "Azure CLI and Docker are required." >&2
  exit 1
fi

ACR_NAME="${ACR_NAME:-$(az deployment group list --resource-group "$RESOURCE_GROUP" --query "[0].properties.outputs.acrName.value" -o tsv 2>/dev/null || true)}"
APP_NAME="${CONTAINER_APP_NAME:-$(az deployment group list --resource-group "$RESOURCE_GROUP" --query "[0].properties.outputs.containerAppName.value" -o tsv 2>/dev/null || true)}"

if [ -z "$ACR_NAME" ] || [ -z "$APP_NAME" ]; then
  echo "Set ACR_NAME and CONTAINER_APP_NAME, or run scripts/azure/deploy-infra.sh first." >&2
  exit 1
fi

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer -o tsv)
FULL_IMAGE="${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "Building image ${FULL_IMAGE}..."
docker build -t "$FULL_IMAGE" .

echo "Logging into ACR..."
az acr login --name "$ACR_NAME"

echo "Pushing image..."
docker push "$FULL_IMAGE"

echo "Updating container app ${APP_NAME}..."
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$FULL_IMAGE"

FQDN=$(az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)
echo "Deployed. Container App URL: https://${FQDN}"
echo "Run production certification before DNS cutover."
