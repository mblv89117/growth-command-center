import type { KPI } from "@/lib/types";

export interface KpiNumericLimits {
  min: number;
  max: number;
  allowDecimals: boolean;
}

const FINANCIAL_MAX = 100_000_000;

export function getKpiNumericLimits(unit: KPI["unit"]): KpiNumericLimits {
  switch (unit) {
    case "currency":
      return { min: -FINANCIAL_MAX, max: FINANCIAL_MAX, allowDecimals: true };
    case "percent":
      return { min: -1000, max: 1000, allowDecimals: true };
    case "days":
      return { min: 0, max: 10_000, allowDecimals: true };
    case "number":
    default:
      return { min: 0, max: FINANCIAL_MAX, allowDecimals: true };
  }
}

export function validateKpiNumericValue(
  unit: KPI["unit"],
  value: number,
  fieldLabel: "Value" | "Target"
): string | null {
  const limits = getKpiNumericLimits(unit);

  if (!limits.allowDecimals && !Number.isInteger(value)) {
    return `${fieldLabel} must be a whole number for this KPI.`;
  }

  if (value < limits.min || value > limits.max) {
    const maxLabel = limits.max.toLocaleString("en-US");
    return `${fieldLabel} must be between ${limits.min.toLocaleString("en-US")} and ${maxLabel} for ${unit} KPIs.`;
  }

  return null;
}
