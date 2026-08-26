import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAppUrl, isMarketingHost } from "@/lib/domains";
import { attributionFromSearchParams } from "@/lib/gtm/attribution";

export async function redirectMarketingAuthToApp(
  pathname: string,
  searchParams?: Record<string, string | string[] | undefined>
): Promise<void> {
  const host = (await headers()).get("host") ?? "";
  if (!isMarketingHost(host)) return;

  const target = new URL(pathname, getAppUrl());
  const attribution = attributionFromSearchParams(searchParams ?? {});

  for (const [key, value] of Object.entries(attribution)) {
    if (value) target.searchParams.set(key, value);
  }

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string" && !target.searchParams.has(key)) {
        target.searchParams.set(key, value);
      }
    }
  }

  redirect(target.toString());
}
