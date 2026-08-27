import { ORGANIZATIONS } from "@/lib/mock-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEntitlement } from "@/lib/entitlements";
import type { Organization, OrganizationSettings } from "@/lib/types";

const DEFAULT_SETTINGS: OrganizationSettings = {
  cashAlertThreshold: 150000,
  forecastHorizonWeeks: 13,
  fiscalYearStart: 1,
  currency: "USD",
};

function isPlan(value: unknown): value is Organization["plan"] {
  return value === "starter" || value === "growth" || value === "enterprise";
}

export function mapOrganizationRow(row: Record<string, unknown>): Organization {
  const settings = (row.settings as Record<string, unknown> | null) ?? {};
  const entitlement = resolveEntitlement({
    access_type: row.access_type as string | null,
    subscription_status: row.subscription_status as string | null,
    trial_ends_at: row.trial_ends_at as string | null,
    hvcg_engagement_active: row.hvcg_engagement_active as boolean | null,
    plan: row.plan as string | null,
  });

  return {
    id: String(row.id),
    name: String(row.name ?? "Organization"),
    slug: String(row.slug ?? row.id),
    industry: String(row.industry ?? ""),
    plan: isPlan(row.plan) ? row.plan : "starter",
    createdAt: String(row.created_at ?? new Date().toISOString()).slice(0, 10),
    settings: {
      cashAlertThreshold: Number(settings.cashAlertThreshold ?? DEFAULT_SETTINGS.cashAlertThreshold),
      forecastHorizonWeeks: Number(settings.forecastHorizonWeeks ?? DEFAULT_SETTINGS.forecastHorizonWeeks),
      fiscalYearStart: Number(settings.fiscalYearStart ?? DEFAULT_SETTINGS.fiscalYearStart),
      currency: String(settings.currency ?? DEFAULT_SETTINGS.currency),
    },
    billing: {
      accessType: entitlement.accessType,
      subscriptionStatus: entitlement.subscriptionStatus,
      trialEndsAt: entitlement.trialEndsAt,
      hvcgEngagementActive: Boolean(row.hvcg_engagement_active),
      stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
      showBilling: entitlement.showBilling,
      entitlementReason: entitlement.reason,
      hasAccess: entitlement.hasAccess,
    },
  };
}

export async function getOrganizationById(organizationId: string): Promise<Organization> {
  const fallback =
    ORGANIZATIONS.find((org) => org.id === organizationId) ?? {
      ...ORGANIZATIONS[0],
      id: organizationId,
      name: organizationId,
      slug: organizationId,
    };

  const admin = createAdminClient();
  if (!admin) return fallback;

  const { data, error } = await admin
    .from("gcc_organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) return fallback;
  return mapOrganizationRow(data as Record<string, unknown>);
}
