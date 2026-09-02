import { NextRequest, NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  createOAuthState,
  createPkcePair,
  ENTRA_STATE_COOKIE,
  entraReadyForProduction,
} from "@/lib/auth/entra/oidc";
import { isEntraAuthEnabled } from "@/lib/auth/entra/config";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isEntraAuthEnabled()) {
    return NextResponse.json(
      { error: "AUTH_PROVIDER is not entra", AUTH_PROVIDER: "supabase" },
      { status: 409 }
    );
  }
  if (!entraReadyForProduction()) {
    return NextResponse.json(
      {
        error: "Entra External ID is not fully configured",
        OWNER_GATE: "ENTRA_EXTERNAL_TENANT_SETUP",
      },
      { status: 503 }
    );
  }

  const loginHint = request.nextUrl.searchParams.get("login_hint") ?? undefined;
  const next = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  const { verifier, challenge } = createPkcePair();
  const state = createOAuthState();
  const authorizeUrl = buildAuthorizationUrl({
    state,
    codeChallenge: challenge,
    loginHint,
  });

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(ENTRA_STATE_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
