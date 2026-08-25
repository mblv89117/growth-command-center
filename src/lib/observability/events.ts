import { createAdminClient } from "@/lib/supabase/admin";

export type JobType =
  | "import"
  | "forecast_recompute"
  | "kpi_recompute"
  | "integration_sync"
  | "ai_advisor";

export type JobStatus = "running" | "success" | "failed";

const memoryRuns: Array<{
  organizationId: string;
  jobType: JobType;
  status: JobStatus;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}> = [];

export async function startJobRun(
  organizationId: string,
  jobType: JobType,
  metadata?: Record<string, unknown>
): Promise<string> {
  const admin = createAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("gcc_job_runs")
      .insert({
        organization_id: organizationId,
        job_type: jobType,
        status: "running",
        metadata: metadata ?? {},
      })
      .select("id")
      .single();
    if (!error && data?.id) return data.id as string;
  }

  memoryRuns.push({ organizationId, jobType, status: "running", metadata });
  return `mem-${Date.now()}`;
}

export async function completeJobRun(
  jobId: string,
  status: JobStatus,
  errorMessage?: string
): Promise<void> {
  const admin = createAdminClient();
  if (admin && !jobId.startsWith("mem-")) {
    await admin
      .from("gcc_job_runs")
      .update({
        status,
        error_message: errorMessage ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return;
  }

  const run = memoryRuns.find((r) => r.status === "running");
  if (run) {
    run.status = status;
    run.errorMessage = errorMessage;
  }
}

export function logOperationalEvent(
  event: string,
  context: Record<string, string | number | boolean>
): void {
  // Never log financial amounts or PII — only operational metadata
  console.error(JSON.stringify({ level: "operational", event, ...context, ts: Date.now() }));
}
