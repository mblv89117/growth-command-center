import { isDemoModeAllowed, isProduction, DEMO_MODE_COOKIE, DEMO_ROLE_COOKIE } from "@/lib/config";
import { isUserRole } from "@/lib/auth/roles";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isDemoModeAllowed()) {
    return NextResponse.json({ error: "Demo mode is disabled in production" }, { status: 403 });
  }

  let demoRole: string | undefined;
  try {
    const body = await request.json();
    demoRole = typeof body?.role === "string" ? body.role : undefined;
  } catch {
    demoRole = undefined;
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(DEMO_MODE_COOKIE, "1", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  if (demoRole && isUserRole(demoRole) && demoRole !== "platform_admin") {
    response.cookies.set(DEMO_ROLE_COOKIE, demoRole, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
  }

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(DEMO_MODE_COOKIE);
  response.cookies.delete(DEMO_ROLE_COOKIE);
  return response;
}
