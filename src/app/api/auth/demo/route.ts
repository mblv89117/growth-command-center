import { isDemoModeAllowed, isProduction } from "@/lib/config";
import { DEMO_MODE_COOKIE } from "@/lib/config";
import { NextResponse } from "next/server";

export async function POST() {
  if (!isDemoModeAllowed()) {
    return NextResponse.json({ error: "Demo mode is disabled in production" }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(DEMO_MODE_COOKIE, "1", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(DEMO_MODE_COOKIE);
  return response;
}
