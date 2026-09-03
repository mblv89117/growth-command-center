import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildOrganizationBillingPatch,
  buildSubscriptionRow,
  getInvoiceSubscriptionId,
  getSubscriptionPeriodEnd,
  resolvePlanFromMetadata,
} from "@/lib/billing/stripe-sync";

async function isEventProcessed(admin: SupabaseClient, eventId: string): Promise<boolean> {
  const { data } = await admin
    .from("gcc_stripe_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();
  return Boolean(data);
}

async function markEventProcessed(
  admin: SupabaseClient,
  eventId: string,
  eventType: string
): Promise<void> {
  await admin.from("gcc_stripe_webhook_events").upsert(
    { event_id: eventId, event_type: eventType },
    { onConflict: "event_id" }
  );
}

async function getOrganizationIdForCustomer(
  admin: SupabaseClient,
  customerId: string
): Promise<string | null> {
  const { data: subRow } = await admin
    .from("gcc_subscriptions")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (subRow?.organization_id) return subRow.organization_id as string;

  const { data: orgRow } = await admin
    .from("gcc_organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (orgRow?.id as string | undefined) ?? null;
}

async function orgIsHvcgIncluded(
  admin: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  const { data } = await admin
    .from("gcc_organizations")
    .select("access_type, hvcg_engagement_active")
    .eq("id", organizationId)
    .maybeSingle();
  return data?.access_type === "hvcg_included" && Boolean(data?.hvcg_engagement_active);
}

async function syncSubscription(
  admin: SupabaseClient,
  organizationId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const row = buildSubscriptionRow(organizationId, subscription);
  const preserveHvcg = await orgIsHvcgIncluded(admin, organizationId);

  await admin.from("gcc_subscriptions").upsert(
    {
      organization_id: organizationId,
      stripe_customer_id: row.stripe_customer_id,
      stripe_subscription_id: row.stripe_subscription_id,
      plan: row.plan,
      status: row.status,
      current_period_end: row.current_period_end,
    },
    { onConflict: "organization_id" }
  );

  const orgPatch = buildOrganizationBillingPatch(subscription, preserveHvcg);
  await admin.from("gcc_organizations").update(orgPatch).eq("id", organizationId);
}

export async function handleStripeWebhookEvent(
  admin: SupabaseClient,
  event: Stripe.Event
): Promise<void> {
  if (await isEventProcessed(admin, event.id)) return;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.organizationId;
      const subscriptionId = session.subscription;
      if (!orgId || !subscriptionId || typeof subscriptionId !== "string") break;

      const stripe = (await import("@/lib/stripe")).getStripe();
      if (!stripe) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(admin, orgId, subscription);

      if (session.customer && typeof session.customer === "string") {
        await admin
          .from("gcc_organizations")
          .update({ stripe_customer_id: session.customer })
          .eq("id", orgId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId =
        subscription.metadata?.organizationId ??
        (await getOrganizationIdForCustomer(admin, subscription.customer as string));
      if (orgId) await syncSubscription(admin, orgId, subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const orgId =
        subscription.metadata?.organizationId ??
        (await getOrganizationIdForCustomer(admin, customerId));
      if (!orgId) break;

      const preserveHvcg = await orgIsHvcgIncluded(admin, orgId);
      await admin.from("gcc_subscriptions").upsert(
        {
          organization_id: orgId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          plan: resolvePlanFromMetadata(subscription.metadata),
          status: "canceled",
          current_period_end: getSubscriptionPeriodEnd(subscription),
        },
        { onConflict: "organization_id" }
      );

      if (!preserveHvcg) {
        await admin
          .from("gcc_organizations")
          .update({
            subscription_status: "canceled",
            access_type: "inactive",
          })
          .eq("id", orgId);
      }
      break;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (!subscriptionId) break;

      const stripe = (await import("@/lib/stripe")).getStripe();
      if (!stripe) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const orgId =
        subscription.metadata?.organizationId ??
        (await getOrganizationIdForCustomer(admin, subscription.customer as string));
      if (orgId) await syncSubscription(admin, orgId, subscription);
      break;
    }
    default:
      break;
  }

  await markEventProcessed(admin, event.id, event.type);
}
