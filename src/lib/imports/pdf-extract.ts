import type { ProvenanceCategory } from "@/lib/connectors/types";

export type PdfDocumentType =
  | "profit_and_loss"
  | "balance_sheet"
  | "cash_flow"
  | "budget"
  | "ar_aging"
  | "ap_aging"
  | "financial_summary"
  | "unknown";

export interface PdfExtractedField {
  key: string;
  label: string;
  value: number | null;
  confidence: "high" | "medium" | "low";
  rawText?: string;
}

export interface PdfExtractionResult {
  documentType: PdfDocumentType;
  documentTypeLabel: string;
  periodStart?: string;
  periodEnd?: string;
  fields: PdfExtractedField[];
  rawTextPreview: string;
  provenanceCategory: ProvenanceCategory;
}

const FIELD_PATTERNS: Array<{ key: string; label: string; patterns: RegExp[] }> = [
  { key: "revenue", label: "Revenue", patterns: [/total\s+revenue/i, /net\s+sales/i, /total\s+income/i] },
  { key: "cogs", label: "COGS", patterns: [/cost\s+of\s+goods/i, /cost\s+of\s+sales/i] },
  { key: "grossProfit", label: "Gross Profit", patterns: [/gross\s+profit/i] },
  { key: "payroll", label: "Payroll", patterns: [/payroll/i, /wages/i, /salaries/i] },
  { key: "operatingExpenses", label: "Operating Expenses", patterns: [/operating\s+expenses/i, /total\s+expenses/i] },
  { key: "netIncome", label: "Net Income", patterns: [/net\s+income/i, /net\s+profit/i] },
  { key: "currentCash", label: "Cash", patterns: [/cash\s+and\s+cash\s+equivalents/i, /total\s+cash/i] },
  { key: "accountsReceivable", label: "Accounts Receivable", patterns: [/accounts\s+receivable/i, /\bA\/R\b/i] },
  { key: "accountsPayable", label: "Accounts Payable", patterns: [/accounts\s+payable/i, /\bA\/P\b/i] },
];

const DOC_TYPE_PATTERNS: Array<{ type: PdfDocumentType; label: string; pattern: RegExp }> = [
  { type: "profit_and_loss", label: "Profit & Loss", pattern: /profit\s+(and|&)\s+loss|income\s+statement/i },
  { type: "balance_sheet", label: "Balance Sheet", pattern: /balance\s+sheet/i },
  { type: "cash_flow", label: "Cash Flow Statement", pattern: /cash\s+flow/i },
  { type: "ar_aging", label: "AR Aging", pattern: /accounts\s+receivable\s+aging|A\/R\s+aging/i },
  { type: "ap_aging", label: "AP Aging", pattern: /accounts\s+payable\s+aging|A\/P\s+aging/i },
  { type: "budget", label: "Budget", pattern: /\bbudget\b/i },
];

function parseMoneyFromLine(line: string): number | null {
  const match = line.match(/\$?\s*([\d,]+(?:\.\d{2})?)\s*$/);
  if (!match) return null;
  const num = Number(match[1]!.replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function detectDocumentType(text: string): { type: PdfDocumentType; label: string } {
  for (const { type, label, pattern } of DOC_TYPE_PATTERNS) {
    if (pattern.test(text)) return { type, label };
  }
  return { type: "financial_summary", label: "Financial Summary" };
}

function detectPeriod(text: string): { start?: string; end?: string } {
  const range = text.match(
    /(?:for\s+the\s+)?(?:period\s+)?(?:ending\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i
  );
  if (range) return { end: range[1] };
  const monthYear = text.match(/([A-Za-z]+\s+\d{4})/);
  if (monthYear) return { end: monthYear[1] };
  return {};
}

/**
 * Deterministic PDF text extraction for financial reports.
 * Uses pattern matching — AI-assisted extraction can augment in production with ANTHROPIC_API_KEY.
 * Output is ALWAYS AI_EXTRACTED_PENDING_CONFIRMATION until user confirms.
 */
export async function extractFinancialPdfText(
  textContent: string,
  fileName: string
): Promise<PdfExtractionResult> {
  const lines = textContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join("\n");
  const { type, label } = detectDocumentType(fullText);
  const period = detectPeriod(fullText);

  const fields: PdfExtractedField[] = [];

  for (const { key, label: fieldLabel, patterns } of FIELD_PATTERNS) {
    let found: PdfExtractedField | null = null;
    for (const line of lines) {
      if (!patterns.some((p) => p.test(line))) continue;
      const value = parseMoneyFromLine(line);
      if (value !== null) {
        found = {
          key,
          label: fieldLabel,
          value,
          confidence: "medium",
          rawText: line.slice(0, 120),
        };
        break;
      }
    }
    fields.push(
      found ?? { key, label: fieldLabel, value: null, confidence: "low" }
    );
  }

  return {
    documentType: type,
    documentTypeLabel: label,
    periodStart: period.start,
    periodEnd: period.end,
    fields,
    rawTextPreview: fullText.slice(0, 500),
    provenanceCategory: "AI_EXTRACTED_PENDING_CONFIRMATION",
  };
}

/** Parse raw PDF buffer — extracts text layer only (no OCR). For scanned PDFs, returns minimal text. */
export async function extractFromPdfBuffer(
  buffer: Buffer,
  fileName: string
): Promise<PdfExtractionResult> {
  const text = buffer
    .toString("latin1")
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s+/g, " ");

  if (text.length < 50) {
    return {
      documentType: "unknown",
      documentTypeLabel: "Unknown Document",
      fields: FIELD_PATTERNS.map(({ key, label }) => ({
        key,
        label,
        value: null,
        confidence: "low" as const,
      })),
      rawTextPreview: "Unable to extract text from PDF. The file may be scanned/image-based.",
      provenanceCategory: "AI_EXTRACTED_PENDING_CONFIRMATION",
    };
  }

  return extractFinancialPdfText(text, fileName);
}

export interface PdfConfirmationPayload {
  documentType: PdfDocumentType;
  periodStart?: string;
  periodEnd?: string;
  confirmedFields: Record<string, number | null>;
  ignoredFields: string[];
}
