import type { ProviderAdapter } from "../adapter";
import { buildConnectorHealth, getConnectorDefinition } from "../registry";

function stubAdapter(
  id: "hubspot" | "gusto" | "xero" | "salesforce" | "jobber" | "buildertrend",
  displayName: string
): ProviderAdapter {
  return {
    id,
    displayName,
    readOnly: true,
    authorize: async () => ({ type: "redirect", message: `${displayName} pending provider registration` }),
    handleCallback: async () => { throw new Error(`${displayName} not production-certified`); },
    refreshCredentials: async () => false,
    initialSync: async () => ({
      success: false, recordsSynced: 0, message: `${displayName} not production-live`,
      syncedAt: new Date().toISOString(),
    }),
    incrementalSync: async () => ({
      success: false, recordsSynced: 0, message: `${displayName} not production-live`,
      syncedAt: new Date().toISOString(),
    }),
    healthCheck: async (organizationId) => buildConnectorHealth(organizationId, getConnectorDefinition(id)!),
    disconnect: async () => true,
    mapToCanonicalModel: async () => [],
    getLastSuccessfulSync: async () => undefined,
    getSyncErrors: async () => [`${displayName} pending provider approval`],
  };
}

export const hubspotAdapter = stubAdapter("hubspot", "HubSpot");
export const gustoAdapter = stubAdapter("gusto", "Gusto");
export const xeroAdapter = stubAdapter("xero", "Xero");
export const salesforceAdapter = stubAdapter("salesforce", "Salesforce");
export const jobberAdapter = stubAdapter("jobber", "Jobber");
export const buildertrendAdapter = stubAdapter("buildertrend", "Buildertrend");
