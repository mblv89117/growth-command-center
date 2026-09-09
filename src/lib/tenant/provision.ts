import { organizationIdFromSlug, uniqueSlug } from "@/lib/tenant/slug";
import type { Organization } from "@/lib/types";
import { mapOrganizationRow } from "@/lib/data/organizations";
import type { GtmAttribution } from "@/lib/gtm/attribution";
import {
  checkOrganizationSlugTaken,
  fetchProfileByUserId,
  insertOrganizationRow,
  linkProfileToOrganization,
  upsertEmptyFinancialSnapshot,
} from "@/lib/data/active-runtime-plane";
import {
  fetchOrganizationRowById,
  isPersistentDataBackendAvailable,
} from "@/lib/data/data-plane";

export interface ProvisionTenantInput {
  userId: string;
  email?: string;
  companyName: string;
  industry?: string;
  attribution?: GtmAttribution;
}

export interface ProvisionTenantResult {
  organization: Organization;
  created: boolean;
}

const DEMO_ORG_IDS = new Set(["org-apex", "org-summit"]);

export async function provisionTenantForUser(
  input: ProvisionTenantInput
): Promise<ProvisionTenantResult | null> {
  if (!isPersistentDataBackendAvailable()) return null;

  const profile = await fetchProfileByUserId(input.userId);
  const currentOrgId = profile?.organization_id ?? undefined;

  if (currentOrgId && !DEMO_ORG_IDS.has(currentOrgId)) {
    const existing = await fetchOrganizationRowById(currentOrgId);
    if (existing) {
      return { organization: mapOrganizationRow(existing), created: false };
    }
  }

  const slug = await resolveUniqueSlug(input.companyName);
  const orgId = organizationIdFromSlug(slug);

  try {
    await insertOrganizationRow({
      id: orgId,
      name: input.companyName.trim(),
      slug,
      industry: input.industry ?? null,
      plan: "starter",
      subscription_status: "trial",
      data_source: "empty",
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      utm_source: input.attribution?.utm_source ?? null,
      utm_medium: input.attribution?.utm_medium ?? null,
      utm_campaign: input.attribution?.utm_campaign ?? null,
      utm_content: input.attribution?.utm_content ?? null,
      utm_term: input.attribution?.utm_term ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create organization";
    if (!message.includes("duplicate")) {
      throw new Error(`Failed to create organization: ${message}`);
    }
  }

  await upsertEmptyFinancialSnapshot(orgId);
  await linkProfileToOrganization(input.userId, orgId, "founder", input.email);

  const org = await fetchOrganizationRowById(orgId);
  if (!org) {
    throw new Error("Failed to load organization after provisioning");
  }

  return { organization: mapOrganizationRow(org), created: true };
}

async function resolveUniqueSlug(companyName: string): Promise<string> {
  return uniqueSlug(companyName, async (slug) => {
    const orgId = organizationIdFromSlug(slug);
    return checkOrganizationSlugTaken(orgId);
  }) as Promise<string>;
}

export async function ensureUserTenant(
  userId: string,
  metadata: Record<string, unknown>,
  email?: string
): Promise<ProvisionTenantResult | null> {
  const companyName =
    (metadata.company_name as string) ?? (metadata.full_name as string) ?? "My Company";
  return provisionTenantForUser({
    userId,
    email,
    companyName,
    industry: metadata.industry as string | undefined,
  });
}
