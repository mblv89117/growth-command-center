import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { STRIPE_PLANS, type PlanKey, isStripeConfigured } from "@/lib/stripe/config";
import { getAppUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, authErrorResponse } from "@/lib/auth/api";

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const auth = await requireAuth();
    const body = await request.json();
    const plan = (body.plan as PlanKey) ?? "growth";
    const planConfig = STRIPE_PLANS[plan];

    if (!planConfig.priceId) {
      return NextResponse.json({ error: `Missing STRIPE_${plan.toUpperCase()}_PRICE_ID` }, { status: 503 });
    }

    const stripe = getStripe()!;
    const admin = createAdminClient();

    let customerId: string | undefined;
    if (admin) {
      const { data: org } = await admin
        .from("gcc_organizations")
        .select("stripe_customer_id, name")
        .eq("id", auth.organizationId)
        .maybeSingle();
      customerId = org?.stripe_customer_id ?? undefined;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: auth.email,
          name: org?.name ?? auth.organizationId,
          metadata: { organizationId: auth.organizationId },
        });
        customerId = customer.id;
        await admin
          .from("gcc_organizations")
          .update({ stripe_customer_id: customerId, plan })
          .eq("id", auth.organizationId);
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${getAppUrl()}/settings?tab=billing&success=1`,
      cancel_url: `${getAppUrl()}/settings?tab=billing&cancelled=1`,
      metadata: { organizationId: auth.organizationId, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return authErrorResponse(error);
  }
}
