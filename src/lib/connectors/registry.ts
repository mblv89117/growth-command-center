import { isQuickBooksConfigured } from "@/lib/config";
import { isPlaidConfigured } from "@/lib/integrations/plaid";
import { isStripeConfigured } from "@/lib/stripe/config";
import type { ConnectorDefinition, ConnectorHealth, ConnectorState } from "./types";
import { getConnection } from "@/lib/integrations/store";
import type { IntegrationProvider } from "@/lib/integrations/types";

function envConfigured(provider: IntegrationProvider): boolean {
  switch (provider) {
    case "quickbooks":
      return isQuickBooksConfigured();
    case "plaid":
      return isPlaidConfigured();
    case "stripe":
      return isStripeConfigured();
    case "google_sheets":
      return Boolean(
        process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.GOOGLE_REDIRECT_URI
      );
    default:
      return false;
  }
}

/** Canonical connector registry — single source of truth for all providers */
export const CONNECTOR_REGISTRY: ConnectorDefinition[] = [
  // Wave 1 — Financial Core
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    category: "accounting",
    wave: 1,
    description: "Sync P&L, balance sheet inputs, invoices, bills, AR/AP, and company info (read-only).",
    isProductionLive: false,
    isConfigured: isQuickBooksConfigured(),
    requiresProviderApproval: true,
    readOnly: true,
    logo: "QB",
  },
  {
    id: "plaid",
    name: "Plaid",
    category: "banking",
    wave: 1,
    description: "Connect bank and credit accounts for balances and transactions (read-only).",
    isProductionLive: false,
    isConfigured: isPlaidConfigured(),
    requiresProviderApproval: true,
    readOnly: true,
    logo: "PL",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    wave: 1,
    description: "Sync payments, charges, subscriptions, and revenue data (read-only).",
    isProductionLive: false,
    isConfigured: isStripeConfigured(),
    requiresProviderApproval: true,
    readOnly: true,
    logo: "ST",
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    category: "spreadsheets",
    wave: 1,
    description: "Import specific spreadsheets with mapping and preview before commit.",
    isProductionLive: false,
    isConfigured: envConfigured("google_sheets"),
    requiresProviderApproval: true,
    readOnly: true,
    logo: "GS",
  },
  {
    id: "csv",
    name: "CSV Upload",
    category: "uploads",
    wave: "upload",
    description: "Upload CSV financial snapshots and monthly trends.",
    isProductionLive: true,
    isConfigured: true,
    requiresProviderApproval: false,
    readOnly: true,
    logo: "CSV",
  },
  {
    id: "xlsx",
    name: "Excel (XLS/XLSX)",
    category: "uploads",
    wave: "upload",
    description: "Upload Excel workbooks with column mapping and validation.",
    isProductionLive: true,
    isConfigured: true,
    requiresProviderApproval: false,
    readOnly: true,
    logo: "XLS",
  },
  {
    id: "pdf",
    name: "PDF Financial Reports",
    category: "uploads",
    wave: "upload",
    description: "Upload P&L, balance sheet, or cash flow PDFs — review extracted values before commit.",
    isProductionLive: true,
    isConfigured: true,
    requiresProviderApproval: false,
    readOnly: true,
    logo: "PDF",
  },
  // Wave 2
  {
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    wave: 2,
    description: "Sync contacts, deals, pipeline stages, and won/lost summaries (read-only).",
    isProductionLive: false,
    isConfigured: Boolean(process.env.HUBSPOT_CLIENT_ID),
    requiresProviderApproval: true,
    readOnly: true,
    logo: "HS",
  },
  {
    id: "gusto",
    name: "Gusto",
    category: "payroll",
    wave: 2,
    description: "Payroll expense, headcount, and compensation summaries (read-only).",
    isProductionLive: false,
    isConfigured: Boolean(process.env.GUSTO_CLIENT_ID),
    requiresProviderApproval: true,
    readOnly: true,
    logo: "GU",
  },
  {
    id: "xero",
    name: "Xero",
    category: "accounting",
    wave: 2,
    description: "Sync accounting data into the same GCC financial model as QuickBooks.",
    isProductionLive: false,
    isConfigured: Boolean(process.env.XERO_CLIENT_ID),
    requiresProviderApproval: true,
    readOnly: true,
    logo: "XE",
  },
  // Wave 3
  {
    id: "salesforce",
    name: "Salesforce",
    category: "crm",
    wave: 3,
    description: "Accounts, opportunities, pipeline, and revenue pipeline (read-only).",
    isProductionLive: false,
    isConfigured: Boolean(process.env.SALESFORCE_CLIENT_ID),
    requiresProviderApproval: true,
    readOnly: true,
    logo: "SF",
  },
  {
    id: "jobber",
    name: "Jobber",
    category: "operations",
    wave: 3,
    description: "Clients, quotes, jobs, invoices, and operational volume.",
    isProductionLive: false,
    isConfigured: Boolean(process.env.JOBBER_CLIENT_ID),
    requiresProviderApproval: true,
    readOnly: true,
    logo: "JB",
  },
  {
    id: "buildertrend",
    name: "Buildertrend",
    category: "operations",
    wave: 3,
    description: "Projects, estimates, and job financials where API access permits.",
    isProductionLive: false,
    isConfigured: Boolean(process.env.BUILDERTREND_CLIENT_ID),
    requiresProviderApproval: true,
    readOnly: true,
    logo: "BT",
  },
];

