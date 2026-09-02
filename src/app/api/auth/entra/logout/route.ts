import { NextResponse } from "next/server";
import {
  buildLogoutUrl,
  ENTRA_SESSION_COOKIE,
  entraReadyForProduction,
} from "@/lib/auth/entra/oidc";
import { isEntraAuthEnabled } from "@/lib/auth/entra/config";

export const runtime = "nodejs";

async function logout() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.growthcommandcenter.com";
  const target =
    entraReadyForProduction() && isEntraAuthEnabled()
      ? buildLogoutUrl()
      : `${appUrl}/login`;
  const res = NextResponse.redirect(target);
  res.cookies.set(ENTRA_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function GET() {
  return logout();
}

export async function POST() {
  return logout();
}
