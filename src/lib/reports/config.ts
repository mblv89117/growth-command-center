export const REPORT_TYPES = [
  "executive",
  "cash-forecast",
  "kpi",
  "financial-summary",
  "profit-loss",
  "balance-sheet",
  "ar-aging",
  "ap-aging",
  "budget-vs-actual",
  "forecast-vs-actual",
  "pipeline",
  "jobs",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const EXPORT_FORMATS = ["pdf", "excel"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ReportMeta {
  title: string;
  filenameSlug: string;
  contentMarker: string;
}

export const REPORT_META: Record<ReportType, ReportMeta> = {
  executive: {
    title: "Executive Summary",
    filenameSlug: "executive-summary",
    contentMarker: "EXECUTIVE SUMMARY",
  },
  "cash-forecast": {
    title: "Cash Forecast Report",
    filenameSlug: "cash-forecast",
    contentMarker: "13-WEEK CASH FORECAST",
  },
  kpi: {
    title: "KPI Scorecard",
    filenameSlug: "kpi-scorecard",
    contentMarker: "KPI SCORECARD",
  },
  "financial-summary": {
    title: "Financial Summary",
    filenameSlug: "financial-summary",
    contentMarker: "FINANCIAL SUMMARY",
  },
  "profit-loss": {
    title: "Profit & Loss Summary",
    filenameSlug: "profit-loss-summary",
    contentMarker: "PROFIT & LOSS SUMMARY",
  },
  "balance-sheet": {
    title: "Balance Sheet Summary",
    filenameSlug: "balance-sheet-summary",
    contentMarker: "BALANCE SHEET SUMMARY",
  },
  "ar-aging": {
    title: "AR Aging Report",
    filenameSlug: "ar-aging",
    contentMarker: "AR AGING REPORT",
  },
  "ap-aging": {
    title: "AP Aging Report",
    filenameSlug: "ap-aging",
    contentMarker: "AP AGING REPORT",
  },
  "budget-vs-actual": {
    title: "Budget vs Actual",
    filenameSlug: "budget-vs-actual",
    contentMarker: "BUDGET VS ACTUAL",
  },
  "forecast-vs-actual": {
    title: "Forecast vs Actual",
    filenameSlug: "forecast-vs-actual",
    contentMarker: "FORECAST VS ACTUAL",
  },
  pipeline: {
    title: "Sales Pipeline Forecast",
    filenameSlug: "sales-pipeline",
    contentMarker: "SALES PIPELINE FORECAST",
  },
  jobs: {
    title: "Job Profitability Report",
    filenameSlug: "job-profitability",
    contentMarker: "JOB PROFITABILITY REPORT",
  },
};

/** Map UI report card ids to export report types. */
export const REPORT_ID_TO_TYPE: Record<string, ReportType> = {
  "rpt-1": "executive",
  "rpt-2": "cash-forecast",
  "rpt-3": "profit-loss",
  "rpt-4": "balance-sheet",
  "rpt-5": "ar-aging",
  "rpt-6": "ap-aging",
  "rpt-7": "pipeline",
  "rpt-8": "jobs",
  "rpt-9": "budget-vs-actual",
  "rpt-10": "forecast-vs-actual",
  "rpt-11": "kpi",
};

export function parseReportType(value: string | null): ReportType | null {
  if (!value) return null;
  return REPORT_TYPES.includes(value as ReportType) ? (value as ReportType) : null;
}

export function parseExportFormat(value: string | null): ExportFormat | null {
  if (!value) return null;
  return EXPORT_FORMATS.includes(value as ExportFormat) ? (value as ExportFormat) : null;
}

export function getReportTypeForId(reportId: string): ReportType | null {
  return REPORT_ID_TO_TYPE[reportId] ?? null;
}

export function buildExportFilename(reportType: ReportType, organizationId: string, format: ExportFormat): string {
  const slug = REPORT_META[reportType].filenameSlug;
  const ext = format === "excel" ? "xlsx" : "pdf";
  return `gcc-${slug}-${organizationId}.${ext}`;
}
