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
import { getSupabaseUrl } from "@/lib/supabase/url";
import { evaluateAdminRouteAccess } from "@/lib/auth/admin-gate";
import { getAuthProvider, isEntraAuthEnabled } from "@/lib/auth/entra/config";
import { resolveProfileForEntra } from "@/lib/auth/entra/identity";
import { ENTRA_SESSION_COOKIE, unsealSession } from "@/lib/auth/entra/oidc";
import { fetchProfileByEmail } from "@/lib/data/active-runtime-plane";
import {
  isEntraSessionGateSatisfied,
  isLikelyAuthSessionCookieName,
  shouldUseSupabaseSessionGate,
} from "@/lib/auth/session-gate";
import {
  captureAttributionFromRequest,
  attributionCookieOptions,
  serializeAttribution,
  UTM_PARAM_KEYS,
} from "@/lib/gtm/attribution";
import { isMarketingHost, getAppUrl } from "@/lib/domains";
import {
  getRequestHost,
  resolveAppHostRedirectTarget,
  resolveMarketingToAppRedirectTarget,
  resolveWwwRedirectTarget,
  shouldApplyCommercialDomainRouting,
} from "@/lib/domains/routing";
import { buildAppRedirectUrl } from "@/lib/gtm/attribution";

function redirectTo(target: string, status = 307): NextResponse {
  return NextResponse.redirect(target, status);
}

function withAttributionCookie(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const host = getRequestHost(request);
  const attribution = captureAttributionFromRequest(request);
  const hasUtm = UTM_PARAM_KEYS.some((key) => Boolean(attribution[key]));
  const shouldSet =
    isMarketingHost(host) || hasUtm || Boolean(attribution.referrer || attribution.landing_page);

  if (!shouldSet || Object.keys(attribution).length === 0) return response;

  const options = attributionCookieOptions();
  response.cookies.set(options.name, serializeAttribution(attribution), options);
  return response;
}

function hasLikelyAuthSession(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => isLikelyAuthSessionCookieName(cookie.name));
}

async function resolveEntraAdminRole(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(ENTRA_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await unsealSession(token);
  if (!session) return null;

  const linked = await resolveProfileForEntra(session);
  if (linked?.role) return linked.role;

  const profile = await fetchProfileByEmail(session.email);
  return profile?.role ?? null;
}

async function getAuthenticatedUser(request: NextRequest): Promise<boolean> {
  const cookies = request.cookies.getAll();

  if (hasLikelyAuthSession(request)) return true;

  if (!shouldUseSupabaseSessionGate(getAuthProvider())) {
    return isEntraSessionGateSatisfied(cookies, {
      entraSessionCookieName: ENTRA_SESSION_COOKIE,
      demoModeAllowed: isDemoModeAllowed(),
      demoModeCookieName: DEMO_MODE_COOKIE,
    });
  }

  if (!isSupabaseConfigured()) {
    return isDemoModeAllowed() && request.cookies.get(DEMO_MODE_COOKIE)?.value === "1";
  }

  try {
    const supabaseUrl = getSupabaseUrl();
    if (!supabaseUrl) return false;
    const supabase = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Read-only probe for routing decisions
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return Boolean(user);
  } catch {
    return false;
  }
}

export async function handleDomainRouting(request: NextRequest): Promise<NextResponse | null> {
  try {
    const host = getRequestHost(request);
    if (!shouldApplyCommercialDomainRouting(host)) return null;

    const wwwTarget = resolveWwwRedirectTarget(request);
    if (wwwTarget) {
      return withAttributionCookie(redirectTo(wwwTarget, 308), request);
    }

    const marketingToAppTarget = resolveMarketingToAppRedirectTarget(request);
    if (marketingToAppTarget) {
      const parsed = new URL(marketingToAppTarget);
      const finalTarget = buildAppRedirectUrl(
        getAppUrl(),
        parsed.pathname,
        request,
        parsed.search
      );
      return withAttributionCookie(redirectTo(finalTarget), request);
    }

    const isAuthenticated = await getAuthenticatedUser(request);
    const appTarget = resolveAppHostRedirectTarget(request, isAuthenticated);
    if (appTarget) {
      if (appTarget.startsWith("http")) {
        return redirectTo(appTarget, appTarget.includes("/pricing") ? 308 : 307);
      }
      const url = request.nextUrl.clone();
      url.pathname = appTarget;
      return NextResponse.redirect(url);
    }

    if (isMarketingHost(host)) {
      return withAttributionCookie(NextResponse.next({ request }), request);
    }

    return null;
  } catch (error) {
    console.error("handleDomainRouting failed", error);
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let supabaseResponse = NextResponse.next({ request });

  const domainResponse = await handleDomainRouting(request);
  if (domainResponse) {
    if (domainResponse.status >= 300 && domainResponse.status < 400) {
      return domainResponse;
    }
    supabaseResponse = domainResponse;
  }

  // API routes — public callbacks only; others require auth in route handlers
  if (pathname.startsWith("/api/")) {
    if (isPublicApiRoute(pathname)) return supabaseResponse;
    return supabaseResponse;
  }

  if (!isProtectedRoute(pathname)) {
    return supabaseResponse;
  }

  const demoMode = isDemoModeAllowed() && request.cookies.get(DEMO_MODE_COOKIE)?.value === "1";

  // Entra External ID: sealed cookie gate only — no Supabase SSR client.
  if (isEntraAuthEnabled()) {
    if (
      isEntraSessionGateSatisfied(request.cookies.getAll(), {
        entraSessionCookieName: ENTRA_SESSION_COOKIE,
        demoModeAllowed: isDemoModeAllowed(),
        demoModeCookieName: DEMO_MODE_COOKIE,
      })
    ) {
      if (isAdminRoute(pathname)) {
        const role = await resolveEntraAdminRole(request);
        const adminAccess = evaluateAdminRouteAccess({
          isAdminRoute: true,
          demoMode,
          role,
        });
        if (!adminAccess.allowed) {
          const url = request.nextUrl.clone();
          url.pathname = adminAccess.redirectPath ?? "/dashboard";
          return NextResponse.redirect(url);
        }
      }
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (!isSupabaseConfigured()) {
    if (!demoMode) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
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
