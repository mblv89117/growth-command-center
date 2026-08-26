export type ImportTemplateType = "financial_snapshot" | "monthly_trends" | "transactions";

export interface ImportColumnMapping {
  sourceColumn: string;
  targetField: string;
}

export interface ImportPreviewRow {
  rowNum: number;
  data: Record<string, string | number>;
  valid: boolean;
  errors: string[];
}

export interface ImportPreviewResult {
  templateType: ImportTemplateType;
  fileName: string;
  headers: string[];
  mapping: ImportColumnMapping[];
  rows: ImportPreviewRow[];
  validCount: number;
  errorCount: number;
}

export const IMPORT_TEMPLATES: Record<
  ImportTemplateType,
  { label: string; description: string; requiredFields: string[]; optionalFields: string[] }
> = {
  financial_snapshot: {
    label: "Financial Snapshot",
    description: "Current cash, revenue, profit, AR/AP in a single row",
    requiredFields: ["current_cash"],
    optionalFields: [
      "revenue_mtd",
      "revenue_ytd",
      "gross_profit",
      "net_profit",
      "operating_expenses",
      "accounts_receivable",
      "accounts_payable",
      "payroll_obligations",
      "ebitda",
      "burn_rate",
      "forecasted_cash",
      "runway",
      "debt_obligations",
    ],
  },
  monthly_trends: {
    label: "Monthly Trends",
    description: "Month-by-month revenue, expenses, profit, and cash",
    requiredFields: ["month", "revenue"],
    optionalFields: ["expenses", "profit", "cash"],
  },
  transactions: {
    label: "Transactions",
    description: "Individual income and expense transactions",
    requiredFields: ["date", "description", "amount"],
    optionalFields: ["category", "type"],
  },
};
