import { NextRequest, NextResponse } from "next/server";
import {
  ENTRA_SESSION_COOKIE,
  ENTRA_STATE_COOKIE,
  exchangeAuthorizationCode,
  sealSession,
  verifyIdToken,
} from "@/lib/auth/entra/oidc";
import { isEntraAuthEnabled } from "@/lib/auth/entra/config";
import { linkEntraIdentity } from "@/lib/auth/entra/identity";

export async function handleEntraCallback(request: NextRequest): Promise<NextResponse> {
  if (!isEntraAuthEnabled()) {
    return NextResponse.redirect(new URL("/login?error=auth_provider", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(oauthError)}`, request.url)
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const raw = request.cookies.get(ENTRA_STATE_COOKIE)?.value;
  if (!raw) {
    return NextResponse.redirect(new URL("/login?error=missing_state", request.url));
  }

  let parsed: { state: string; verifier: string; next?: string };
  try {
    parsed = JSON.parse(raw) as { state: string; verifier: string; next?: string };
  } catch {
    return NextResponse.redirect(new URL("/login?error=bad_state", request.url));
  }
  if (parsed.state !== state) {
    return NextResponse.redirect(new URL("/login?error=state_mismatch", request.url));
  }

  try {
    const tokens = await exchangeAuthorizationCode({
      code,
      codeVerifier: parsed.verifier,
    });
    const session = await verifyIdToken(tokens.idToken);
    await linkEntraIdentity(session);
    const sealed = await sealSession(session);
    const nextPath = parsed.next?.startsWith("/") ? parsed.next : "/dashboard";
    const res = NextResponse.redirect(new URL(nextPath, request.url));
    res.cookies.set(ENTRA_SESSION_COOKIE, sealed, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(60, session.exp - Math.floor(Date.now() / 1000)),
    });
    res.cookies.set(ENTRA_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    return NextResponse.redirect(new URL("/login?error=entra_exchange", request.url));
  }
}
