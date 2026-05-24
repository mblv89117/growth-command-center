import { NextResponse } from "next/server";
import { exchangeQuickBooksCode } from "@/lib/integrations/quickbooks";
import { upsertConnection } from "@/lib/integrations/store";

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
    const { organizationId } = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8")
    ) as { organizationId: string };

    const tokens = await exchangeQuickBooksCode(code, realmId);

    await upsertConnection({
      organizationId,
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
    const message = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(`${origin}/integrations?error=${encodeURIComponent(message)}`);
  }
}
