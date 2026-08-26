import type { IntegrationProvider } from "@/lib/integrations/types";
import {
  connectQuickBooksDemo,
  disconnectQuickBooks,
  exchangeQuickBooksCode,
  getQuickBooksAuthUrl,
  syncQuickBooks,
} from "@/lib/integrations/quickbooks";
import { getConnection, upsertConnection } from "@/lib/integrations/store";
import { isProduction, isQuickBooksConfigured } from "@/lib/config";
import type { ProviderAdapter, AuthorizeResult } from "../adapter";
import type { CanonicalFinancialSnapshot, ConnectorHealth, SyncJobResult } from "../types";
import { buildProvenance } from "../canonical";
import { buildConnectorHealth, getConnectorDefinition } from "../registry";
import { recordConnectorAudit } from "../audit";

export const quickBooksAdapter: ProviderAdapter = {
  id: "quickbooks",
  displayName: "QuickBooks Online",
  readOnly: true,

  async authorize(organizationId, returnUrl) {
    const def = getConnectorDefinition("quickbooks")!;
    if (!def.isProductionLive) {
      if (!isProduction && isQuickBooksConfigured()) {
        return { type: "redirect", url: getQuickBooksAuthUrl(`${organizationId}:${returnUrl}`) };
      }
      return {
        type: "redirect",
        message: "QuickBooks requires provider production approval before live connection",
      };
    }
    return { type: "redirect", url: getQuickBooksAuthUrl(`${organizationId}:${returnUrl}`) };
  },

  async handleCallback(organizationId, params) {
    const { code, realmId } = params;
    if (!code || !realmId) throw new Error("Missing OAuth callback parameters");
    const tokens = await exchangeQuickBooksCode(code, realmId);
    await upsertConnection({
      organizationId,
      provider: "quickbooks",
      status: "connected",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      realmId: tokens.realmId,
      connectedAt: new Date().toISOString(),
      metadata: { expiresAt: tokens.expiresAt },
    });
    await recordConnectorAudit({ organizationId, connectorId: "quickbooks", action: "connected" });
  },

  async refreshCredentials(organizationId) {
    const conn = await getConnection(organizationId, "quickbooks");
    if (!conn?.refreshToken) return false;
    // Token refresh implementation pending Intuit production credentials
    return Boolean(conn.accessToken && !conn.accessToken.startsWith("demo_"));
  },

  async initialSync(organizationId) {
    return toSyncJobResult(await syncQuickBooks(organizationId));
  },

  async incrementalSync(organizationId) {
    return toSyncJobResult(await syncQuickBooks(organizationId));
  },

  async healthCheck(organizationId) {
    const def = getConnectorDefinition("quickbooks")!;
    return buildConnectorHealth(organizationId, def);
  },

  async disconnect(organizationId) {
    const ok = await disconnectQuickBooks(organizationId);
    if (ok) {
      await recordConnectorAudit({ organizationId, connectorId: "quickbooks", action: "disconnected" });
    }
    return ok;
  },

  async mapToCanonicalModel(organizationId, _rawData) {
    const conn = await getConnection(organizationId, "quickbooks");
    return [
      {
        organizationId,
        provenance: buildProvenance({
          source: "QuickBooks Online",
          sourceType: "connector",
          connectorId: "quickbooks",
          syncedAt: conn?.lastSync,
          category: "SOURCE_VERIFIED",
        }),
      },
    ];
  },

  async getLastSuccessfulSync(organizationId) {
    return (await getConnection(organizationId, "quickbooks"))?.lastSync;
  },

  async getSyncErrors(organizationId) {
    const conn = await getConnection(organizationId, "quickbooks");
    return conn?.errorMessage ? [conn.errorMessage] : [];
  },
};

function toSyncJobResult(result: {
  success: boolean;
  syncedAt: string;
  recordsSynced: number;
  message: string;
}): SyncJobResult {
  return {
    success: result.success,
    syncedAt: result.syncedAt,
    recordsSynced: result.recordsSynced,
    message: result.message,
  };
}

export async function connectQuickBooksDemoAdapter(organizationId: string) {
  await connectQuickBooksDemo(organizationId);
  await recordConnectorAudit({ organizationId, connectorId: "quickbooks", action: "connected", detail: "demo" });
}
