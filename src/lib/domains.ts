/** Commercial domain configuration — configure DNS in GoDaddy; host on Azure Container Apps (see docs/azure-hosting-migration.md) */

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
  const configured = process.env.NEXT_PUBLIC_MARKETING_URL?.trim();
  return configured || `https://${COMMERCIAL_DOMAIN}`;
}

export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured || `https://${APP_SUBDOMAIN}`;
}

export function getCanonicalOrigin(host: string): string {
  if (isMarketingHost(host)) return getPrimaryPublicUrl();
  if (isAppHost(host)) return getAppUrl();
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
