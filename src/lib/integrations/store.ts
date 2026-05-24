import { createAdminClient } from "@/lib/supabase/admin";
import type { IntegrationConnection, IntegrationProvider, SyncResult } from "./types";

const memoryStore = new Map<string, IntegrationConnection>();

function storeKey(orgId: string, provider: IntegrationProvider) {
  return `${orgId}:${provider}`;
}

function mapRow(row: Record<string, unknown>): IntegrationConnection {
  return {
    organizationId: row.organization_id as string,
    provider: row.provider as IntegrationProvider,
    status: row.status as IntegrationConnection["status"],
    accessToken: row.access_token as string | undefined,
    refreshToken: row.refresh_token as string | undefined,
    realmId: row.realm_id as string | undefined,
    connectedAt: row.connected_at as string | undefined,
    lastSync: row.last_sync as string | undefined,
    errorMessage: row.error_message as string | undefined,
    metadata: (row.metadata as Record<string, string | number>) ?? {},
  };
}

function toRow(connection: IntegrationConnection) {
  return {
    organization_id: connection.organizationId,
    provider: connection.provider,
    status: connection.status,
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    realm_id: connection.realmId,
    connected_at: connection.connectedAt,
    last_sync: connection.lastSync,
    error_message: connection.errorMessage,
    metadata: connection.metadata ?? {},
  };
}

export async function getConnection(
  organizationId: string,
  provider: IntegrationProvider
): Promise<IntegrationConnection | undefined> {
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("gcc_integration_connections")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .maybeSingle();
    if (data) return mapRow(data);
  }
  return memoryStore.get(storeKey(organizationId, provider));
}

export async function getOrganizationConnections(
  organizationId: string
): Promise<IntegrationConnection[]> {
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("gcc_integration_connections")
      .select("*")
      .eq("organization_id", organizationId);
    if (data?.length) return data.map(mapRow);
  }
  return Array.from(memoryStore.values()).filter((c) => c.organizationId === organizationId);
}

export async function upsertConnection(
  connection: IntegrationConnection
): Promise<IntegrationConnection> {
  const admin = createAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("gcc_integration_connections")
      .upsert(toRow(connection), { onConflict: "organization_id,provider" })
      .select()
      .single();
    if (!error && data) return mapRow(data);
  }
  memoryStore.set(storeKey(connection.organizationId, connection.provider), connection);
  return connection;
}

export async function deleteConnection(
  organizationId: string,
  provider: IntegrationProvider
): Promise<boolean> {
  const admin = createAdminClient();
  if (admin) {
    const { error } = await admin
      .from("gcc_integration_connections")
      .delete()
      .eq("organization_id", organizationId)
      .eq("provider", provider);
    if (!error) return true;
  }
  return memoryStore.delete(storeKey(organizationId, provider));
}

export async function recordSyncResult(
  organizationId: string,
  provider: IntegrationProvider,
  result: SyncResult
): Promise<IntegrationConnection> {
  const existing = await getConnection(organizationId, provider);
  const connection: IntegrationConnection = {
    organizationId,
    provider,
    status: result.success ? "connected" : "error",
    accessToken: existing?.accessToken,
    refreshToken: existing?.refreshToken,
    realmId: existing?.realmId,
    connectedAt: existing?.connectedAt ?? new Date().toISOString(),
    lastSync: result.syncedAt,
    errorMessage: result.success ? undefined : result.message,
    metadata: {
      ...(existing?.metadata ?? {}),
      lastRecordsSynced: result.recordsSynced,
    },
  };
  return upsertConnection(connection);
}
