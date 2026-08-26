import { GtmHomepage } from "@/components/marketing/gtm-homepage";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPrimaryPublicUrl, isAppHost } from "@/lib/domains";
import { attributionFromSearchParams } from "@/lib/gtm/attribution";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Growth Command Center — See your business clearly",
  description:
    "Connect the systems you already use or upload the financial reports you already have. Forecasts, KPIs, AI CFO guidance, and value-creation intelligence for founder-led businesses.",
  openGraph: {
    title: "Growth Command Center",
    description: "Financial + operating intelligence for founders. $149/month standalone or included with HVCG.",
    url: getPrimaryPublicUrl(),
    siteName: "Growth Command Center",
    type: "website",
  },
  alternates: {
    canonical: getPrimaryPublicUrl(),
  },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const host = (await headers()).get("host") ?? "";

  if (isAppHost(host)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

    redirect(user ? "/dashboard" : "/login");
  }

  const params = await searchParams;
  const attribution = attributionFromSearchParams(params);

  return <GtmHomepage attribution={attribution} />;
}
