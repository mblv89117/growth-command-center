import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEntitlement, type AccessType } from "@/lib/entitlements";
import { STANDALONE_PRICE_MONTHLY } from "@/lib/entitlements";

export interface PlatformTenantSummary {
  organizationId: string;
  companyName: string;
  slug: string;
  primaryUserName: string | null;
  primaryEmail: string | null;
  signupDate: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  plan: string;
  subscriptionStatus: string;
  accessType: AccessType;
  billingStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  lastLogin: string | null;
  onboardingComplete: boolean;
  onboardingStep: string | null;
  dataSource: string | null;
  connectedSystemsCount: number;
  lastSuccessfulImport: string | null;
  tenantHealth: "healthy" | "attention" | "inactive";
  hvcgIncluded: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  nextBillingDate: string | null;
  estimatedMrr: number;
}

export interface PlatformTenantDirectory {
  tenants: PlatformTenantSummary[];
  counts: {
    total: number;
    trialing: number;
    activePaid: number;
    pastDue: number;
    canceled: number;
    hvcgIncluded: number;
    onboardingIncomplete: number;
  };
  totals: {
    estimatedMrr: number;
    totalUsers: number;
  };
}

function deriveTenantHealth(row: {
  subscription_status?: string | null;
  access_type?: string | null;
  hvcg_engagement_active?: boolean | null;
  onboarding_complete?: boolean | null;
}): PlatformTenantSummary["tenantHealth"] {
  const entitlement = resolveEntitlement({
    access_type: row.access_type,
    subscription_status: row.subscription_status,
    hvcg_engagement_active: row.hvcg_engagement_active,
  });

  if (!entitlement.hasAccess) return "inactive";
  if (!row.onboarding_complete) return "attention";
  if (row.subscription_status === "past_due") return "attention";
  return "healthy";
}

function estimateMrr(accessType: AccessType, subscriptionStatus: string | null): number {
  if (accessType === "hvcg_included") return 0;
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return STANDALONE_PRICE_MONTHLY;
  }
  return 0;
}

