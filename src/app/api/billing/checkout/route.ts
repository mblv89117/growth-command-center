import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  STRIPE_PLANS,
  STRIPE_TRIAL_DAYS,
  STANDALONE_PLAN_KEY,
  type PlanKey,
  getStandalonePriceId,
  isStripeConfigured,
} from "@/lib/stripe/config";
import { getAppUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, authErrorResponse } from "@/lib/auth/api";
import { resolveEntitlement } from "@/lib/entitlements";

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const auth = await requireAuth();
    const body = await request.json();
    const plan = (body.plan as PlanKey) ?? STANDALONE_PLAN_KEY;
    const planConfig = STRIPE_PLANS[plan];

    const priceId = plan === STANDALONE_PLAN_KEY ? getStandalonePriceId() : planConfig.priceId;
    if (!priceId) {
      return NextResponse.json(
        { error: `Missing Stripe price ID for ${plan} plan` },
        { status: 503 }
      );
    }

    const stripe = getStripe()!;
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const { data: org } = await admin
      .from("gcc_organizations")
      .select(
        "stripe_customer_id, name, access_type, subscription_status, trial_ends_at, hvcg_engagement_active"
      )
      .eq("id", auth.organizationId)
      .maybeSingle();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const entitlement = resolveEntitlement(org);
    if (!entitlement.showBilling) {
      return NextResponse.json(
        { error: "Billing is not required for HVCG included access" },
        { status: 400 }
      );
    }

    let customerId = org.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.email,
        name: org.name ?? auth.organizationId,
        metadata: { organizationId: auth.organizationId },
      });
      customerId = customer.id;
      await admin
        .from("gcc_organizations")
        .update({ stripe_customer_id: customerId, plan })
        .eq("id", auth.organizationId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${getAppUrl()}/settings?tab=billing&success=1`,
      cancel_url: `${getAppUrl()}/settings?tab=billing&cancelled=1`,
      metadata: { organizationId: auth.organizationId, plan },
      subscription_data: {
        trial_period_days: STRIPE_TRIAL_DAYS,
        metadata: { organizationId: auth.organizationId, plan },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return authErrorResponse(error);
  }
}
