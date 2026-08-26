/** Commercial domain configuration — do not guess DNS; configure in Vercel dashboard */

export const COMMERCIAL_DOMAIN = "growthcommandcenter.com";
export const COMMERCIAL_WWW = `www.${COMMERCIAL_DOMAIN}`;
export const APP_SUBDOMAIN = `app.${COMMERCIAL_DOMAIN}`;

export const MARKETING_HOSTS = new Set([
  COMMERCIAL_DOMAIN,
  COMMERCIAL_WWW,
]);

export const APP_HOSTS = new Set([
  APP_SUBDOMAIN,
  // Legacy production URL remains valid during transition
  "growth-command-center-lbnt.vercel.app",
]);

export const ALL_GCC_HOSTS = new Set([...MARKETING_HOSTS, ...APP_HOSTS]);

export function isMarketingHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/:\d+$/, "");
  return MARKETING_HOSTS.has(normalized);
}

export function isAppHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/:\d+$/, "");
  return APP_HOSTS.has(normalized) || normalized.includes("vercel.app");
}

export function getPrimaryPublicUrl(): string {
  return process.env.NEXT_PUBLIC_MARKETING_URL ?? `https://${COMMERCIAL_WWW}`;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? `https://${APP_SUBDOMAIN}`;
}

export function getCanonicalOrigin(host: string): string {
  if (isMarketingHost(host)) return getPrimaryPublicUrl();
  if (isAppHost(host)) return getAppUrl();
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
