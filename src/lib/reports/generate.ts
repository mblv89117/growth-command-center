import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { KPI, TenantData } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { REPORT_META, type ReportType } from "./config";

function formatKpiValue(kpi: KPI): string {
  if (kpi.unit === "currency") return formatCurrency(kpi.value, true);
  if (kpi.unit === "percent") return `${kpi.value}%`;
  if (kpi.unit === "days") return `${kpi.value} days`;
  return String(kpi.value);
}

function formatKpiTarget(kpi: KPI): string {
  if (kpi.target == null) return "";
  if (kpi.unit === "currency") return formatCurrency(kpi.target, true);
  if (kpi.unit === "percent") return `${kpi.target}%`;
  return String(kpi.target);
}

function addReportHeader(sheet: ExcelJS.Worksheet, reportType: ReportType, organizationName: string) {
  const meta = REPORT_META[reportType];
  sheet.addRow(["Growth Command Center", meta.title]);
  sheet.addRow(["Report Type", meta.contentMarker]);
  sheet.addRow(["Organization", organizationName]);
  sheet.addRow(["Generated", new Date().toISOString()]);
  sheet.addRow([]);
}

function addFinancialSummaryRows(sheet: ExcelJS.Worksheet, data: TenantData) {
  const fs = data.financialSnapshot;
  sheet.addRow(["Metric", "Value"]);
  sheet.addRow(["Current Cash", fs.currentCash]);
  sheet.addRow(["Forecasted Cash", fs.forecastedCash]);
  sheet.addRow(["Revenue MTD", fs.revenueMTD]);
  sheet.addRow(["Revenue YTD", fs.revenueYTD]);
  sheet.addRow(["Gross Profit", fs.grossProfit]);
  sheet.addRow(["Net Profit", fs.netProfit]);
  sheet.addRow(["Operating Expenses", fs.operatingExpenses]);
  sheet.addRow(["EBITDA", fs.ebitda]);
  sheet.addRow(["Runway (months)", fs.runway]);
}

