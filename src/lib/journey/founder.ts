export const APEX_DEMO_ORGANIZATION_ID = "org-apex";

export type FounderDataProvenance = "empty" | "imported" | "computed" | "seeded" | "mock";

export type FounderJourneyStatus =
  | "needs_onboarding"
  | "needs_import"
  | "ready_for_insight"
  | "demo_seeded";

export type FounderJourneyStep = "onboard" | "import" | "insight" | "demo";

export interface FounderJourneyInput {
  organizationId: string;
  onboardingComplete: boolean | null;
  dataProvenance?: FounderDataProvenance | null;
}

export interface FounderNextAction {
  href: string;
  label: string;
  rationale: string;
}

export interface FounderJourneyState {
  status: FounderJourneyStatus;
  currentStep: FounderJourneyStep;
  nextAction: FounderNextAction;
  completedSteps: Array<"onboard" | "import" | "insight">;
  inventedFinancialValues: false;
}

function isDemoSeeded(input: FounderJourneyInput): boolean {
  return input.organizationId === APEX_DEMO_ORGANIZATION_ID || input.dataProvenance === "seeded";
}

function hasImportedSource(provenance: FounderDataProvenance | null | undefined): boolean {
  return provenance === "imported" || provenance === "computed";
}

export function resolveFounderJourney(input: FounderJourneyInput): FounderJourneyState {
  if (isDemoSeeded(input)) {
    return {
      status: "demo_seeded",
      currentStep: "demo",
      nextAction: {
        href: "/cash-forecast",
        label: "Explore demo forecast",
        rationale:
          "This workspace is the labeled Apex demo. Seeded numbers are SOURCE-DERIVED demo fixtures, not a founder import.",
      },
      completedSteps: [],
      inventedFinancialValues: false,
    };
  }

  if (hasImportedSource(input.dataProvenance)) {
    return {
      status: "ready_for_insight",
      currentStep: "insight",
      nextAction: {
        href: "/cash-forecast",
        label: "Review 13-week forecast",
        rationale:
          "Imported SOURCE-DERIVED numbers are present. Next: understand forecast, KPIs, AI CFO, and value-creation from those numbers.",
      },
      completedSteps: ["onboard", "import"],
      inventedFinancialValues: false,
    };
  }

  if (input.onboardingComplete === true) {
    return {
      status: "needs_import",
      currentStep: "import",
      nextAction: {
        href: "/integrations/import",
        label: "Import financial data",
        rationale:
          "Onboarding is complete. Import CSV/XLSX SOURCE-DERIVED financials before cash, forecast, or KPIs can be shown as your data.",
      },
      completedSteps: ["onboard"],
      inventedFinancialValues: false,
    };
  }

  return {
    status: "needs_onboarding",
    currentStep: "onboard",
    nextAction: {
      href: "/onboarding",
      label: "Start onboarding",
      rationale:
        "Set company profile, priorities, software stack, and KPI targets. Empty-tenant zeros are not invented company results.",
    },
    completedSteps: [],
    inventedFinancialValues: false,
  };
}

export function founderJourneyDoesNotInventFinancials(state: FounderJourneyState): boolean {
  return state.inventedFinancialValues === false && !("currentCash" in state) && !("forecastedCash" in state);
}

export type ImportSuccessHandoffStatus = "import_success" | "not_ready" | "demo_seeded";

export interface InsightDestination {
  href: string;
  label: string;
  rationale: string;
}

export interface ImportSuccessHandoff {
  status: ImportSuccessHandoffStatus;
  destinations: InsightDestination[];
  inventedFinancialValues: false;
}

export function resolveImportSuccessHandoff(input: FounderJourneyInput): ImportSuccessHandoff {
  if (isDemoSeeded(input)) {
    return {
      status: "demo_seeded",
      destinations: [],
      inventedFinancialValues: false,
    };
  }

  if (!hasImportedSource(input.dataProvenance)) {
    return {
      status: "not_ready",
      destinations: [],
      inventedFinancialValues: false,
    };
  }

  return {
    status: "import_success",
    destinations: [
      {
        href: "/cash-forecast",
        label: "Review 13-week forecast",
        rationale: "Understand cash trajectory from imported SOURCE-DERIVED numbers.",
      },
      {
        href: "/dashboard",
        label: "Open executive dashboard",
        rationale: "See KPIs, risks, and next actions from the same imported numbers.",
      },
      {
        href: "/value-creation",
        label: "Review value-creation opportunities",
        rationale:
          "See owner-gated recommendations derived from imported SOURCE-DERIVED numbers. AI may explain; it must not invent values.",
      },
    ],
    inventedFinancialValues: false,
  };
}

export function importHandoffDoesNotInventFinancials(handoff: ImportSuccessHandoff): boolean {
  return (
    handoff.inventedFinancialValues === false &&
    !("currentCash" in handoff) &&
    !("forecastedCash" in handoff)
  );
}

export type ForecastInsightBannerStatus = ImportSuccessHandoffStatus;

export interface ForecastInsightBanner {
  status: ForecastInsightBannerStatus;
  destinations: InsightDestination[];
  inventedFinancialValues: false;
}

/**
 * Forecast-page import-success banner. Same honesty rules as the import handoff,
 * but omits /cash-forecast because the founder is already on that page.
 */
export function resolveForecastInsightBanner(input: FounderJourneyInput): ForecastInsightBanner {
  const handoff = resolveImportSuccessHandoff(input);
  if (handoff.status !== "import_success") {
    return {
      status: handoff.status,
      destinations: [],
      inventedFinancialValues: false,
    };
  }

  return {
    status: "import_success",
    destinations: handoff.destinations.filter((destination) => destination.href !== "/cash-forecast"),
    inventedFinancialValues: false,
  };
}

export function forecastBannerDoesNotInventFinancials(banner: ForecastInsightBanner): boolean {
  return (
    banner.inventedFinancialValues === false &&
    !("currentCash" in banner) &&
    !("forecastedCash" in banner)
  );
}
