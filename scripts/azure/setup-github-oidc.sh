#!/usr/bin/env bash
# One-time GitHub Actions OIDC federated credential setup for GCC Azure deploy.
# Requires: az login with Entra ID app admin or Global Admin rights.
set -euo pipefail

APP_ID="${AZURE_CLIENT_ID:-}"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-gcc-prod}"
FED_NAME="${FED_NAME:-github-main-gcc-deploy}"
REPO="${GITHUB_REPO:-mblv89117/growth-command-center}"
BRANCH="${GITHUB_BRANCH:-main}"

if [ -z "$APP_ID" ] || [ -z "$SUBSCRIPTION_ID" ]; then
  echo "Set AZURE_CLIENT_ID and AZURE_SUBSCRIPTION_ID (same values as GitHub secrets)." >&2
  exit 1
fi

SUBJECT="repo:${REPO}:ref:refs/heads/${BRANCH}"

echo "Creating federated credential:"
echo "  app: $APP_ID"
echo "  subject: $SUBJECT"

az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"${FED_NAME}\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"${SUBJECT}\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" 2>/dev/null || echo "Federated credential may already exist — verify in Entra portal."

SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

echo "Granting Contributor on ${RESOURCE_GROUP}..."
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}" \
  2>/dev/null || echo "Role assignment may already exist."

echo "Done. Re-run: gh workflow run 'Azure Production Deploy' --ref main"
