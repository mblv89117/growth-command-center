import {
  insertJobRun,
  updateJobRun,
} from "@/lib/data/active-runtime-plane";
import { isPersistentDataBackendAvailable } from "@/lib/data/data-plane";

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
  if (isPersistentDataBackendAvailable()) {
    const id = await insertJobRun(organizationId, jobType, metadata);
    if (id) return id;
  }

  memoryRuns.push({ organizationId, jobType, status: "running", metadata });
  return `mem-${Date.now()}`;
}

export async function completeJobRun(
  jobId: string,
  status: JobStatus,
  errorMessage?: string
): Promise<void> {
  if (isPersistentDataBackendAvailable() && !jobId.startsWith("mem-")) {
    await updateJobRun(jobId, status, errorMessage);
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
