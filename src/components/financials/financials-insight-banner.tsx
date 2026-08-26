"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/tenant/context";
import {
  resolveFinancialsInsightBanner,
  type FounderDataProvenance,
} from "@/lib/journey/founder";
import { ArrowRight, Compass } from "lucide-react";

export function FinancialsInsightBanner() {
  const { organization } = useTenant();
  const [dataProvenance, setDataProvenance] = useState<FounderDataProvenance | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch(`/api/dashboard?organizationId=${organization.id}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ dataProvenance?: FounderDataProvenance }>;
      })
      .then((json) => {
        setDataProvenance(json?.dataProvenance ?? null);
        setReady(true);
      })
      .catch(() => {
        setDataProvenance(null);
        setReady(true);
      });
  }, [organization.id]);

  if (!ready) {
    return null;
  }

  const banner = resolveFinancialsInsightBanner({
    organizationId: organization.id,
    onboardingComplete: true,
    dataProvenance,
  });

  if (banner.status !== "import_success") {
    return null;
  }

  return (
    <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
      <div className="mb-3 flex items-start gap-3">
        <Compass className="mt-0.5 h-5 w-5 text-green-700 dark:text-green-400" />
        <div>
          <p className="font-medium">Import landed — continue from financials</p>
          <p className="text-sm text-muted-foreground">
            Figures on this page must stay grounded in imported SOURCE-DERIVED numbers. Next:
            review the 13-week forecast, executive dashboard, and value-creation opportunities
            from those same numbers. This banner does not invent cash, forecast, or KPI values.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {banner.destinations.map((destination) => (
          <Button key={destination.href} asChild variant="outline" className="shrink-0">
            <Link href={destination.href}>
              {destination.label} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
