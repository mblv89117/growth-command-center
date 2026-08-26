import { z } from "zod";
import { NextResponse } from "next/server";
import { requireSecureTenantRequest } from "@/lib/api/secure-access";
import { apiErrorResponse } from "@/lib/api/errors";
import { organizationIdSchema } from "@/lib/validation/schemas";
import { extractFromPdfBuffer, type PdfConfirmationPayload } from "@/lib/imports/pdf-extract";
import { createAdminClient } from "@/lib/supabase/admin";
import { storeProvenance } from "@/lib/connectors/provenance";
import { recordConnectorAudit } from "@/lib/connectors/audit";
import { recomputeTenantFinancials } from "@/lib/pipeline/recompute";

const previewSchema = organizationIdSchema.extend({
  fileName: z.string(),
  fileBase64: z.string(),
});

const confirmSchema = organizationIdSchema.extend({
  jobId: z.string().uuid(),
  confirmation: z.object({
    documentType: z.string(),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    confirmedFields: z.record(z.string(), z.number().nullable()),
    ignoredFields: z.array(z.string()),
  }),
});

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "preview") {
      const { access, body } = await requireSecureTenantRequest({
        request,
        schema: previewSchema,
      });

      const buffer = Buffer.from(body.fileBase64, "base64");
      const extraction = await extractFromPdfBuffer(buffer, body.fileName);

      const admin = createAdminClient();
      let jobId: string | undefined;
      if (admin) {
        const { data } = await admin
          .from("gcc_pdf_import_jobs")
          .insert({
            organization_id: body.organizationId,
            file_name: body.fileName,
            document_type: extraction.documentType,
            period_start: extraction.periodStart,
            period_end: extraction.periodEnd,
            extracted_fields: extraction.fields,
            status: "pending_confirmation",
            provenance_category: extraction.provenanceCategory,
            created_by: access.userId,
          })
          .select("id")
          .single();
        jobId = data?.id as string | undefined;
      }

      await recordConnectorAudit({
        organizationId: body.organizationId,
        connectorId: "pdf",
        action: "file_uploaded",
        detail: body.fileName,
      });

      return NextResponse.json({ ...extraction, jobId });
    }

    if (action === "confirm") {
      const { body } = await requireSecureTenantRequest({
        request,
        schema: confirmSchema,
      });

      const admin = createAdminClient();
      if (!admin) {
        return NextResponse.json({ error: "Database not configured" }, { status: 503 });
      }

      const confirmation = body.confirmation as PdfConfirmationPayload;
      const fields = confirmation.confirmedFields;

      const snapshotPatch: Record<string, number> = {};
      const fieldMap: Record<string, string> = {
        revenue: "revenue_mtd",
        grossProfit: "gross_profit",
        netIncome: "net_profit",
        operatingExpenses: "operating_expenses",
        currentCash: "current_cash",
        accountsReceivable: "accounts_receivable",
        accountsPayable: "accounts_payable",
        payroll: "payroll_obligations",
      };

      for (const [key, value] of Object.entries(fields)) {
        if (value === null || confirmation.ignoredFields.includes(key)) continue;
        const dbKey = fieldMap[key];
        if (dbKey) snapshotPatch[dbKey] = value;
      }

      if (Object.keys(snapshotPatch).length > 0) {
        await admin
          .from("gcc_financial_snapshots")
          .upsert(
            { organization_id: body.organizationId, ...snapshotPatch },
            { onConflict: "organization_id" }
          );

        await admin
          .from("gcc_organizations")
          .update({ data_source: "imported" })
          .eq("id", body.organizationId);

        for (const [key, value] of Object.entries(fields)) {
          if (value === null || confirmation.ignoredFields.includes(key)) continue;
          await storeProvenance({
            organizationId: body.organizationId,
            fieldKey: key,
            value,
            source: `PDF: ${confirmation.documentType}`,
            sourceType: "file_upload",
            fileName: body.jobId,
            periodStart: confirmation.periodStart,
            periodEnd: confirmation.periodEnd,
            category: "USER_CONFIRMED",
            confidence: "high",
            uploadedAt: new Date().toISOString(),
          });
        }

        await recomputeTenantFinancials(body.organizationId);
      }

      await admin
        .from("gcc_pdf_import_jobs")
        .update({
          confirmed_fields: fields,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          provenance_category: "USER_CONFIRMED",
        })
        .eq("id", body.jobId)
        .eq("organization_id", body.organizationId);

      await recordConnectorAudit({
        organizationId: body.organizationId,
        connectorId: "pdf",
        action: "data_confirmed",
        detail: `${Object.keys(snapshotPatch).length} fields committed`,
      });

      return NextResponse.json({
        success: true,
        fieldsCommitted: Object.keys(snapshotPatch).length,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
