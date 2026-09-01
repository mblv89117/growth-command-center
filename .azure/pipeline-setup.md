# Azure GitHub OIDC Setup — GCC Production Deploy

One-time setup so `.github/workflows/azure-production.yml` can authenticate without `az login`.

## Error observed (2026-09-01)

```
AADSTS700213: No matching federated identity record found for presented assertion subject
'repo:mblv89117/growth-command-center:ref:refs/heads/main'
```

GitHub secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` are present. The Entra app registration is missing a matching **federated identity credential**.

## Presented OIDC token (from workflow logs)

| Claim | Value |
|-------|-------|
| Issuer | `https://token.actions.githubusercontent.com` |
| Subject | `repo:mblv89117/growth-command-center:ref:refs/heads/main` |
| Audience | `api://AzureADTokenExchange` |
| Workflow | `mblv89117/growth-command-center/.github/workflows/azure-production.yml@refs/heads/main` |

## Option A — Azure Portal (recommended)

1. Open [Microsoft Entra ID → App registrations](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps)
2. Select the app matching `AZURE_CLIENT_ID` (GitHub Actions OIDC app)
3. **Certificates & secrets** → **Federated credentials** → **Add credential**
4. Scenario: **GitHub Actions deploying Azure resources**
5. Organization: `mblv89117`
6. Repository: `growth-command-center`
7. Entity type: **Branch**
8. Branch: `main`
9. Name: `github-main-gcc-deploy`
10. Save

## Option B — Azure CLI (owner with Entra admin rights)

```bash
az login
APP_ID="<AZURE_CLIENT_ID>"   # from GitHub secret — do not paste in chat

az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters '{
    "name": "github-main-gcc-deploy",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:mblv89117/growth-command-center:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

## RBAC for the service principal

Grant on subscription or `rg-gcc-prod`:

| Role | Scope | Purpose |
|------|-------|---------|
| Contributor | `rg-gcc-prod` | Deploy Bicep, Container App, ACR |
| AcrPush | ACR (after first deploy) | Push Docker images |

```bash
SUBSCRIPTION_ID="<AZURE_SUBSCRIPTION_ID>"
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/rg-gcc-prod"
```

## Re-run deployment

After federated credential + RBAC are configured:

```bash
gh workflow run "Azure Production Deploy" --ref main
```

Or push any commit to `main`.

## GitHub secrets required

Already expected in repository secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` (optional but recommended)
- Stripe / QuickBooks / Plaid secrets as configured in Vercel production
