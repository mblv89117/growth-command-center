import { createAdminClient } from "@/lib/supabase/admin";
import type { ConnectorAuditEvent } from "./types";

const memoryAudit: ConnectorAuditEvent[] = [];

/** Append connector audit event — never logs secrets */
export async function recordConnectorAudit(
  event: Omit<ConnectorAuditEvent, "createdAt">
): Promise<void> {
  const row = { ...event, createdAt: new Date().toISOString() };
  const admin = createAdminClient();

  if (admin) {
    await admin.from("gcc_connector_audit").insert({
      organization_id: event.organizationId,
      connector_id: event.connectorId,
      action: event.action,
      detail: event.detail,
      created_at: row.createdAt,
    });
  } else {
    memoryAudit.push(row);
  }
}

export async function getConnectorAuditLog(
  organizationId: string,
  limit = 50
): Promise<ConnectorAuditEvent[]> {
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("gcc_connector_audit")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => ({
      organizationId: row.organization_id as string,
      connectorId: row.connector_id as string,
      action: row.action as ConnectorAuditEvent["action"],
      detail: row.detail as string | undefined,
      createdAt: row.created_at as string,
    }));
  }

  return memoryAudit
    .filter((e) => e.organizationId === organizationId)
    .slice(0, limit);
}
