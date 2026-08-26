import type { ProviderAdapter } from "../adapter";
import type { CanonicalFinancialSnapshot, SyncJobResult } from "../types";
import { buildConnectorHealth, getConnectorDefinition } from "../registry";

export const googleSheetsAdapter: ProviderAdapter = {
  id: "google_sheets",
  displayName: "Google Sheets",
  readOnly: true,

  async authorize() {
    return {
      type: "redirect",
      message: "Google Sheets connector requires OAuth app registration with drive.file scope",
    };
  },

  async handleCallback() {
    throw new Error("Google Sheets connector not yet production-certified");
  },

  async refreshCredentials() {
    return false;
  },

  async initialSync(): Promise<SyncJobResult> {
    return gatedResult();
  },

  async incrementalSync(): Promise<SyncJobResult> {
    return gatedResult();
  },

  async healthCheck(organizationId) {
    const def = getConnectorDefinition("google_sheets")!;
    return buildConnectorHealth(organizationId, def);
  },

  async disconnect() {
    return true;
  },

  async mapToCanonicalModel(): Promise<CanonicalFinancialSnapshot[]> {
    return [];
  },

  async getLastSuccessfulSync() {
    return undefined;
  },

  async getSyncErrors() {
    return ["Google Sheets connector pending provider approval"];
  },
};

function gatedResult(): SyncJobResult {
  return {
    success: false,
    recordsSynced: 0,
    message: "Google Sheets connector is not production-live",
    syncedAt: new Date().toISOString(),
  };
}
