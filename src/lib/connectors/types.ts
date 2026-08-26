import type { IntegrationProvider } from "@/lib/integrations/types";

/** Standardized connector lifecycle states — mutually exclusive display states */
export type ConnectorState =
  | "available"
  | "connect"
  | "authorizing"
  | "connected"
  | "syncing"
  | "healthy"
  | "needs_attention"
  | "reauthorize"
  | "error"
  | "disconnected"
  | "coming_soon"
  | "provider_approval_required";

export type ConnectorCategory =
  | "accounting"
  | "banking"
  | "payments"
  | "payroll"
  | "crm"
  | "operations"
  | "spreadsheets"
  | "uploads";

export type ConnectorWave = 1 | 2 | 3 | "upload";

export type ProvenanceCategory =
  | "SOURCE_VERIFIED"
  | "USER_CONFIRMED"
  | "DETERMINISTICALLY_DERIVED"
  | "AI_EXTRACTED_PENDING_CONFIRMATION"
  | "AI_CLASSIFIED"
  | "UNKNOWN";

export interface ConnectorDefinition {
  id: IntegrationProvider | "csv" | "xlsx" | "xls" | "pdf";
  name: string;
  category: ConnectorCategory;
  wave: ConnectorWave;
  description: string;
  /** Production-certified live connector */
  isProductionLive: boolean;
  /** OAuth or provider credentials configured server-side */
  isConfigured: boolean;
  /** Requires external vendor production review before going live */
  requiresProviderApproval: boolean;
  readOnly: boolean;
  logo: string;
}

export interface ConnectorHealth {
  organizationId: string;
  connectorId: ConnectorDefinition["id"];
  state: ConnectorState;
  stateLabel: string;
  connectedAt?: string;
  lastSuccessfulSync?: string;
  lastSyncAttempt?: string;
  dataRangeStart?: string;
  dataRangeEnd?: string;
  recordsSynced?: number;
  errorMessage?: string;
  provenanceSource?: string;
}

export interface SyncJobResult {
  success: boolean;
  recordsSynced: number;
  message: string;
  syncedAt: string;
  errors?: string[];
  canonicalRecordsWritten?: number;
}

export interface CanonicalFinancialSnapshot {
  organizationId: string;
  periodStart?: string;
  periodEnd?: string;
  revenue?: number;
  cogs?: number;
  grossProfit?: number;
  payroll?: number;
  operatingExpenses?: number;
  ebitda?: number;
  netIncome?: number;
  currentCash?: number;
  accountsReceivable?: number;
  accountsPayable?: number;
  debt?: number;
  workingCapital?: number;
  provenance: ProvenanceRecord;
}

export interface ProvenanceRecord {
  source: string;
  sourceType: "connector" | "file_upload" | "derived";
  connectorId?: string;
  fileName?: string;
  period?: string;
  syncedAt?: string;
  uploadedAt?: string;
  category: ProvenanceCategory;
  confidence?: "high" | "medium" | "low";
}

export interface ConnectorAuditEvent {
  organizationId: string;
  connectorId: string;
  action:
    | "connected"
    | "reauthorized"
    | "sync_started"
    | "sync_completed"
    | "sync_failed"
    | "disconnected"
    | "file_uploaded"
    | "data_confirmed"
    | "data_corrected";
  detail?: string;
  createdAt: string;
}
