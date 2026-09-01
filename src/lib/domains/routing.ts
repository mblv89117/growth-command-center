import type { NextRequest } from "next/server";
import {
  APP_SUBDOMAIN,
  COMMERCIAL_DOMAIN,
  COMMERCIAL_WWW,
  getAppUrl,
  getPrimaryPublicUrl,
  isAppHost,
  isMarketingHost,
} from "@/lib/domains";

/** Paths served only on the public marketing domain */
export const MARKETING_ONLY_PATHS = new Set(["/", "/pricing", "/privacy", "/terms"]);

/** Marketing SEO/static assets that should not live on the app subdomain */
const MARKETING_CANONICAL_PATHS = new Set(["/sitemap.xml", "/robots.txt"]);

export function normalizeHost(host: string | null): string {
  return (host ?? "").toLowerCase().replace(/:\d+$/, "");
}

export function shouldApplyCommercialDomainRouting(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized || normalized === "localhost" || normalized.startsWith("127.0.0.1")) {
    return false;
  }
  return (
    normalized === COMMERCIAL_DOMAIN ||
    normalized === COMMERCIAL_WWW ||
    normalized === APP_SUBDOMAIN ||
    normalized.endsWith(".vercel.app")
  );
}

export function isWwwHost(host: string): boolean {
  return normalizeHost(host) === COMMERCIAL_WWW;
}

export function isApiOrNextInternalPath(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname.startsWith("/_next/");
}

export function resolveWwwRedirectTarget(request: NextRequest): string | null {
  const host = request.headers.get("host");
  if (!isWwwHost(host ?? "")) return null;

  const marketingBase = getPrimaryPublicUrl();
  const target = new URL(request.nextUrl.pathname, marketingBase);
  target.search = request.nextUrl.search;
  return target.toString();
}

export function resolveMarketingToAppRedirectTarget(
  request: NextRequest
): string | null {
  const host = request.headers.get("host");
  if (!isMarketingHost(host ?? "")) return null;

  const { pathname } = request.nextUrl;
  if (MARKETING_ONLY_PATHS.has(pathname)) return null;
  if (isApiOrNextInternalPath(pathname)) return null;

  const appBase = getAppUrl();
  const target = new URL(pathname, appBase);
  target.search = request.nextUrl.search;
  return target.toString();
}

export function resolveAppHostRedirectTarget(
  request: NextRequest,
  isAuthenticated: boolean
): string | null {
  const host = request.headers.get("host");
  if (!isAppHost(host ?? "")) return null;

  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return isAuthenticated ? "/dashboard" : "/login";
  }

  if (
    pathname === "/pricing" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    MARKETING_CANONICAL_PATHS.has(pathname)
  ) {
    const marketingBase = getPrimaryPublicUrl();
    const target = new URL(pathname === "/" ? "/" : pathname, marketingBase);
    target.search = request.nextUrl.search;
    return target.toString();
  }

  return null;
}
