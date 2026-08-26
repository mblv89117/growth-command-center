export type AccessType = "trial" | "standalone" | "hvcg_included" | "inactive";

export interface OrganizationEntitlement {
  organizationId: string;
  accessType: AccessType;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt?: string;
  hvcgEngagementActive: boolean;
  hvcgClientSince?: string;
  stripeCustomerId?: string;
}

export interface EntitlementCheck {
  hasAccess: boolean;
  reason: string;
  accessType: AccessType;
  showBilling: boolean;
}

const STANDALONE_PRICE_MONTHLY = 149;

export { STANDALONE_PRICE_MONTHLY };

export function resolveEntitlement(org: {
  access_type?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  hvcg_engagement_active?: boolean | null;
  plan?: string | null;
}): EntitlementCheck {
  const accessType = (org.access_type as AccessType) ?? "trial";
  const trialEnds = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const trialActive = trialEnds ? trialEnds > new Date() : accessType === "trial";

  if (accessType === "hvcg_included" && org.hvcg_engagement_active) {
    return {
      hasAccess: true,
      reason: "Included with active HVCG advisory engagement",
      accessType: "hvcg_included",
      showBilling: false,
    };
  }

  if (accessType === "standalone" && org.subscription_status === "active") {
    return {
      hasAccess: true,
      reason: "Active standalone subscription",
      accessType: "standalone",
      showBilling: true,
    };
  }

  if (trialActive || accessType === "trial") {
    return {
      hasAccess: true,
      reason: "Trial period active",
      accessType: "trial",
      showBilling: true,
    };
  }

  return {
    hasAccess: false,
    reason: "Subscription inactive — renew to continue access",
    accessType: "inactive",
    showBilling: true,
  };
}

export function canUseConnectors(entitlement: EntitlementCheck): boolean {
  return entitlement.hasAccess;
}

export function canUseFileImport(entitlement: EntitlementCheck): boolean {
  return entitlement.hasAccess;
}
