"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  resolveImportSuccessHandoff,
  type FounderDataProvenance,
} from "@/lib/journey/founder";
import { ArrowRight, Compass } from "lucide-react";

interface ImportSuccessHandoffCardProps {
  organizationId: string;
  dataProvenance?: FounderDataProvenance | null;
}

export function ImportSuccessHandoffCard({
  organizationId,
  dataProvenance,
}: ImportSuccessHandoffCardProps) {
  const handoff = resolveImportSuccessHandoff({
    organizationId,
    onboardingComplete: true,
    dataProvenance,
  });

  if (handoff.status !== "import_success") {
    return null;
  }

  return (
    <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
      <div className="mb-3 flex items-start gap-3">
        <Compass className="mt-0.5 h-5 w-5 text-green-700 dark:text-green-400" />
        <div>
          <p className="font-medium">Import landed — review forecast, dashboard, and value-creation</p>
          <p className="text-sm text-muted-foreground">
            SOURCE-DERIVED rows are committed. Next: understand forecast, the executive dashboard,
            and value-creation opportunities from those numbers. This card does not invent cash,
            forecast, or KPI values.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {handoff.destinations.map((destination) => (
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
