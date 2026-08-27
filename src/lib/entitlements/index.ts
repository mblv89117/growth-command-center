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
  subscriptionStatus: string;
  trialEndsAt?: string | null;
}

const STANDALONE_PRICE_MONTHLY = 149;
const ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing", "past_due"]);

export { STANDALONE_PRICE_MONTHLY };

export function resolveEntitlement(org: {
  access_type?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  hvcg_engagement_active?: boolean | null;
  plan?: string | null;
}): EntitlementCheck {
  const accessType = (org.access_type as AccessType) ?? "trial";
  const subscriptionStatus = org.subscription_status ?? "trial";
  const trialEnds = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const trialActive = trialEnds ? trialEnds > new Date() : accessType === "trial";

  if (accessType === "hvcg_included" && org.hvcg_engagement_active) {
    return {
      hasAccess: true,
      reason: "Included with active HVCG advisory engagement",
      accessType: "hvcg_included",
      showBilling: false,
      subscriptionStatus,
      trialEndsAt: org.trial_ends_at,
    };
  }

  if (
    accessType === "standalone" &&
    ACTIVE_STRIPE_STATUSES.has(subscriptionStatus)
  ) {
    return {
      hasAccess: true,
      reason:
        subscriptionStatus === "past_due"
          ? "Standalone subscription past due — update payment method"
          : subscriptionStatus === "trialing"
            ? "Standalone subscription trial active"
            : "Active standalone subscription",
      accessType: "standalone",
      showBilling: true,
      subscriptionStatus,
      trialEndsAt: org.trial_ends_at,
    };
  }

  if (trialActive || accessType === "trial") {
    return {
      hasAccess: true,
      reason: "Trial period active",
      accessType: "trial",
      showBilling: true,
      subscriptionStatus,
      trialEndsAt: org.trial_ends_at,
    };
  }

  return {
    hasAccess: false,
    reason: "Subscription inactive — renew to continue access",
    accessType: "inactive",
    showBilling: true,
    subscriptionStatus,
    trialEndsAt: org.trial_ends_at,
  };
}

export function canUseConnectors(entitlement: EntitlementCheck): boolean {
  return entitlement.hasAccess;
}

export function canUseFileImport(entitlement: EntitlementCheck): boolean {
  return entitlement.hasAccess;
}

export function subscriptionStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trialing";
    case "past_due":
      return "Past Due";
    case "canceled":
      return "Canceled";
    case "unpaid":
      return "Unpaid";
    case "trial":
      return "Trial";
    case "incomplete":
      return "Incomplete";
    default:
      return status.replaceAll("_", " ");
  }
}
