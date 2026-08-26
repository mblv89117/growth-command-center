import type { AdapterRegistry } from "./adapter";
import { ConnectorSyncEngine } from "./sync-engine";
import { quickBooksAdapter } from "./adapters/quickbooks";
import { plaidAdapter } from "./adapters/plaid";
import { stripeDataAdapter } from "./adapters/stripe";
import { googleSheetsAdapter } from "./adapters/google-sheets";
import {
  hubspotAdapter,
  gustoAdapter,
  xeroAdapter,
  salesforceAdapter,
  jobberAdapter,
  buildertrendAdapter,
} from "./adapters/wave2-wave3";

export const ADAPTER_REGISTRY: AdapterRegistry = {
  quickbooks: quickBooksAdapter,
  plaid: plaidAdapter,
  stripe: stripeDataAdapter,
  google_sheets: googleSheetsAdapter,
  hubspot: hubspotAdapter,
  gusto: gustoAdapter,
  xero: xeroAdapter,
  salesforce: salesforceAdapter,
  jobber: jobberAdapter,
  buildertrend: buildertrendAdapter,
};

export const syncEngine = new ConnectorSyncEngine(ADAPTER_REGISTRY);

export { CONNECTOR_REGISTRY, getOrganizationConnectorHealth, getConnectorsByCategory, getConnectorsByWave } from "./registry";
export type { ConnectorDefinition, ConnectorHealth, ConnectorState } from "./types";
