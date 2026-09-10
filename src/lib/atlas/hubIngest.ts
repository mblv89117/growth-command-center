/**
 * GCC → Atlas Hub module ingest helper (Wave 3).
 * Observation-only. autoProvision always false.
 */
import { createHmac } from 'crypto';
import {
  dualResolveGccIdentity,
  dualResolveGccIdentityAsync,
  organizationIdForClientCode,
  organizationIdForClientCodeAsync,
} from './clientCodeMap';
import { getGccHubIngestConfig } from './hubIngestConfig';

export type GccHubIngestConfig = {
  hubBaseUrl: string;
  moduleIngestKey: string;
  moduleIngestKeyId?: string;
};

export function resolveGccHubIngestConfig(
  override?: Partial<GccHubIngestConfig>,
): GccHubIngestConfig | null {
  const env = getGccHubIngestConfig();
  const hubBaseUrl = override?.hubBaseUrl?.trim() || env?.hubBaseUrl || '';
  const moduleIngestKey = override?.moduleIngestKey?.trim() || env?.moduleIngestKey || '';
  const moduleIngestKeyId =
    override?.moduleIngestKeyId?.trim() || env?.moduleIngestKeyId || 'gcc';
  if (!hubBaseUrl || moduleIngestKey.length < 32) return null;
  return { hubBaseUrl, moduleIngestKey, moduleIngestKeyId };
}

export function buildGccValueSignalEnvelope(input: {
  clientCode: string;
  organizationId?: string;
  signalType: string;
  confidence: 'VERIFIED' | 'ESTIMATED' | 'INFERRED';
  finding: string;
  evidence: string;
  financialImpact?: number;
  correlationId: string;
  actor: string;
}) {
  const dual = dualResolveGccIdentity({
    clientCode: input.clientCode,
    organizationId: input.organizationId ?? organizationIdForClientCode(input.clientCode),
  });
  if (!dual.ok) {
    throw new Error(`GCC ClientCode dual-resolve failed: ${dual.reason}`);
  }
  if (input.confidence === 'INFERRED' && (input.financialImpact ?? 0) > 0) {
    throw new Error('INFERRED signals must not claim financialImpact > 0');
  }
  const idempotencyKey = `gcc|${input.clientCode}|${input.signalType}|${input.correlationId}`;
  return {
    clientCode: dual.clientCode,
    source: 'growth_command_center' as const,
    sourceRecordId: input.correlationId,
    schemaVersion: 'gcc-value-signal.v1',
    eventType: 'gcc.value_signal.v1',
    timestamp: new Date().toISOString(),
    provenance: {
      system: 'gcc',
      observedAt: new Date().toISOString(),
      confidence: input.confidence,
    },
    confidence: input.confidence,
    correlationId: input.correlationId,
    idempotencyKey,
    actor: input.actor,
    authorityClass: 'OBSERVE' as const,
    payload: {
      organizationId: dual.organizationId,
      signalType: input.signalType,
      finding: input.finding,
      evidence: input.evidence,
      financialImpact: input.financialImpact ?? 0,
      autoProvision: false,
    },
  };
}

export async function buildGccValueSignalEnvelopeAsync(input: {
  clientCode: string;
  organizationId?: string;
  signalType: string;
  confidence: 'VERIFIED' | 'ESTIMATED' | 'INFERRED';
  finding: string;
  evidence: string;
  financialImpact?: number;
  correlationId: string;
  actor: string;
}) {
  const organizationId =
    input.organizationId ?? (await organizationIdForClientCodeAsync(input.clientCode));
  const dual = await dualResolveGccIdentityAsync({
    clientCode: input.clientCode,
    organizationId,
  });
  if (!dual.ok) {
    throw new Error(`GCC ClientCode dual-resolve failed: ${dual.reason}`);
  }
  return buildGccValueSignalEnvelope({
    ...input,
    organizationId: dual.organizationId,
  });
}

export async function postGccEnvelopeToHub(
  cfg: GccHubIngestConfig,
  envelope: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const rawBody = JSON.stringify(envelope);
  const timestamp = new Date().toISOString();
  const signature = createHmac('sha256', cfg.moduleIngestKey)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  const res = await fetch(`${cfg.hubBaseUrl.replace(/\/$/, '')}/api/modules/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Secret stays server-side only — never sent as a header.
      'x-atlas-module-key-id': cfg.moduleIngestKeyId || 'gcc',
      'x-atlas-module-timestamp': timestamp,
      'x-atlas-module-signature': signature,
    },
    body: rawBody,
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}
