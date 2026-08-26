import {
  connectPlaidDemo,
  createPlaidLinkToken,
  disconnectPlaid,
  syncPlaidBalances,
} from "@/lib/integrations/plaid";
import { getConnection } from "@/lib/integrations/store";
import type { ProviderAdapter } from "../adapter";
import type { CanonicalFinancialSnapshot, SyncJobResult } from "../types";
import { buildProvenance } from "../canonical";
import { buildConnectorHealth, getConnectorDefinition } from "../registry";
import { recordConnectorAudit } from "../audit";

export const plaidAdapter: ProviderAdapter = {
  id: "plaid",
  displayName: "Plaid",
  readOnly: true,

  async authorize(organizationId) {
    const def = getConnectorDefinition("plaid")!;
    if (!def.isProductionLive) {
      return { type: "link_token", message: "Plaid requires production Link approval" };
    }
    const linkToken = await createPlaidLinkToken(organizationId);
    return { type: "link_token", linkToken };
  },

  async handleCallback() {
    throw new Error("Plaid uses Link token flow — handle via client callback");
  },

  async refreshCredentials(organizationId) {
    const conn = await getConnection(organizationId, "plaid");
    return Boolean(conn?.accessToken);
  },

  async initialSync(organizationId) {
    return toSyncJobResult(await syncPlaidBalances(organizationId));
  },

  async incrementalSync(organizationId) {
    return toSyncJobResult(await syncPlaidBalances(organizationId));
  },

  async healthCheck(organizationId) {
    const def = getConnectorDefinition("plaid")!;
    return buildConnectorHealth(organizationId, def);
  },

  async disconnect(organizationId) {
    const ok = await disconnectPlaid(organizationId);
    if (ok) await recordConnectorAudit({ organizationId, connectorId: "plaid", action: "disconnected" });
    return ok;
  },

  async mapToCanonicalModel(organizationId) {
    const conn = await getConnection(organizationId, "plaid");
    return [
      {
        organizationId,
        provenance: buildProvenance({
          source: "Plaid",
          sourceType: "connector",
          connectorId: "plaid",
          syncedAt: conn?.lastSync,
          category: "SOURCE_VERIFIED",
        }),
      },
    ];
  },

  async getLastSuccessfulSync(organizationId) {
    return (await getConnection(organizationId, "plaid"))?.lastSync;
  },

  async getSyncErrors(organizationId) {
    const conn = await getConnection(organizationId, "plaid");
    return conn?.errorMessage ? [conn.errorMessage] : [];
  },
};

function toSyncJobResult(result: {
  success: boolean;
  syncedAt: string;
  recordsSynced: number;
  message: string;
}): SyncJobResult {
  return { success: result.success, syncedAt: result.syncedAt, recordsSynced: result.recordsSynced, message: result.message };
}

export async function connectPlaidDemoAdapter(organizationId: string) {
  await connectPlaidDemo(organizationId);
  await recordConnectorAudit({ organizationId, connectorId: "plaid", action: "connected", detail: "demo" });
}
