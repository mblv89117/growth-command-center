import type { IntegrationProvider } from "@/lib/integrations/types";
import type { ProviderAdapter, AdapterRegistry } from "./adapter";
import { recordConnectorAudit } from "./audit";
import type { SyncJobResult } from "./types";
import { recordSyncResult } from "@/lib/integrations/store";

const SYNC_BACKOFF_MS = [1000, 5000, 15000, 60000];

export class ConnectorSyncEngine {
  constructor(private readonly adapters: AdapterRegistry) {}

  getAdapter(provider: IntegrationProvider): ProviderAdapter | undefined {
    return this.adapters[provider];
  }

  async runInitialSync(
    organizationId: string,
    provider: IntegrationProvider
  ): Promise<SyncJobResult> {
    const adapter = this.adapters[provider];
    if (!adapter) {
      return this.failResult(provider, "Adapter not registered");
    }

    await recordConnectorAudit({
      organizationId,
      connectorId: provider,
      action: "sync_started",
      detail: "initial sync",
    });

    try {
      const result = await this.withRetry(() => adapter.initialSync(organizationId));
      await recordSyncResult(organizationId, provider, {
        provider,
        success: result.success,
        syncedAt: result.syncedAt,
        recordsSynced: result.recordsSynced,
        message: result.message,
      });
      await recordConnectorAudit({
        organizationId,
        connectorId: provider,
        action: result.success ? "sync_completed" : "sync_failed",
        detail: result.message,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      await recordConnectorAudit({
        organizationId,
        connectorId: provider,
        action: "sync_failed",
        detail: message,
      });
      return this.failResult(provider, message);
    }
  }

  async runIncrementalSync(
    organizationId: string,
    provider: IntegrationProvider
  ): Promise<SyncJobResult> {
    const adapter = this.adapters[provider];
    if (!adapter) return this.failResult(provider, "Adapter not registered");

    await recordConnectorAudit({
      organizationId,
      connectorId: provider,
      action: "sync_started",
      detail: "incremental sync",
    });

    const refreshed = await adapter.refreshCredentials(organizationId);
    if (!refreshed) {
      return this.failResult(provider, "Credential refresh failed — reauthorization required");
    }

    const result = await this.withRetry(() => adapter.incrementalSync(organizationId));
    await recordSyncResult(organizationId, provider, {
      provider,
      success: result.success,
      syncedAt: result.syncedAt,
      recordsSynced: result.recordsSynced,
      message: result.message,
    });
    return result;
  }

  async runManualRefresh(
    organizationId: string,
    provider: IntegrationProvider
  ): Promise<SyncJobResult> {
    const lastSync = await this.adapters[provider]?.getLastSuccessfulSync(organizationId);
    if (!lastSync) return this.runInitialSync(organizationId, provider);
    return this.runIncrementalSync(organizationId, provider);
  }

  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, SYNC_BACKOFF_MS[attempt] ?? 60000));
        }
      }
    }
    throw lastError;
  }

  private failResult(provider: IntegrationProvider, message: string): SyncJobResult {
    return {
      success: false,
      recordsSynced: 0,
      message,
      syncedAt: new Date().toISOString(),
    };
  }
}
