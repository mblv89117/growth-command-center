import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { TenantData } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export async function generateExcelReport(data: TenantData, reportType: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  sheet.addRow(["Growth Command Center", reportType]);
  sheet.addRow(["Organization", data.organization.name]);
  sheet.addRow(["Generated", new Date().toISOString()]);
  sheet.addRow([]);

  if (reportType === "executive" || reportType === "kpi") {
    sheet.addRow(["Metric", "Value"]);
    sheet.addRow(["Current Cash", data.financialSnapshot.currentCash]);
    sheet.addRow(["Revenue MTD", data.financialSnapshot.revenueMTD]);
    sheet.addRow(["Revenue YTD", data.financialSnapshot.revenueYTD]);
    sheet.addRow(["Gross Profit", data.financialSnapshot.grossProfit]);
    sheet.addRow(["Net Profit", data.financialSnapshot.netProfit]);
    sheet.addRow(["Runway (months)", data.financialSnapshot.runway]);
    sheet.addRow([]);
    sheet.addRow(["KPI", "Value", "Change"]);
    data.kpis.forEach((k) => sheet.addRow([k.name, k.value, k.change]));
  }

  if (reportType === "cash-forecast") {
    sheet.addRow(["Week", "Starting", "Inflows", "Outflows", "Ending"]);
    data.cashForecastWeeks.forEach((w) =>
      sheet.addRow([w.week, w.startingBalance, w.inflows, w.outflows, w.endingBalance])
    );
  }

  if (reportType === "pipeline") {
    sheet.addRow(["Deal", "Customer", "Stage", "Value", "Probability", "Weighted"]);
    data.opportunities.forEach((o) =>
      sheet.addRow([o.name, o.customer, o.stage, o.value, o.probability, o.weightedValue])
    );
  }

  if (reportType === "jobs") {
    sheet.addRow(["Job", "Customer", "Status", "Contract", "Margin %", "Complete %"]);
    data.jobs.forEach((j) =>
      sheet.addRow([j.name, j.customer, j.status, j.contractValue, j.actualGrossMargin, j.completionPercent])
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function generatePdfReport(data: TenantData, reportType: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Growth Command Center", { align: "center" });
    doc.fontSize(14).text(reportType.replace(/-/g, " ").toUpperCase(), { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Organization: ${data.organization.name}`);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    const fs = data.financialSnapshot;
    doc.fontSize(12).text("Financial Summary", { underline: true });
    doc.fontSize(10);
    doc.text(`Current Cash: ${formatCurrency(fs.currentCash)}`);
    doc.text(`Revenue MTD: ${formatCurrency(fs.revenueMTD)}`);
    doc.text(`Revenue YTD: ${formatCurrency(fs.revenueYTD)}`);
    doc.text(`Gross Profit: ${formatCurrency(fs.grossProfit)}`);
    doc.text(`Net Profit: ${formatCurrency(fs.netProfit)}`);
    doc.text(`Runway: ${fs.runway} months`);
    doc.moveDown();

    if (reportType === "kpi" || reportType === "executive") {
      doc.fontSize(12).text("Key KPIs", { underline: true });
      doc.fontSize(10);
      data.kpis.slice(0, 10).forEach((k) => {
        doc.text(`${k.name}: ${k.value}${k.unit === "percent" ? "%" : ""}`);
      });
    }

    if (reportType === "cash-forecast") {
      doc.addPage();
      doc.fontSize(12).text("13-Week Cash Forecast", { underline: true });
      doc.fontSize(9);
      data.cashForecastWeeks.forEach((w) => {
        doc.text(
          `Wk ${w.week}: ${formatCurrency(w.startingBalance)} → ${formatCurrency(w.endingBalance)} (${w.isRiskPeriod ? "RISK" : "OK"})`
        );
      });
    }

    doc.end();
  });
}
