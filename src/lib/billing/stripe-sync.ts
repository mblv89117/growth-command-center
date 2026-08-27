import type Stripe from "stripe";
import type { AccessType } from "@/lib/entitlements";
import { STANDALONE_PLAN_KEY } from "@/lib/stripe/config";

export interface StripeOrgSyncPatch {
  plan?: string;
  subscription_status: string;
  access_type: AccessType;
  stripe_customer_id?: string;
}

export function mapStripeSubscriptionStatus(
  stripeStatus: string
): { subscriptionStatus: string; accessType: AccessType; hasPaidAccess: boolean } {
  switch (stripeStatus) {
    case "trialing":
      return { subscriptionStatus: "trialing", accessType: "standalone", hasPaidAccess: true };
    case "active":
      return { subscriptionStatus: "active", accessType: "standalone", hasPaidAccess: true };
    case "past_due":
      return { subscriptionStatus: "past_due", accessType: "standalone", hasPaidAccess: true };
    case "unpaid":
      return { subscriptionStatus: "unpaid", accessType: "inactive", hasPaidAccess: false };
    case "canceled":
      return { subscriptionStatus: "canceled", accessType: "inactive", hasPaidAccess: false };
    case "incomplete":
    case "incomplete_expired":
      return { subscriptionStatus: stripeStatus, accessType: "inactive", hasPaidAccess: false };
    default:
      return { subscriptionStatus: stripeStatus, accessType: "inactive", hasPaidAccess: false };
  }
}

export function resolvePlanFromMetadata(
  metadata?: Stripe.Metadata | null,
  fallback = STANDALONE_PLAN_KEY
): string {
  const plan = metadata?.plan;
  if (plan === "starter" || plan === "growth" || plan === "enterprise") return plan;
  return fallback;
}

export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  const periodEnd = subscription.items?.data?.[0]?.current_period_end;
  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}

export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

export function buildSubscriptionRow(
  organizationId: string,
  subscription: Stripe.Subscription
) {
  const mapped = mapStripeSubscriptionStatus(subscription.status);
  return {
    organization_id: organizationId,
    stripe_customer_id:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id,
    stripe_subscription_id: subscription.id,
    plan: resolvePlanFromMetadata(subscription.metadata),
    status: subscription.status,
    current_period_end: getSubscriptionPeriodEnd(subscription),
    mapped,
  };
}

export function buildOrganizationBillingPatch(
  subscription: Stripe.Subscription,
  preserveHvcg = false
): Partial<StripeOrgSyncPatch> & { subscription_status: string; plan: string } {
  const mapped = mapStripeSubscriptionStatus(subscription.status);
  const plan = resolvePlanFromMetadata(subscription.metadata);

  if (preserveHvcg) {
    return {
      plan,
      subscription_status: mapped.subscriptionStatus,
    };
  }

  return {
    plan,
    subscription_status: mapped.subscriptionStatus,
    access_type: mapped.accessType,
    stripe_customer_id:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id,
  };
}
