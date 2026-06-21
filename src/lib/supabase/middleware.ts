import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEMO_MODE_COOKIE,
  isAdminRoute,
  isDemoModeAllowed,
  isProtectedRoute,
  isPublicApiRoute,
  isSupabaseConfigured,
} from "@/lib/config";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let supabaseResponse = NextResponse.next({ request });

  // API routes — public callbacks only; others require auth in route handlers
  if (pathname.startsWith("/api/")) {
    if (isPublicApiRoute(pathname)) return supabaseResponse;
    return supabaseResponse;
  }

  if (!isProtectedRoute(pathname)) {
    return supabaseResponse;
  }

  const demoMode = isDemoModeAllowed() && request.cookies.get(DEMO_MODE_COOKIE)?.value === "1";

  if (!isSupabaseConfigured()) {
    if (!demoMode) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !demoMode) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminRoute(pathname)) {
    if (demoMode || !user) {
      const url = request.nextUrl.clone();
      url.pathname = user || demoMode ? "/dashboard" : "/login";
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("gcc_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role ?? (user.user_metadata?.role as string | undefined);
    if (role !== "platform_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
