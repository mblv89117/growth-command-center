import { NextRequest, NextResponse } from "next/server";
import {
  ENTRA_SESSION_COOKIE,
  ENTRA_STATE_COOKIE,
  exchangeAuthorizationCode,
  sealSession,
  verifyIdToken,
} from "@/lib/auth/entra/oidc";
import { entraAbsolutePath, isEntraAuthEnabled } from "@/lib/auth/entra/config";
import { linkEntraIdentity } from "@/lib/auth/entra/identity";

function redirectPublic(pathAndQuery: string): NextResponse {
  return NextResponse.redirect(entraAbsolutePath(pathAndQuery));
}

export async function handleEntraCallback(request: NextRequest): Promise<NextResponse> {
  if (!isEntraAuthEnabled()) {
    return redirectPublic("/login?error=auth_provider");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return redirectPublic(`/login?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return redirectPublic("/login?error=missing_code");
  }

  const raw = request.cookies.get(ENTRA_STATE_COOKIE)?.value;
  if (!raw) {
    return redirectPublic("/login?error=missing_state");
  }

  let parsed: { state: string; verifier: string; next?: string };
  try {
    parsed = JSON.parse(raw) as { state: string; verifier: string; next?: string };
  } catch {
    return redirectPublic("/login?error=bad_state");
  }
  if (parsed.state !== state) {
    return redirectPublic("/login?error=state_mismatch");
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
    const res = redirectPublic(nextPath);
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
    return redirectPublic("/login?error=entra_exchange");
  }
}
