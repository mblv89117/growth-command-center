import { NextResponse } from "next/server";
import { exchangeQuickBooksCode } from "@/lib/integrations/quickbooks";
import { upsertConnection } from "@/lib/integrations/store";
import { verifySignedQuickBooksState } from "@/lib/integrations/oauth-state";
import { requireApiAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/integrations?error=${encodeURIComponent(error)}`);
  }

  if (!code || !realmId || !state) {
    return NextResponse.redirect(`${origin}/integrations?error=missing_oauth_params`);
  }

  try {
    // GCC-RT-03: require authenticated session and verify signed state.
    const access = await requireApiAccess();
    const parsed = verifySignedQuickBooksState(state, { userId: access.userId });

    if (parsed.organizationId !== access.organizationId && access.role !== "platform_admin") {
      return NextResponse.redirect(`${origin}/integrations?error=oauth_org_mismatch`);
    }

    await requireApiAccess({ organizationId: parsed.organizationId });

    const tokens = await exchangeQuickBooksCode(code, realmId);

    await upsertConnection({
      organizationId: parsed.organizationId,
      provider: "quickbooks",
      status: "connected",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      realmId: tokens.realmId,
      connectedAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      metadata: { expiresAt: tokens.expiresAt },
    });

    return NextResponse.redirect(`${origin}/integrations?connected=quickbooks`);
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) {
      return authErrorResponse(err);
    }
    const message = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(`${origin}/integrations?error=${encodeURIComponent(message)}`);
  }
}
