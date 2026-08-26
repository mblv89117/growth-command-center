import type { ProviderAdapter } from "../adapter";
import type { CanonicalFinancialSnapshot, SyncJobResult } from "../types";
import { buildConnectorHealth, getConnectorDefinition } from "../registry";

/** Stripe data connector — read-only; gated on production API credentials */
export const stripeDataAdapter: ProviderAdapter = {
  id: "stripe",
  displayName: "Stripe",
  readOnly: true,

  async authorize() {
    return {
      type: "redirect",
      message: "Stripe data connector requires production OAuth app registration",
    };
  },

  async handleCallback() {
    throw new Error("Stripe connector not yet production-certified");
  },

  async refreshCredentials() {
    return false;
  },

  async initialSync(): Promise<SyncJobResult> {
    return notLiveResult();
  },

  async incrementalSync(): Promise<SyncJobResult> {
    return notLiveResult();
  },

  async healthCheck(organizationId) {
    const def = getConnectorDefinition("stripe")!;
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
    return ["Stripe data connector pending provider approval"];
  },
};

function notLiveResult(): SyncJobResult {
  return {
    success: false,
    recordsSynced: 0,
    message: "Stripe data connector is not production-live",
    syncedAt: new Date().toISOString(),
  };
}
