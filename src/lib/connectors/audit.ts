import {
  fetchConnectorAuditLog as fetchAuditFromPlane,
  insertConnectorAuditEvent,
} from "@/lib/data/active-runtime-plane";
import { isPersistentDataBackendAvailable } from "@/lib/data/data-plane";
import type { ConnectorAuditEvent } from "./types";

const memoryAudit: ConnectorAuditEvent[] = [];

/** Append connector audit event — never logs secrets */
export async function recordConnectorAudit(
  event: Omit<ConnectorAuditEvent, "createdAt">
): Promise<void> {
  const row = { ...event, createdAt: new Date().toISOString() };

  if (isPersistentDataBackendAvailable()) {
    await insertConnectorAuditEvent(row);
    return;
  }

  memoryAudit.push(row);
}

export async function getConnectorAuditLog(
  organizationId: string,
  limit = 50
): Promise<ConnectorAuditEvent[]> {
  const rows = await fetchAuditFromPlane(organizationId, limit);
  if (rows.length > 0) return rows;

  return memoryAudit.filter((e) => e.organizationId === organizationId).slice(0, limit);
}
