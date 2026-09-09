import { z } from "zod";
import { NextResponse } from "next/server";
import { requireSecureTenantRequest } from "@/lib/api/secure-access";
import { apiErrorResponse } from "@/lib/api/errors";
import { organizationIdSchema } from "@/lib/validation/schemas";
import { extractFromPdfBuffer, type PdfConfirmationPayload } from "@/lib/imports/pdf-extract";
import { buildPdfSnapshotPatch } from "@/lib/imports/pdf-snapshot";
import {
  insertPdfImportJob,
  isPersistentDataBackendAvailable,
  updateOrganizationDataSource,
  updatePdfImportJob,
  upsertFinancialSnapshotPatch,
} from "@/lib/data/active-runtime-plane";
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

      let jobId: string | undefined;
      if (isPersistentDataBackendAvailable()) {
        const id = await insertPdfImportJob({
          organizationId: body.organizationId,
          fileName: body.fileName,
          documentType: extraction.documentType,
          periodStart: extraction.periodStart,
          periodEnd: extraction.periodEnd,
          extractedFields: extraction.fields,
          status: "pending_confirmation",
          provenanceCategory: extraction.provenanceCategory,
          createdBy: access.userId,
        });
        jobId = id ?? undefined;
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

      if (!isPersistentDataBackendAvailable()) {
        return NextResponse.json({ error: "Database not configured" }, { status: 503 });
      }

      const confirmation = body.confirmation as PdfConfirmationPayload;
      const fields = confirmation.confirmedFields;
      const snapshotPatch = buildPdfSnapshotPatch({
        confirmedFields: fields,
        ignoredFields: confirmation.ignoredFields,
      });

      if (Object.keys(snapshotPatch).length > 0) {
        await upsertFinancialSnapshotPatch(body.organizationId, snapshotPatch);
        await updateOrganizationDataSource(body.organizationId, "imported");

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

      await updatePdfImportJob(body.jobId, body.organizationId, {
        confirmedFields: fields,
        status: "confirmed",
        provenanceCategory: "USER_CONFIRMED",
        confirmedAt: new Date().toISOString(),
      });

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
