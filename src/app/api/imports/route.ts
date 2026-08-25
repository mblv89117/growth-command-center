import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireSecureTenantRequest } from "@/lib/api/secure-access";
import { buildImportPreview, commitImport } from "@/lib/imports/commit";
import { parseSpreadsheet } from "@/lib/imports/parser";
import type { ImportTemplateType } from "@/lib/imports/types";

const previewSchema = z.object({
  organizationId: z.string().min(1),
  templateType: z.enum(["financial_snapshot", "monthly_trends", "transactions"]),
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
  mapping: z
    .array(
      z.object({
        sourceColumn: z.string(),
        targetField: z.string(),
      })
    )
    .optional(),
});

const commitSchema = previewSchema.extend({
  preview: z.object({
    templateType: z.enum(["financial_snapshot", "monthly_trends", "transactions"]),
    fileName: z.string(),
    headers: z.array(z.string()),
    mapping: z.array(z.object({ sourceColumn: z.string(), targetField: z.string() })),
    rows: z.array(
      z.object({
        rowNum: z.number(),
        data: z.record(z.string(), z.union([z.string(), z.number()])),
        valid: z.boolean(),
        errors: z.array(z.string()),
      })
    ),
    validCount: z.number(),
    errorCount: z.number(),
  }),
});

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "preview";

    if (action === "commit") {
      const { access, body } = await requireSecureTenantRequest({
        request,
        schema: commitSchema,
      });
      const result = await commitImport(body.organizationId, body.preview, access.userId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    const { body } = await requireSecureTenantRequest({
      request,
      schema: previewSchema,
    });

    const buffer = Buffer.from(body.fileBase64, "base64");
    const { headers, rows } = await parseSpreadsheet(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      body.fileName
    );

    const preview = buildImportPreview(
      body.templateType as ImportTemplateType,
      body.fileName,
      headers,
      rows,
      body.mapping
    );

    return NextResponse.json(preview);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
