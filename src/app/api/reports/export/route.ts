import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/api/errors";
import { getFullTenantData } from "@/lib/data/tenant";
import { authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { selectOrganizationId } from "@/lib/auth/organization";
import {
  buildExportFilename,
  parseExportFormat,
  parseReportType,
} from "@/lib/reports/config";
import { generateExcelReport, generatePdfReport } from "@/lib/reports/generate";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requested = searchParams.get("organizationId");
    const reportType = parseReportType(searchParams.get("type"));
    const format = parseExportFormat(searchParams.get("format"));

    if (!reportType) {
      throw new ValidationError("Invalid report type");
    }
    if (!format) {
      throw new ValidationError("Invalid export format");
    }

    const access = await requireApiAccess();
    requirePermission(access, "reports:export");

    const selected = selectOrganizationId({
      authOrganizationId: access.organizationId,
      requestedOrganizationId: requested,
      role: access.role,
    });
    if (selected.denied) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationId = selected.organizationId;
    const { data } = await getFullTenantData(organizationId);
    const filename = buildExportFilename(reportType, organizationId, format);

    if (format === "excel") {
      const buffer = await generateExcelReport(data, reportType);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const buffer = await generatePdfReport(data, reportType);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
