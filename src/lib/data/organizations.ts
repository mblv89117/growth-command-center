import { ORGANIZATIONS } from "@/lib/mock-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Organization, OrganizationSettings } from "@/lib/types";

/**
 * Defaults are fail-closed. Do not invent cashAlertThreshold = 150000.
 * An owner-set finite threshold > 0 remains SOURCE-DERIVED.
 */
export const DEFAULT_SETTINGS: OrganizationSettings = {
  cashAlertThreshold: 0,
  forecastHorizonWeeks: 13,
  fiscalYearStart: 1,
  currency: "USD",
};

export function resolveCashAlertThreshold(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isPlan(value: unknown): value is Organization["plan"] {
  return value === "starter" || value === "growth" || value === "enterprise";
}

export function mapOrganizationRow(row: Record<string, unknown>): Organization {
  const settings = (row.settings as Record<string, unknown> | null) ?? {};
  return {
    id: String(row.id),
    name: String(row.name ?? "Organization"),
    slug: String(row.slug ?? row.id),
    industry: String(row.industry ?? ""),
    plan: isPlan(row.plan) ? row.plan : "starter",
    createdAt: String(row.created_at ?? new Date().toISOString()).slice(0, 10),
    settings: {
      cashAlertThreshold: resolveCashAlertThreshold(settings.cashAlertThreshold),
      forecastHorizonWeeks: Number(settings.forecastHorizonWeeks ?? DEFAULT_SETTINGS.forecastHorizonWeeks),
      fiscalYearStart: Number(settings.fiscalYearStart ?? DEFAULT_SETTINGS.fiscalYearStart),
      currency: String(settings.currency ?? DEFAULT_SETTINGS.currency),
    },
  };
}

export async function getOrganizationById(organizationId: string): Promise<Organization> {
  const fallback =
    ORGANIZATIONS.find((org) => org.id === organizationId) ?? {
      id: organizationId,
      name: organizationId,
      slug: organizationId,
      industry: "",
      plan: "starter",
      createdAt: new Date().toISOString().slice(0, 10),
      settings: { ...DEFAULT_SETTINGS },
    };

  const admin = createAdminClient();
  if (!admin) return fallback;

  const { data, error } = await admin
    .from("gcc_organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) return fallback;
  return mapOrganizationRow(data as Record<string, unknown>);
}
