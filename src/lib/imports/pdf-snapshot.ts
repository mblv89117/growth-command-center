/**
 * Pure helpers for PDF confirm → financial snapshot field mapping.
 */

export const PDF_CONFIRM_FIELD_MAP: Record<string, string> = {
  revenue: "revenue_mtd",
  grossProfit: "gross_profit",
  netIncome: "net_profit",
  operatingExpenses: "operating_expenses",
  currentCash: "current_cash",
  accountsReceivable: "accounts_receivable",
  accountsPayable: "accounts_payable",
  payroll: "payroll_obligations",
};

export interface PdfConfirmationFields {
  confirmedFields: Record<string, number | null>;
  ignoredFields: string[];
}

/** Build DB snapshot patch from confirmed PDF fields (skips null / ignored). */
export function buildPdfSnapshotPatch(
  confirmation: PdfConfirmationFields
): Record<string, number> {
  const patch: Record<string, number> = {};

  for (const [key, value] of Object.entries(confirmation.confirmedFields)) {
    if (value === null || confirmation.ignoredFields.includes(key)) continue;
    const dbKey = PDF_CONFIRM_FIELD_MAP[key];
    if (dbKey) patch[dbKey] = value;
  }

  return patch;
}
