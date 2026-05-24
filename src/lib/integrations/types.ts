import type { IntegrationStatus } from "@/lib/types";

export type IntegrationProvider =
  | "quickbooks"
  | "xero"
  | "stripe"
  | "plaid"
  | "gusto"
  | "buildertrend"
  | "hubspot"
  | "salesforce"
  | "jobber"
  | "google_sheets";

export interface IntegrationConnection {
  organizationId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  accessToken?: string;
  refreshToken?: string;
  realmId?: string;
  lastSync?: string;
  connectedAt?: string;
  errorMessage?: string;
  metadata?: Record<string, string | number>;
}

export interface SyncResult {
  provider: IntegrationProvider;
  success: boolean;
  syncedAt: string;
  recordsSynced: number;
  message: string;
}

export interface QuickBooksTokens {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  expiresAt: string;
}
