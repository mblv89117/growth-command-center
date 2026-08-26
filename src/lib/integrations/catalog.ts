import type { IntegrationStatus } from "@/lib/types";

export type IntegrationAvailability =
  | "live"
  | "partial"
  | "coming_soon"
  | "not_implemented";

export interface IntegrationCatalogEntry {
  id: string;
  availability: IntegrationAvailability;
  /** Customer-facing label for availability */
  availabilityLabel: string;
}

const CATALOG: Record<string, IntegrationCatalogEntry> = {
  "int-1": { id: "int-1", availability: "coming_soon", availabilityLabel: "Coming Soon" },
  "int-2": { id: "int-2", availability: "coming_soon", availabilityLabel: "Coming Soon" },
  "int-3": { id: "int-3", availability: "coming_soon", availabilityLabel: "Coming Soon" },
  "int-4": { id: "int-4", availability: "coming_soon", availabilityLabel: "Coming Soon" },
  "int-5": { id: "int-5", availability: "coming_soon", availabilityLabel: "Coming Soon" },
  "int-6": { id: "int-6", availability: "coming_soon", availabilityLabel: "Coming Soon" },
  "int-7": { id: "int-7", availability: "coming_soon", availabilityLabel: "Coming Soon" },
  "int-8": { id: "int-8", availability: "coming_soon", availabilityLabel: "Coming Soon" },
  "int-9": { id: "int-9", availability: "coming_soon", availabilityLabel: "Coming Soon" },
  "int-10": { id: "int-10", availability: "coming_soon", availabilityLabel: "Coming Soon" },
};

/** File import is the only production-certified ingestion path today. */
export const FILE_IMPORT_CAPABILITY = {
  availability: "live" as const,
  availabilityLabel: "Live",
  formats: ["CSV", "XLSX"],
};

export function getIntegrationCatalogEntry(id: string): IntegrationCatalogEntry {
  return CATALOG[id] ?? { id, availability: "not_implemented", availabilityLabel: "Not Available" };
}

/**
 * Production-safe integration row: never show mock "connected" states to real customers.
 */
export function normalizeIntegrationForProduction<
  T extends { id: string; status: IntegrationStatus; isLive?: boolean }
>(integration: T, connectConfigured: boolean): T & IntegrationCatalogEntry {
  const catalog = getIntegrationCatalogEntry(integration.id);
  const isNativeCandidate = integration.id === "int-1" || integration.id === "int-4";

  if (catalog.availability === "coming_soon" || !isNativeCandidate) {
    return {
      ...integration,
      ...catalog,
      status: "disconnected",
      isLive: false,
      lastSync: undefined,
      errorMessage: undefined,
    };
  }

  return {
    ...integration,
    ...catalog,
    availability: connectConfigured ? "partial" : "coming_soon",
    availabilityLabel: connectConfigured ? "Partial" : "Coming Soon",
    isLive: false,
    status: "disconnected",
  };
}
