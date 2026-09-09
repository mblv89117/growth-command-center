import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { isStripeConfigured } from "@/lib/stripe/config";
import {
  fetchSubscriptionByStripeCustomer,
  updateOrganizationBilling,
  updateSubscriptionStatus,
  upsertSubscriptionRow,
} from "@/lib/data/active-runtime-plane";
import { isPersistentDataBackendAvailable } from "@/lib/data/data-plane";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const stripe = getStripe()!;
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!isPersistentDataBackendAvailable()) {
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orgId = session.metadata?.organizationId;
    const plan = session.metadata?.plan ?? "growth";
    if (orgId) {
      await updateOrganizationBilling(orgId, { plan });
      await upsertSubscriptionRow({
        organization_id: orgId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan,
        status: "active",
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const customerId = sub.customer as string;
    const subRow = await fetchSubscriptionByStripeCustomer(customerId);
    if (subRow) {
      await updateSubscriptionStatus(subRow.organization_id, "cancelled");
      await updateOrganizationBilling(subRow.organization_id, { plan: "starter" });
    }
  }

  return NextResponse.json({ received: true });
}
