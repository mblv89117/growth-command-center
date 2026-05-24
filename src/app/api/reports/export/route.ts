import { NextResponse } from "next/server";
import { getFullTenantData } from "@/lib/data/tenant";
import { generateExcelReport, generatePdfReport } from "@/lib/reports/generate";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId") ?? "org-apex";
  const reportType = searchParams.get("type") ?? "executive";
  const format = searchParams.get("format") ?? "pdf";

  const { data } = await getFullTenantData(organizationId);
  const filename = `gcc-${reportType}-${organizationId}`;

  if (format === "excel") {
    const buffer = await generateExcelReport(data, reportType);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  const buffer = await generatePdfReport(data, reportType);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
    },
  });
}
