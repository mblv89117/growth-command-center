/** Demo tenant id. Must stay aligned with DEMO_ORGANIZATION_ID in config.ts. */
export const DEMO_TENANT_ID = "org-apex";

/** Public self-serve signup must never attach a user to the demo/client tenant. */
export const PUBLIC_SIGNUP_ENABLED = false;

export function resolveAuthenticatedOrganizationId(input: {
  profileOrganizationId?: string | null;
  metadataOrganizationId?: string | null;
}): string | null {
  const profile = String(input.profileOrganizationId || "").trim();
  if (profile) return profile;
  const metadata = String(input.metadataOrganizationId || "").trim();
  if (metadata) return metadata;
  return null;
}

export function selectOrganizationId(input: {
  authOrganizationId: string;
  requestedOrganizationId?: string | null;
  role: string;
}): { organizationId: string; denied: boolean; reason?: string } {
  const authOrg = String(input.authOrganizationId || "").trim();
  const requested = String(input.requestedOrganizationId || "").trim();
  if (!authOrg) {
    return { organizationId: "", denied: true, reason: "organization_mapping_required" };
  }
  if (!requested || requested === authOrg) {
    return { organizationId: authOrg, denied: false };
  }
  if (input.role === "platform_admin") {
    return { organizationId: requested, denied: false };
  }
  return { organizationId: authOrg, denied: true, reason: "organization_mismatch" };
}

export function publicSignupOrganizationId(): null {
  return null;
}

export function isDemoOrganizationId(organizationId: string | null | undefined): boolean {
  return String(organizationId || "").trim() === DEMO_TENANT_ID;
}
