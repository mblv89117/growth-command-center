import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getAppUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, authErrorResponse } from "@/lib/auth/api";

export async function POST() {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const auth = await requireAuth();
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const { data: org } = await admin
      .from("gcc_organizations")
      .select("stripe_customer_id")
      .eq("id", auth.organizationId)
      .maybeSingle();

    if (!org?.stripe_customer_id) {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    const session = await getStripe()!.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${getAppUrl()}/settings?tab=billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return authErrorResponse(error);
  }
}