export async function getPlatformTenantDirectory(): Promise<PlatformTenantDirectory | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: orgs, error } = await admin
    .from("gcc_organizations")
    .select(
      "id, name, slug, plan, created_at, trial_ends_at, subscription_status, access_type, hvcg_engagement_active, hvcg_client_since, stripe_customer_id, onboarding_complete, onboarding_step, data_source"
    )
    .order("created_at", { ascending: false });

  if (error || !orgs) return null;

  const orgIds = orgs.map((org) => org.id as string);

  const [{ data: subscriptions }, { data: profiles }, { data: integrations }] = await Promise.all([
    admin
      .from("gcc_subscriptions")
      .select("organization_id, stripe_subscription_id, status, current_period_end, plan")
      .in("organization_id", orgIds.length ? orgIds : ["__none__"]),
    admin
      .from("gcc_profiles")
      .select("id, organization_id, full_name, role")
      .in("organization_id", orgIds.length ? orgIds : ["__none__"]),
    admin
      .from("gcc_integration_connections")
      .select("organization_id, status, last_sync")
      .in("organization_id", orgIds.length ? orgIds : ["__none__"]),
  ]);

  const subByOrg = new Map(
    (subscriptions ?? []).map((row) => [row.organization_id as string, row])
  );

  const profilesByOrg = new Map<string, typeof profiles>();
  for (const profile of profiles ?? []) {
    const orgId = profile.organization_id as string;
    const list = profilesByOrg.get(orgId) ?? [];
    list.push(profile);
    profilesByOrg.set(orgId, list);
  }

  const integrationsByOrg = new Map<string, typeof integrations>();
  for (const integration of integrations ?? []) {
    const orgId = integration.organization_id as string;
    const list = integrationsByOrg.get(orgId) ?? [];
    list.push(integration);
    integrationsByOrg.set(orgId, list);
  }

  const founderIds = orgs
    .map((org) => {
      const orgId = org.id as string;
      const orgProfiles = profilesByOrg.get(orgId) ?? [];
      const founder =
        orgProfiles.find((p) => p.role === "founder") ??
        orgProfiles.find((p) => p.role === "platform_admin") ??
        orgProfiles[0];
      return founder?.id as string | undefined;
    })
    .filter(Boolean) as string[];

  const emailByUserId = new Map<string, string>();
  await Promise.all(
    founderIds.map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data.user?.email) emailByUserId.set(userId, data.user.email);
    })
  );

  const tenants: PlatformTenantSummary[] = orgs.map((org) => {
    const orgId = org.id as string;
    const orgProfiles = profilesByOrg.get(orgId) ?? [];
    const founder =
      orgProfiles.find((p) => p.role === "founder") ??
      orgProfiles.find((p) => p.role === "platform_admin") ??
      orgProfiles[0];
    const sub = subByOrg.get(orgId);
    const orgIntegrations = integrationsByOrg.get(orgId) ?? [];
    const connected = orgIntegrations.filter((i) => i.status === "connected");
    const lastSync = connected
      .map((i) => i.last_sync as string | null)
      .filter(Boolean)
      .sort()
      .pop() ?? null;
    const accessType = (org.access_type as AccessType) ?? "trial";
    const subscriptionStatus = String(org.subscription_status ?? "trial");
    const hvcgIncluded = accessType === "hvcg_included" && Boolean(org.hvcg_engagement_active);
    const billingStatus = hvcgIncluded
      ? "hvcg_included"
      : sub?.status
        ? String(sub.status)
        : subscriptionStatus;

    return {
      organizationId: orgId,
      companyName: String(org.name ?? orgId),
      slug: String(org.slug ?? orgId),
      primaryUserName: (founder?.full_name as string | null) ?? null,
      primaryEmail: founder?.id ? emailByUserId.get(founder.id as string) ?? null : null,
      signupDate: (org.created_at as string | null) ?? null,
      trialStart: (org.hvcg_client_since as string | null) ?? (org.created_at as string | null),
      trialEnd: (org.trial_ends_at as string | null) ?? null,
      plan: String(sub?.plan ?? org.plan ?? "starter"),
      subscriptionStatus,
      accessType,
      billingStatus,
      stripeCustomerId: (org.stripe_customer_id as string | null) ?? null,
      stripeSubscriptionId: (sub?.stripe_subscription_id as string | null) ?? null,
      lastLogin: null,
      onboardingComplete: Boolean(org.onboarding_complete),
      onboardingStep: (org.onboarding_step as string | null) ?? null,
      dataSource: (org.data_source as string | null) ?? null,
      connectedSystemsCount: connected.length,
      lastSuccessfulImport: lastSync,
      tenantHealth: deriveTenantHealth(org),
      hvcgIncluded,
      createdAt: (org.created_at as string | null) ?? null,
      updatedAt: (org.created_at as string | null) ?? null,
      nextBillingDate: (sub?.current_period_end as string | null) ?? null,
      estimatedMrr: estimateMrr(accessType, subscriptionStatus),
    };
  });

  const counts = {
    total: tenants.length,
    trialing: tenants.filter((t) => t.subscriptionStatus === "trialing" || t.accessType === "trial")
      .length,
    activePaid: tenants.filter(
      (t) =>
        (t.subscriptionStatus === "active" || t.subscriptionStatus === "trialing") &&
        t.accessType === "standalone"
    ).length,
    pastDue: tenants.filter((t) => t.subscriptionStatus === "past_due").length,
    canceled: tenants.filter((t) => t.subscriptionStatus === "canceled").length,
    hvcgIncluded: tenants.filter((t) => t.hvcgIncluded).length,
    onboardingIncomplete: tenants.filter((t) => !t.onboardingComplete).length,
  };

  return {
    tenants,
    counts,
    totals: {
      estimatedMrr: tenants.reduce((sum, tenant) => sum + tenant.estimatedMrr, 0),
      totalUsers: profiles?.length ?? 0,
    },
  };
}
