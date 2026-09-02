import { createAdminClient } from "@/lib/supabase/admin";
import { autoMapColumns } from "@/lib/imports/parser";
import type { ImportPreviewResult, ImportTemplateType } from "@/lib/imports/types";
import { IMPORT_TEMPLATES } from "@/lib/imports/types";
import { recomputeTenantFinancials } from "@/lib/pipeline/recompute";
import { completeJobRun, startJobRun } from "@/lib/observability/events";

function parseNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[$,%\s]/g, "").replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}


function assertNoError(error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

export function buildImportPreview(
  templateType: ImportTemplateType,
  fileName: string,
  headers: string[],
  rows: string[][],
  mapping?: Array<{ sourceColumn: string; targetField: string }>
): ImportPreviewResult {
  const template = IMPORT_TEMPLATES[templateType];
  const allFields = [...template.requiredFields, ...template.optionalFields];
  const resolvedMapping = mapping ?? autoMapColumns(headers, allFields);

  const previewRows = rows.map((row, index) => {
    const data: Record<string, string | number> = {};
    const errors: string[] = [];

    for (const map of resolvedMapping) {
      const colIndex = headers.indexOf(map.sourceColumn);
      if (colIndex === -1) continue;
      const raw = row[colIndex] ?? "";
      if (template.requiredFields.includes(map.targetField)) {
        const num = parseNumber(raw);
        if (num === null && map.targetField !== "month" && map.targetField !== "date" && map.targetField !== "description") {
          errors.push(`Invalid number for ${map.targetField}`);
        }
        data[map.targetField] = num ?? raw;
      } else {
        const num = parseNumber(raw);
        data[map.targetField] = num ?? raw;
      }
    }

    for (const required of template.requiredFields) {
      if (data[required] === undefined || data[required] === "") {
        errors.push(`Missing required field: ${required}`);
      }
    }

    return { rowNum: index + 2, data, valid: errors.length === 0, errors };
  });

  return {
    templateType,
    fileName,
    headers,
    mapping: resolvedMapping,
    rows: previewRows,
    validCount: previewRows.filter((r) => r.valid).length,
    errorCount: previewRows.filter((r) => !r.valid).length,
  };
}

export async function commitImport(
  organizationId: string,
  preview: ImportPreviewResult,
  userId?: string
): Promise<{ success: boolean; rowsCommitted: number; error?: string }> {
  const jobId = await startJobRun(organizationId, "import", { template: preview.templateType });
  const admin = createAdminClient();
  if (!admin) {
    await completeJobRun(jobId, "failed", "Database not configured");
    return { success: false, rowsCommitted: 0, error: "Database not configured" };
  }

  const validRows = preview.rows.filter((r) => r.valid);
  if (validRows.length === 0) {
    await completeJobRun(jobId, "failed", "No valid rows");
    return { success: false, rowsCommitted: 0, error: "No valid rows to import" };
  }

  try {
    if (preview.templateType === "financial_snapshot") {
      const row = validRows[0].data;
      {
        const { error } = await admin.from("gcc_financial_snapshots").upsert(
          {
            organization_id: organizationId,
            current_cash: Number(row.current_cash ?? 0),
            revenue_mtd: Number(row.revenue_mtd ?? 0),
            revenue_ytd: Number(row.revenue_ytd ?? 0),
            gross_profit: Number(row.gross_profit ?? 0),
            net_profit: Number(row.net_profit ?? 0),
            operating_expenses: Number(row.operating_expenses ?? 0),
            accounts_receivable: Number(row.accounts_receivable ?? 0),
            accounts_payable: Number(row.accounts_payable ?? 0),
            payroll_obligations: Number(row.payroll_obligations ?? 0),
            ebitda: Number(row.ebitda ?? 0),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id" }
        );
        assertNoError(error, "gcc_financial_snapshots upsert");
      }
    } else if (preview.templateType === "monthly_trends") {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i].data;
        const revenue = Number(row.revenue ?? 0);
        const expenses = Number(row.expenses ?? revenue * 0.7);
        const profit = Number(row.profit ?? revenue - expenses);
        const cash = Number(row.cash ?? 0);
        {
          const { error } = await admin.from("gcc_monthly_trends").upsert(
            {
              organization_id: organizationId,
              month: String(row.month),
              revenue,
              expenses,
              profit,
              cash,
              sort_order: i + 1,
            },
            { onConflict: "organization_id,month" }
          );
          assertNoError(error, "gcc_monthly_trends upsert");
        }
      }
    } else if (preview.templateType === "transactions") {
      for (const row of validRows) {
        const data = row.data;
        const amount = Number(data.amount ?? 0);
        const type = String(data.type ?? (amount >= 0 ? "income" : "expense"));
        {
          const { error } = await admin.from("gcc_transactions").upsert(
            {
              organization_id: organizationId,
              txn_key: `import-${row.rowNum}-${String(data.date)}`,
              txn_date: String(data.date),
              description: String(data.description ?? ""),
              category: String(data.category ?? "imported"),
              amount: Math.abs(amount),
              txn_type: type,
            },
            { onConflict: "organization_id,txn_key" }
          );
          assertNoError(error, "gcc_transactions upsert");
        }
      }
    }

    {
      const { error } = await admin.from("gcc_import_jobs").insert({
        organization_id: organizationId,
        template_type: preview.templateType,
        file_name: preview.fileName,
        status: "completed",
        row_count: validRows.length,
        error_count: preview.errorCount,
        mapping: preview.mapping,
        source_provenance: "csv_xlsx_import",
        created_by: userId ?? null,
        completed_at: new Date().toISOString(),
      });
      assertNoError(error, "gcc_import_jobs insert");
    }

    await admin
      .from("gcc_organizations")
      .update({ data_source: "imported" })
      .eq("id", organizationId);

    const recompute = await recomputeTenantFinancials(organizationId);
    if (!recompute.success) {
      await completeJobRun(jobId, "failed", recompute.error ?? "recompute failed");
      return { success: false, rowsCommitted: 0, error: recompute.error ?? "recompute failed" };
    }
    await completeJobRun(jobId, "success");
    return { success: true, rowsCommitted: validRows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import commit failed";
    await completeJobRun(jobId, "failed", message);
    return { success: false, rowsCommitted: 0, error: message };
  }
}