export function getConnectorDefinition(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.id === id);
}

export function getConnectorsByCategory(category: ConnectorDefinition["category"]): ConnectorDefinition[] {
  return CONNECTOR_REGISTRY.filter((c) => c.category === category);
}

export function getConnectorsByWave(wave: ConnectorDefinition["wave"]): ConnectorDefinition[] {
  return CONNECTOR_REGISTRY.filter((c) => c.wave === wave);
}

/** Resolve display state — never contradictory (e.g. AVAILABLE + COMING_SOON) */
export function resolveConnectorState(
  def: ConnectorDefinition,
  connection?: { status: string; lastSync?: string; errorMessage?: string; accessToken?: string }
): ConnectorState {
  if (def.isProductionLive && def.isConfigured) {
    if (!connection) return "connect";
    if (connection.status === "pending") return "authorizing";
    if (connection.status === "error") return connection.errorMessage?.includes("reauth") ? "reauthorize" : "error";
    if (connection.status === "connected") {
      if (connection.errorMessage) return "needs_attention";
      if (connection.lastSync) return "healthy";
      return "connected";
    }
    return "disconnected";
  }

  if (def.requiresProviderApproval && !def.isProductionLive) {
    return def.isConfigured ? "provider_approval_required" : "coming_soon";
  }

  if (def.isProductionLive) return "available";

  return "coming_soon";
}

export function stateLabel(state: ConnectorState): string {
  const labels: Record<ConnectorState, string> = {
    available: "Available",
    connect: "Connect",
    authorizing: "Authorizing…",
    connected: "Connected",
    syncing: "Syncing…",
    healthy: "Healthy",
    needs_attention: "Needs Attention",
    reauthorize: "Reauthorize",
    error: "Error",
    disconnected: "Disconnected",
    coming_soon: "Coming Soon",
    provider_approval_required: "Provider Review",
  };
  return labels[state];
}

export async function buildConnectorHealth(
  organizationId: string,
  def: ConnectorDefinition
): Promise<ConnectorHealth> {
  const providerIds = new Set([
    "quickbooks", "xero", "stripe", "plaid", "gusto", "buildertrend",
    "hubspot", "salesforce", "jobber", "google_sheets",
  ]);

  let connection;
  if (providerIds.has(def.id)) {
    connection = await getConnection(organizationId, def.id as IntegrationProvider);
  }

  const state = resolveConnectorState(def, connection);

  return {
    organizationId,
    connectorId: def.id,
    state,
    stateLabel: stateLabel(state),
    connectedAt: connection?.connectedAt,
    lastSuccessfulSync: connection?.lastSync,
    recordsSynced: connection?.metadata?.lastRecordsSynced as number | undefined,
    errorMessage: connection?.errorMessage,
    provenanceSource: def.isProductionLive ? def.name : undefined,
  };
}

export async function getOrganizationConnectorHealth(
  organizationId: string
): Promise<ConnectorHealth[]> {
  return Promise.all(CONNECTOR_REGISTRY.map((def) => buildConnectorHealth(organizationId, def)));
}
