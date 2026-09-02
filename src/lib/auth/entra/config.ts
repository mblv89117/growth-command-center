/**
 * Microsoft Entra External ID (CIAM) configuration scaffold — Stage 3.
 * Set AUTH_PROVIDER=entra when tenant is configured.
 */
export type AuthProvider = "supabase" | "entra";

export function getAuthProvider(): AuthProvider {
  const raw = process.env.AUTH_PROVIDER?.toLowerCase();
  return raw === "entra" ? "entra" : "supabase";
}

export function isEntraAuthEnabled(): boolean {
  return getAuthProvider() === "entra";
}

export interface EntraExternalIdConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  authority: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}

export function getEntraConfig(): EntraExternalIdConfig | null {
  const tenantId = process.env.ENTRA_EXTERNAL_TENANT_ID;
  const clientId = process.env.ENTRA_EXTERNAL_CLIENT_ID;
  const clientSecret = process.env.ENTRA_EXTERNAL_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) return null;

  const authority =
    process.env.ENTRA_EXTERNAL_AUTHORITY ??
    `https://${tenantId}.ciamlogin.com/${tenantId}`;

  return {
    tenantId,
    clientId,
    clientSecret,
    authority,
    redirectUri:
      process.env.ENTRA_EXTERNAL_REDIRECT_URI ??
      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.growthcommandcenter.com"}/auth/callback`,
    postLogoutRedirectUri:
      process.env.ENTRA_EXTERNAL_LOGOUT_URI ??
      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.growthcommandcenter.com"}/login`,
  };
}

export function isEntraConfigured(): boolean {
  return getEntraConfig() !== null;
}
