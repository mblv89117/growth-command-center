# Public host recovery notes — GCC-PUBLIC-HOST-RECOVERY-001
#
# Diagnosis (2026-09-03):
# - Default ACA FQDN https://azapprngzn.nicecoast-be020962.eastus.azurecontainerapps.io = HTTP 200
# - Custom domains growthcommandcenter.com / www / app fail TLS (SNI EOF) and Host-header 404
# - DNS A/CNAME still point at the existing ACA environment (do not change DNS)
# - Root class: custom domain bindings / managed certificates missing on azapprngzn
#   (same failure mode as Bicep ingress replace clearing customDomains; fixed by bind job)
#
# Recovery (no new app, no DNS cut):
# 1. Actions → Azure Restore Public Hosts → type RESTORE
#    OR push to main (Azure Production Deploy now skips Bicep by default) which rebinds domains
# 2. Actions → Azure Bind Custom Domains if only bind is needed
# 3. Confirm:
#    https://growthcommandcenter.com
#    https://www.growthcommandcenter.com
#    https://app.growthcommandcenter.com/login
#
# Recurrence prevention:
# - azure-production.yml redeploy_infra defaults to false
# - bind-custom-domains.sh starts the app if stopped
# - azure-health-ping.yml checks ACA FQDN + all three public hosts every 30m
