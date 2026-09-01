#!/usr/bin/env bash
# Provision GCC Azure Container Apps infrastructure (idempotent).
set -euo pipefail

SUBSCRIPTION="${AZURE_SUBSCRIPTION_ID:-}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-gcc-prod}"
LOCATION="${AZURE_LOCATION:-eastus}"
DEPLOYMENT_NAME="${AZURE_DEPLOYMENT_NAME:-gcc-infra-$(date +%Y%m%d%H%M%S)}"
PARAMS_FILE="${1:-infra/azure/main.parameters.json}"

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI (az) is required." >&2
  exit 1
fi

if [ -n "$SUBSCRIPTION" ]; then
  az account set --subscription "$SUBSCRIPTION"
fi

echo "Using subscription: $(az account show --query name -o tsv)"

if ! az group show --name "$RESOURCE_GROUP" >/dev/null 2>&1; then
  echo "Creating resource group $RESOURCE_GROUP in $LOCATION..."
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --tags product=gcc environment=production
else
  echo "Resource group $RESOURCE_GROUP already exists."
fi

echo "Deploying Bicep template..."
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DEPLOYMENT_NAME" \
  --template-file infra/azure/main.bicep \
  --parameters "@${PARAMS_FILE}" \
  --parameters location="$LOCATION" \
  --output json > /tmp/gcc-azure-deploy.json

echo "Deployment outputs:"
jq -r '.properties.outputs | to_entries[] | "\(.key)=\(.value.value)"' /tmp/gcc-azure-deploy.json

echo "Infrastructure deployment complete."
