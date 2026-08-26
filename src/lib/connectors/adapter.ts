import type { IntegrationProvider } from "@/lib/integrations/types";
import type { CanonicalFinancialSnapshot, ConnectorHealth, SyncJobResult } from "./types";

/**
 * Universal provider adapter contract.
 * Every third-party connector implements this interface — no bespoke per-provider architectures.
 */
export interface ProviderAdapter {
  readonly id: IntegrationProvider;
  readonly displayName: string;
  readonly readOnly: boolean;

  /** Begin OAuth / Link authorization — returns redirect URL or link token metadata */
  authorize(organizationId: string, returnUrl: string): Promise<AuthorizeResult>;

  /** Handle OAuth callback or Link completion */
  handleCallback(
    organizationId: string,
    params: Record<string, string>
  ): Promise<void>;

  /** Refresh expired credentials */
  refreshCredentials(organizationId: string): Promise<boolean>;

  /** Full historical pull into canonical model */
  initialSync(organizationId: string): Promise<SyncJobResult>;

  /** Incremental sync since last cursor */
  incrementalSync(organizationId: string): Promise<SyncJobResult>;

  /** Connection health without full sync */
  healthCheck(organizationId: string): Promise<ConnectorHealth>;

  /** Revoke and remove stored credentials */
  disconnect(organizationId: string): Promise<boolean>;

  /** Map provider-specific payloads to canonical GCC financial model */
  mapToCanonicalModel(
    organizationId: string,
    rawData: unknown
  ): Promise<CanonicalFinancialSnapshot[]>;

  getLastSuccessfulSync(organizationId: string): Promise<string | undefined>;

  getSyncErrors(organizationId: string): Promise<string[]>;
}

export interface AuthorizeResult {
  type: "redirect" | "link_token" | "demo";
  url?: string;
  linkToken?: string;
  message?: string;
}

export type AdapterRegistry = Partial<Record<IntegrationProvider, ProviderAdapter>>;
