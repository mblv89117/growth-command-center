import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getAppUrl } from "@/lib/config";
import { fetchOrganizationBillingFields } from "@/lib/data/active-runtime-plane";
import { isPersistentDataBackendAvailable } from "@/lib/data/data-plane";
import { requireAuth, authErrorResponse } from "@/lib/auth/api";

export async function POST() {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const auth = await requireAuth();
    if (!isPersistentDataBackendAvailable()) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const org = await fetchOrganizationBillingFields(auth.organizationId);
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