function writePdfHeader(doc: InstanceType<typeof PDFDocument>, reportType: ReportType, organizationName: string) {
  const meta = REPORT_META[reportType];
  doc.fontSize(20).text("Growth Command Center", { align: "center" });
  doc.fontSize(14).text(meta.title.toUpperCase(), { align: "center" });
  doc.fontSize(10).text(meta.contentMarker, { align: "center" });
  doc.moveDown();
  doc.fontSize(10).text(`Organization: ${organizationName}`);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`);
  doc.moveDown();
}

function writeFinancialSummaryPdf(doc: InstanceType<typeof PDFDocument>, data: TenantData) {
  const fs = data.financialSnapshot;
  doc.fontSize(12).text("Financial Summary", { underline: true });
  doc.fontSize(10);
  doc.text(`Current Cash: ${formatCurrency(fs.currentCash)}`);
  doc.text(`Forecasted Cash: ${formatCurrency(fs.forecastedCash)}`);
  doc.text(`Revenue MTD: ${formatCurrency(fs.revenueMTD)}`);
  doc.text(`Revenue YTD: ${formatCurrency(fs.revenueYTD)}`);
  doc.text(`Gross Profit: ${formatCurrency(fs.grossProfit)}`);
  doc.text(`Net Profit: ${formatCurrency(fs.netProfit)}`);
  doc.text(`Operating Expenses: ${formatCurrency(fs.operatingExpenses)}`);
  doc.text(`EBITDA: ${formatCurrency(fs.ebitda)}`);
  doc.text(`Runway: ${fs.runway} months`);
}

function writeKpiScorecardPdf(doc: InstanceType<typeof PDFDocument>, data: TenantData) {
  doc.fontSize(12).text("KPI Scorecard", { underline: true });
  doc.fontSize(10);
  data.kpis.forEach((kpi) => {
    doc.text(`${kpi.name}: ${formatKpiValue(kpi)}`);
    if (kpi.target != null) doc.text(`  Target: ${formatKpiTarget(kpi)}`);
    if (kpi.status) doc.text(`  Status: ${kpi.status}`);
    if (kpi.plan) doc.text(`  Plan: ${kpi.plan}`);
    doc.moveDown(0.5);
  });
}

function writeKpiScorecardExcel(sheet: ExcelJS.Worksheet, data: TenantData) {
  sheet.addRow(["KPI", "Value", "Target", "Status", "Plan", "Change"]);
  data.kpis.forEach((kpi) =>
    sheet.addRow([
      kpi.name,
      kpi.value,
      kpi.target ?? "",
      kpi.status ?? "",
      kpi.plan ?? "",
      kpi.change,
    ])
  );
}

export async function generateExcelReport(data: TenantData, reportType: ReportType): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(REPORT_META[reportType].title.slice(0, 31));
  addReportHeader(sheet, reportType, data.organization.name);

  switch (reportType) {
    case "executive":
      addFinancialSummaryRows(sheet, data);
      sheet.addRow([]);
      writeKpiScorecardExcel(sheet, data);
      break;
    case "financial-summary":
    case "profit-loss":
    case "balance-sheet":
      addFinancialSummaryRows(sheet, data);
      break;
    case "kpi":
      writeKpiScorecardExcel(sheet, data);
      break;
    case "cash-forecast":
    case "forecast-vs-actual":
      sheet.addRow(["Week", "Starting", "Inflows", "Outflows", "Ending", "Risk Period"]);
      data.cashForecastWeeks.forEach((w) =>
        sheet.addRow([
          w.week,
          w.startingBalance,
          w.inflows,
          w.outflows,
          w.endingBalance,
          w.isRiskPeriod ? "Yes" : "No",
        ])
      );
      break;
    case "budget-vs-actual":
      sheet.addRow(["Category", "Budget", "Actual", "Variance", "Variance %"]);
      data.budgetVsActual.forEach((row) =>
        sheet.addRow([row.category, row.budget, row.actual, row.variance, row.variancePercent])
      );
      break;
    case "ar-aging":
      sheet.addRow(["Bucket", "Amount"]);
      data.arAging.forEach((row) => sheet.addRow([row.bucket, row.amount]));
      break;
    case "ap-aging":
      sheet.addRow(["Bucket", "Amount"]);
      data.apAging.forEach((row) => sheet.addRow([row.bucket, row.amount]));
      break;
    case "pipeline":
      sheet.addRow(["Deal", "Customer", "Stage", "Value", "Probability", "Weighted"]);
      data.opportunities.forEach((o) =>
        sheet.addRow([o.name, o.customer, o.stage, o.value, o.probability, o.weightedValue])
      );
      break;
    case "jobs":
      sheet.addRow(["Job", "Customer", "Status", "Contract", "Margin %", "Complete %"]);
      data.jobs.forEach((j) =>
        sheet.addRow([j.name, j.customer, j.status, j.contractValue, j.actualGrossMargin, j.completionPercent])
      );
      break;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function generatePdfReport(data: TenantData, reportType: ReportType): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    writePdfHeader(doc, reportType, data.organization.name);

    switch (reportType) {
      case "executive":
        writeFinancialSummaryPdf(doc, data);
        doc.moveDown();
        writeKpiScorecardPdf(doc, data);
        break;
      case "financial-summary":
      case "profit-loss":
      case "balance-sheet":
        writeFinancialSummaryPdf(doc, data);
        break;
      case "kpi":
        writeKpiScorecardPdf(doc, data);
        break;
      case "cash-forecast":
      case "forecast-vs-actual":
        doc.fontSize(12).text("13-Week Cash Forecast", { underline: true });
        doc.fontSize(9);
        data.cashForecastWeeks.forEach((w) => {
          doc.text(
            `Wk ${w.week}: ${formatCurrency(w.startingBalance)} → ${formatCurrency(w.endingBalance)} (${w.isRiskPeriod ? "RISK" : "OK"})`
          );
        });
        break;
      case "budget-vs-actual":
        doc.fontSize(12).text("Budget vs Actual", { underline: true });
        doc.fontSize(10);
        data.budgetVsActual.forEach((row) => {
          doc.text(
            `${row.category}: ${formatCurrency(row.actual)} actual vs ${formatCurrency(row.budget)} budget (${row.variancePercent.toFixed(1)}%)`
          );
        });
        break;
      case "ar-aging":
        doc.fontSize(12).text("AR Aging", { underline: true });
        doc.fontSize(10);
        data.arAging.forEach((row) => doc.text(`${row.bucket}: ${formatCurrency(row.amount)}`));
        break;
      case "ap-aging":
        doc.fontSize(12).text("AP Aging", { underline: true });
        doc.fontSize(10);
        data.apAging.forEach((row) => doc.text(`${row.bucket}: ${formatCurrency(row.amount)}`));
        break;
      case "pipeline":
        doc.fontSize(12).text("Sales Pipeline", { underline: true });
        doc.fontSize(10);
        data.opportunities.forEach((o) => {
          doc.text(`${o.name} (${o.customer}): ${formatCurrency(o.value)} @ ${o.probability}%`);
        });
        break;
      case "jobs":
        doc.fontSize(12).text("Job Profitability", { underline: true });
        doc.fontSize(10);
        data.jobs.forEach((j) => {
          doc.text(`${j.name}: ${j.actualGrossMargin}% margin, ${j.completionPercent}% complete`);
        });
        break;
    }

    doc.end();
  });
}
