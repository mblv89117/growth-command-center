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

/**
 * GCC-RT-05: organization is derived from the authenticated session only.
 * Browser-supplied organizationId may be compared for mismatch detection but is
 * never authoritative for non-platform_admin roles.
 */
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
    // Platform admin may switch tenant deliberately; session still authenticates the actor.
    return { organizationId: requested, denied: false };
  }
  // Fail closed: keep session org, deny the request.
  return { organizationId: authOrg, denied: true, reason: "organization_mismatch" };
}

/**
 * Resolve the organization id that MUST be used for data access.
 * Always returns the session org for non-admins (never the browser string).
 */
export function resolveDataOrganizationId(input: {
  authOrganizationId: string;
  requestedOrganizationId?: string | null;
  role: string;
}): string {
  const selected = selectOrganizationId(input);
  if (selected.denied) {
    throw new Error(selected.reason ?? "organization_mismatch");
  }
  return selected.organizationId;
}

export function publicSignupOrganizationId(): null {
  return null;
}

export function isDemoOrganizationId(organizationId: string | null | undefined): boolean {
  return String(organizationId || "").trim() === DEMO_TENANT_ID;
}
