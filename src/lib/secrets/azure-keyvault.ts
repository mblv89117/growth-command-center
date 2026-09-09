/**
 * Lightweight secret resolution for Azure Container Apps.
 * Reads process.env first; ACA can inject Key Vault references as env vars
 * (e.g. @Microsoft.KeyVault(SecretUri=https://vault.vault.azure.net/secrets/name/)).
 *
 * No @azure/keyvault SDK required at runtime when secrets are mounted as env.
 */

export function readSecret(name: string, fallback?: string): string | undefined {
  const value = process.env[name]?.trim();
  if (value) return value;
  return fallback;
}

export function requireSecret(name: string): string {
  const value = readSecret(name);
  if (!value) {
    throw new Error(`Missing required secret: ${name}`);
  }
  return value;
}

/** Documented ACA pattern — configure in Container App secret + env reference. */
export const KEY_VAULT_ENV_REFERENCE_DOCS =
  "https://learn.microsoft.com/azure/container-apps/manage-secrets#reference-secret-from-key-vault";
