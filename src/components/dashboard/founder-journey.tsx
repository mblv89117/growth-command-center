"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/tenant/context";
import {
  resolveFounderJourney,
  resolveImportSuccessHandoff,
  type FounderDataProvenance,
  type FounderJourneyState,
} from "@/lib/journey/founder";
import { ArrowRight, Compass } from "lucide-react";

interface FounderJourneyProps {
  dataProvenance?: FounderDataProvenance | null;
}

export function FounderJourney({ dataProvenance }: FounderJourneyProps) {
  const { organization } = useTenant();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`/api/onboarding?organizationId=${organization.id}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ onboardingComplete?: boolean }>;
      })
      .then((data) => {
        if (data && typeof data.onboardingComplete === "boolean") {
          setOnboardingComplete(data.onboardingComplete);
          return;
        }
        setOnboardingComplete(null);
      })
      .catch(() => {
        setOnboardingComplete(null);
      });
  }, [organization.id]);

  const journey: FounderJourneyState = resolveFounderJourney({
    organizationId: organization.id,
    onboardingComplete,
    dataProvenance,
  });
  const insightHandoff = resolveImportSuccessHandoff({
    organizationId: organization.id,
    onboardingComplete,
    dataProvenance,
  });
  const destinations =
    journey.status === "ready_for_insight" && insightHandoff.status === "import_success"
      ? insightHandoff.destinations
      : [journey.nextAction];

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Compass className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <p className="font-medium">{titleForStatus(journey.status)}</p>
          <p className="text-sm text-muted-foreground">{journey.nextAction.rationale}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {destinations.map((destination) => (
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

function titleForStatus(status: FounderJourneyState["status"]): string {
  switch (status) {
    case "needs_onboarding":
      return "Finish your workspace setup";
    case "needs_import":
      return "Import your numbers to unlock the CFO view";
    case "ready_for_insight":
      return "Your data is in — review what to do next";
    case "demo_seeded":
      return "Apex demo workspace";
    default:
      return "Next step";
  }
}
