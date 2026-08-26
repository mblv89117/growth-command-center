import { createAdminClient } from "@/lib/supabase/admin";
import { organizationIdFromSlug, uniqueSlug } from "@/lib/tenant/slug";
import type { Organization } from "@/lib/types";
import { mapOrganizationRow } from "@/lib/data/organizations";
import type { GtmAttribution } from "@/lib/gtm/attribution";

export interface ProvisionTenantInput {
  userId: string;
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
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: profile } = await admin
    .from("gcc_profiles")
    .select("organization_id")
    .eq("id", input.userId)
    .maybeSingle();

  const currentOrgId = profile?.organization_id as string | undefined;
  if (currentOrgId && !DEMO_ORG_IDS.has(currentOrgId)) {
    const { data: existing } = await admin
      .from("gcc_organizations")
      .select("*")
      .eq("id", currentOrgId)
      .maybeSingle();
    if (existing) {
      return { organization: mapOrganizationRow(existing as Record<string, unknown>), created: false };
    }
  }

  const slug = await resolveUniqueSlug(admin, input.companyName);
  const orgId = organizationIdFromSlug(slug);

  const { error: orgError } = await admin.from("gcc_organizations").insert({
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

  if (orgError && !orgError.message.includes("duplicate")) {
    throw new Error(`Failed to create organization: ${orgError.message}`);
  }

  await admin.from("gcc_financial_snapshots").upsert(
    { organization_id: orgId },
    { onConflict: "organization_id" }
  );

  const { error: profileError } = await admin
    .from("gcc_profiles")
    .update({ organization_id: orgId, role: "founder" })
    .eq("id", input.userId);

  if (profileError) {
    throw new Error(`Failed to link profile: ${profileError.message}`);
  }

  const { data: org } = await admin.from("gcc_organizations").select("*").eq("id", orgId).single();
  return { organization: mapOrganizationRow(org as Record<string, unknown>), created: true };
}

async function resolveUniqueSlug(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  companyName: string
): Promise<string> {
  return uniqueSlug(companyName, async (slug) => {
    const orgId = organizationIdFromSlug(slug);
    const { data } = await admin.from("gcc_organizations").select("id").eq("id", orgId).maybeSingle();
    return Boolean(data);
  }) as Promise<string>;
}

export async function ensureUserTenant(
  userId: string,
  metadata: Record<string, unknown>
): Promise<ProvisionTenantResult | null> {
  const companyName = (metadata.company_name as string) ?? (metadata.full_name as string) ?? "My Company";
  return provisionTenantForUser({ userId, companyName, industry: metadata.industry as string | undefined });
}
