/**
 * Microsoft Entra External ID (CIAM) configuration.
 * Keep AUTH_PROVIDER=supabase until Entra UAT passes, then switch to entra.
 */
export type AuthProvider = "supabase" | "entra";

export function getAuthProvider(): AuthProvider {
  const raw = process.env.AUTH_PROVIDER?.toLowerCase();
  return raw === "entra" ? "entra" : "supabase";
}

export function isEntraAuthEnabled(): boolean {
  return getAuthProvider() === "entra";
}

export interface EntraConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  authority: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}

export function getEntraConfig(): EntraConfig | null {
  const tenantId =
    process.env.ENTRA_EXTERNAL_TENANT_ID ?? process.env.ENTRA_EXTERNAL_ID_TENANT_ID;
  const clientId =
    process.env.ENTRA_EXTERNAL_CLIENT_ID ?? process.env.ENTRA_EXTERNAL_ID_CLIENT_ID;
  const clientSecret =
    process.env.ENTRA_EXTERNAL_CLIENT_SECRET ?? process.env.ENTRA_EXTERNAL_ID_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) return null;

  const authority =
    process.env.ENTRA_EXTERNAL_AUTHORITY ??
    process.env.ENTRA_EXTERNAL_ID_AUTHORITY ??
    `https://${tenantId}.ciamlogin.com/${tenantId}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.growthcommandcenter.com";

  return {
    tenantId,
    clientId,
    clientSecret,
    authority,
    redirectUri:
      process.env.ENTRA_EXTERNAL_REDIRECT_URI ??
      process.env.ENTRA_EXTERNAL_ID_REDIRECT_URI ??
      `${appUrl}/auth/callback`,
    postLogoutRedirectUri:
      process.env.ENTRA_EXTERNAL_LOGOUT_URI ??
      process.env.ENTRA_EXTERNAL_ID_LOGOUT_URI ??
      `${appUrl}/login`,
  };
}

export function isEntraConfigured(): boolean {
  return getEntraConfig() !== null;
}
