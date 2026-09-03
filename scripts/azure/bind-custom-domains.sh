#!/usr/bin/env bash
# Bind GCC custom domains to Azure Container App and print EXACT DNS records.
# Do not invent DNS values — only print Azure-returned verification data.
#
# Defaults match production (run 33605754558):
#   RG=rg-gcc-prod APP=azapprngzn ENV=azcaerngzn
set -euo pipefail

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-gcc-prod}"
APP_NAME="${CONTAINER_APP_NAME:-azapprngzn}"
ENV_NAME="${CONTAINER_APPS_ENV:-azcaerngzn}"
VALIDATION_METHOD="${VALIDATION_METHOD:-CNAME}"

DOMAINS=(
  "growthcommandcenter.com"
  "www.growthcommandcenter.com"
  "app.growthcommandcenter.com"
)

echo "=== GCC Azure custom domain bind ==="
echo "RESOURCE_GROUP=${RESOURCE_GROUP}"
echo "CONTAINER_APP=${APP_NAME}"
echo "MANAGED_ENVIRONMENT=${ENV_NAME}"

# Public-host recovery: never leave the app stopped while rebinding hostnames.
RUNNING=$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.runningStatus" -o tsv 2>/dev/null || echo "Unknown")
echo "RUNNING_STATUS=${RUNNING}"
if [ "$RUNNING" != "Running" ]; then
  echo "Starting Container App ${APP_NAME} before domain bind..."
  az containerapp start --name "$APP_NAME" --resource-group "$RESOURCE_GROUP"
  sleep 10
fi

FQDN=$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)
STATIC_IP=$(az containerapp env show \
  --name "$ENV_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.staticIp" -o tsv)
VERIFICATION_ID=$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.customDomainVerificationId" -o tsv)

echo "DEFAULT_FQDN=${FQDN}"
echo "ENVIRONMENT_STATIC_IP=${STATIC_IP}"
echo "CUSTOM_DOMAIN_VERIFICATION_ID=${VERIFICATION_ID}"
echo ""

for domain in "${DOMAINS[@]}"; do
  echo "--- Adding hostname: ${domain} ---"
  az containerapp hostname add \
    --hostname "$domain" \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --output none 2>/dev/null || echo "(hostname may already exist)"

  echo "--- Binding managed certificate: ${domain} (validation=${VALIDATION_METHOD}) ---"
  # Bind may fail until DNS is in place — that is expected. We still print required records.
  if ! az containerapp hostname bind \
    --hostname "$domain" \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ENV_NAME" \
    --validation-method "$VALIDATION_METHOD" \
    --output none 2>/tmp/gcc-domain-bind-err; then
    echo "BIND_STATUS=PENDING_DNS (expected until GoDaddy records are applied)"
    if [ -s /tmp/gcc-domain-bind-err ]; then
      # Never fail the script solely because DNS is not yet cut over.
      sed 's/^/  azure: /' /tmp/gcc-domain-bind-err || true
    fi
  else
    echo "BIND_STATUS=ACCEPTED"
  fi
done

echo ""
echo "=== CURRENT customDomains (Azure) ==="
az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.customDomains" -o json

echo ""
echo "======================================================================"
echo "OWNER DNS RECORDS — apply EXACTLY these in GoDaddy (do not invent values)"
echo "======================================================================"
echo ""
echo "--- Domain ownership / certificate validation (required for all hosts) ---"
echo "HOST = @"
echo "TYPE = TXT"
echo "VALUE = ${VERIFICATION_ID}"
echo "TTL = 600"
echo "PURPOSE = Azure Container Apps custom domain verification (asuid for apex)"
echo ""
echo "HOST = asuid"
echo "TYPE = TXT"
echo "VALUE = ${VERIFICATION_ID}"
echo "TTL = 600"
echo "PURPOSE = Azure asuid verification for apex growthcommandcenter.com"
echo ""
echo "HOST = asuid.www"
echo "TYPE = TXT"
echo "VALUE = ${VERIFICATION_ID}"
echo "TTL = 600"
echo "PURPOSE = Azure asuid verification for www.growthcommandcenter.com"
echo ""
echo "HOST = asuid.app"
echo "TYPE = TXT"
echo "VALUE = ${VERIFICATION_ID}"
echo "TTL = 600"
echo "PURPOSE = Azure asuid verification for app.growthcommandcenter.com"
echo ""
echo "--- Traffic records (after TXT verifies; keep Vercel as rollback until cutover) ---"
if [ -n "${STATIC_IP}" ] && [ "${STATIC_IP}" != "null" ]; then
  echo "HOST = @"
  echo "TYPE = A"
  echo "VALUE = ${STATIC_IP}"
  echo "TTL = 600"
  echo "PURPOSE = Apex → Azure Container Apps environment static IP (GoDaddy has no ALIAS/ANAME)"
  echo ""
else
  echo "HOST = @ (apex)"
  echo "TYPE = A"
  echo "VALUE = OWNER_MUST_RUN_THIS_SCRIPT_OR_WORKFLOW — staticIp not returned"
  echo "TTL = 600"
  echo "PURPOSE = Apex A record (required; do not invent IP)"
  echo ""
fi
echo "HOST = www"
echo "TYPE = CNAME"
echo "VALUE = ${FQDN}"
echo "TTL = 600"
echo "PURPOSE = www → Azure Container App default FQDN"
echo ""
echo "HOST = app"
echo "TYPE = CNAME"
echo "VALUE = ${FQDN}"
echo "TTL = 600"
echo "PURPOSE = app → Azure Container App default FQDN"
echo ""
echo "--- Records to REMOVE or REPLACE at DNS cutover (currently Vercel) ---"
echo "HOST = @ / TYPE = A / VALUE = 216.150.1.1 (Vercel) → REPLACE with Azure static IP above"
echo "HOST = www / TYPE = CNAME / VALUE = growthcommandcenter.com or Vercel → REPLACE with ${FQDN}"
echo "HOST = app / TYPE = CNAME / VALUE = c180f1d2697e4ac8.vercel-dns-017.com → REPLACE with ${FQDN}"
echo ""
echo "AZURE_DOMAIN_BINDINGS_INITIATED = PASS"
echo "AZURE_DOMAIN_BINDINGS_READY = PENDING_OWNER_DNS"
echo "DNS_CUTOVER = BLOCKED_UNTIL_BINDINGS_PROVISIONED"
echo "VERCEL_ROLLBACK = AVAILABLE (do not decommission)"
echo "======================================================================"
