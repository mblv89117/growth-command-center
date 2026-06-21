"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/tenant/context";
import { Sparkles } from "lucide-react";

export function OnboardingCta() {
  const { organization } = useTenant();
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetch(`/api/onboarding?organizationId=${organization.id}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ onboardingComplete?: boolean }>;
      })
      .then((data) => {
        if (data && data.onboardingComplete === false) setShow(true);
      })
      .catch(() => {
        // Non-blocking CTA — ignore fetch errors
      });
  }, [organization.id]);

  if (!show) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <p className="font-medium">Finish your AI onboarding</p>
          <p className="text-sm text-muted-foreground">
            Set company profile, priorities, software stack, and KPI targets in a guided chat.
          </p>
        </div>
      </div>
      <Button asChild variant="outline" className="shrink-0">
        <Link href="/onboarding">Start onboarding</Link>
      </Button>
    </div>
  );
}
