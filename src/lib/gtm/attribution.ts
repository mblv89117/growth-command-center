import type { NextRequest } from "next/server";
import { COMMERCIAL_DOMAIN } from "@/lib/domains";

export const GTM_ATTRIBUTION_COOKIE = "gcc_gtm_attribution";

export const UTM_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UtmParamKey = (typeof UTM_PARAM_KEYS)[number];

export interface GtmAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
}

export function attributionFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): GtmAttribution {
  const attribution: GtmAttribution = {};

  for (const key of UTM_PARAM_KEYS) {
    const value =
      params instanceof URLSearchParams
        ? params.get(key)
        : (params[key] as string | undefined);
    if (value) attribution[key] = value;
  }

  return attribution;
}

export function mergeAttribution(
  ...sources: Array<GtmAttribution | null | undefined>
): GtmAttribution {
  return sources.reduce<GtmAttribution>((acc, source) => {
    if (!source) return acc;
    return { ...acc, ...Object.fromEntries(Object.entries(source).filter(([, v]) => Boolean(v))) };
  }, {});
}

export function parseAttributionCookie(raw: string | undefined): GtmAttribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GtmAttribution;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeAttribution(attribution: GtmAttribution): string {
  return JSON.stringify(attribution);
}

export function attributionToQueryString(attribution: GtmAttribution): string {
  const params = new URLSearchParams();
  for (const key of UTM_PARAM_KEYS) {
    const value = attribution[key];
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function appendAttributionToUrl(baseUrl: string, attribution: GtmAttribution): string {
  const query = attributionToQueryString(attribution);
  if (!query) return baseUrl;
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${query}`;
}

export function captureAttributionFromRequest(request: NextRequest): GtmAttribution {
  const fromQuery = attributionFromSearchParams(request.nextUrl.searchParams);
  const fromCookie = parseAttributionCookie(request.cookies.get(GTM_ATTRIBUTION_COOKIE)?.value);
  const referrer = request.headers.get("referer") ?? undefined;

  return mergeAttribution(fromCookie, fromQuery, {
    referrer: fromQuery.utm_source ? undefined : referrer,
    landing_page: request.nextUrl.pathname,
  });
}

export function attributionCookieOptions(): {
  name: string;
  domain?: string;
  maxAge: number;
  sameSite: "lax";
  secure: boolean;
  path: string;
} {
  const secure = process.env.NODE_ENV === "production";
  return {
    name: GTM_ATTRIBUTION_COOKIE,
    domain: secure ? `.${COMMERCIAL_DOMAIN}` : undefined,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    secure,
    path: "/",
  };
}

export function buildAppRedirectUrl(
  appBaseUrl: string,
  pathname: string,
  request: NextRequest,
  search = ""
): string {
  const attribution = captureAttributionFromRequest(request);
  const target = new URL(`${pathname}${search}`, appBaseUrl);

  for (const key of UTM_PARAM_KEYS) {
    const value = attribution[key];
    if (value) target.searchParams.set(key, value);
  }

  return target.toString();
}
