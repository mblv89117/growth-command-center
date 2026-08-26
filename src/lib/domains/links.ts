import { getAppUrl } from "@/lib/domains";
import {
  attributionToQueryString,
  type GtmAttribution,
} from "@/lib/gtm/attribution";

export function appLoginUrl(): string {
  return `${getAppUrl()}/login`;
}

export function appSignupUrl(attribution?: GtmAttribution): string {
  const base = `${getAppUrl()}/signup`;
  if (!attribution) return base;
  const query = attributionToQueryString(attribution);
  return query ? `${base}?${query}` : base;
}

export function appPath(path: string): string {
  return `${getAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
