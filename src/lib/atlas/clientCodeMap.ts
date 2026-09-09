/**
 * Atlas ClientCode \u2194 GCC organization mapping.
 * Fail-closed: unknown ClientCode never routes to a tenant.
 * Production mappings load from Azure PostgreSQL (gcc_atlas_client_code_map).
 * SYN01 is a test fixture only \u2014 never a production entitlement.
 */

import { pgQuery, isAzurePostgresConfigured } from '@/lib/db/pool';

export type MappingStatus =
  | 'VERIFIED'
  | 'MISSING_GCC_ORG'
  | 'AMBIGUOUS'
  | 'NOT_APPLICABLE'
  | 'INFERRED';

export type GccClientCodeMapping = {
  clientCode: string;
  organizationId: string;
  status: MappingStatus;
  confidence: 'VERIFIED' | 'ESTIMATED' | 'INFERRED';
  notes?: string;
};

/** Explicit non-production fixture. Enabled only when GCC_ALLOW_SYN01_FIXTURE=true. */
const SYN01_FIXTURE: GccClientCodeMapping = {
  clientCode: 'SYN01',
  organizationId: 'org-syn01',
  status: 'INFERRED',
  confidence: 'INFERRED',
  notes: 'Contract/test fixture only \u2014 not a production entitlement.',
};

const CLIENT_CODE_RE = /^[A-Z][A-Z0-9]{2,15}$/;

type Cache = {
  byCode: Map<string, GccClientCodeMapping>;
  byOrg: Map<string, GccClientCodeMapping>;
  loadedAt: number;
};

let cache: Cache | null = null;
const CACHE_TTL_MS = 60_000;

function syn01Allowed(): boolean {
  return process.env.GCC_ALLOW_SYN01_FIXTURE === 'true';
}

function fixtureMappings(): GccClientCodeMapping[] {
  return syn01Allowed() ? [SYN01_FIXTURE] : [];
}

function buildCache(rows: GccClientCodeMapping[]): Cache {
  const byCode = new Map<string, GccClientCodeMapping>();
  const byOrg = new Map<string, GccClientCodeMapping>();
  for (const row of [...fixtureMappings(), ...rows]) {
    if (byCode.has(row.clientCode) || byOrg.has(row.organizationId)) {
      byCode.delete(row.clientCode);
      byOrg.delete(row.organizationId);
      continue;
    }
    byCode.set(row.clientCode, row);
    byOrg.set(row.organizationId, row);
  }
  return { byCode, byOrg, loadedAt: Date.now() };
}

export function isCanonicalClientCode(raw: string | null | undefined): boolean {
  return typeof raw === 'string' && CLIENT_CODE_RE.test(raw);
}

export function __setClientCodeMapForTests(rows: readonly GccClientCodeMapping[]): void {
  const byCode = new Map<string, GccClientCodeMapping>();
  const byOrg = new Map<string, GccClientCodeMapping>();
  for (const row of rows) {
    if (byCode.has(row.clientCode) || byOrg.has(row.organizationId)) {
      byCode.delete(row.clientCode);
      byOrg.delete(row.organizationId);
      continue;
    }
    byCode.set(row.clientCode, row);
    byOrg.set(row.organizationId, row);
  }
  cache = { byCode, byOrg, loadedAt: Date.now() };
}

export function __resetClientCodeMapCache(): void {
  cache = null;
}

export async function refreshClientCodeMapFromDb(): Promise<void> {
  if (!isAzurePostgresConfigured()) {
    cache = buildCache([]);
    return;
  }
  const result = await pgQuery<{
    client_code: string;
    organization_id: string;
    status: string;
    verification_evidence: string;
  }>(
    `SELECT client_code, organization_id, status, verification_evidence
       FROM gcc_atlas_client_code_map
      WHERE status = 'VERIFIED'`,
  );

  const seenCodes = new Set<string>();
  const seenOrgs = new Set<string>();
  const rows: GccClientCodeMapping[] = [];
  for (const r of result.rows) {
    if (!isCanonicalClientCode(r.client_code)) continue;
    if (r.client_code === 'SYN01') continue;
    if (seenCodes.has(r.client_code) || seenOrgs.has(r.organization_id)) {
      seenCodes.add(r.client_code);
      seenOrgs.add(r.organization_id);
      const idx = rows.findIndex(
        (x) => x.clientCode === r.client_code || x.organizationId === r.organization_id,
      );
      if (idx >= 0) rows.splice(idx, 1);
      continue;
    }
    seenCodes.add(r.client_code);
    seenOrgs.add(r.organization_id);
    rows.push({
      clientCode: r.client_code,
      organizationId: r.organization_id,
      status: 'VERIFIED',
      confidence: 'VERIFIED',
      notes: r.verification_evidence,
    });
  }
  cache = buildCache(rows);
}

async function ensureCache(): Promise<Cache> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;
  await refreshClientCodeMapFromDb();
  return cache ?? buildCache([]);
}

function syncCacheOrEmpty(): Cache {
  return cache ?? buildCache([]);
}

export function organizationIdForClientCode(clientCode: string): string | null {
  if (!isCanonicalClientCode(clientCode)) return null;
  if (clientCode === 'SYN01' && !syn01Allowed()) return null;
  return syncCacheOrEmpty().byCode.get(clientCode)?.organizationId ?? null;
}

export function clientCodeForOrganizationId(organizationId: string): string | null {
  if (!organizationId) return null;
  return syncCacheOrEmpty().byOrg.get(organizationId)?.clientCode ?? null;
}

export async function organizationIdForClientCodeAsync(
  clientCode: string,
): Promise<string | null> {
  if (!isCanonicalClientCode(clientCode)) return null;
  if (clientCode === 'SYN01' && !syn01Allowed()) return null;
  const c = await ensureCache();
  return c.byCode.get(clientCode)?.organizationId ?? null;
}

export async function clientCodeForOrganizationIdAsync(
  organizationId: string,
): Promise<string | null> {
  if (!organizationId) return null;
  const c = await ensureCache();
  return c.byOrg.get(organizationId)?.clientCode ?? null;
}

export function dualResolveGccIdentity(input: {
  clientCode?: string | null;
  organizationId?: string | null;
}): { ok: true; clientCode: string; organizationId: string } | { ok: false; reason: string } {
  const code = input.clientCode ?? null;
  const org = input.organizationId ?? null;

  if (code && org) {
    const mappedOrg = organizationIdForClientCode(code);
    const mappedCode = clientCodeForOrganizationId(org);
    if (!mappedOrg || !mappedCode) return { ok: false, reason: 'UNKNOWN_MAPPING' };
    if (mappedOrg !== org || mappedCode !== code) {
      return { ok: false, reason: 'AMBIGUOUS_CROSS_TENANT' };
    }
    return { ok: true; clientCode: code, organizationId: org };
  }
  if (code) {
    const organizationId = organizationIdForClientCode(code);
    if (!organizationId) return { ok: false, reason: 'UNKNOWN_CLIENT_CODE' };
    return { ok: true, clientCode: code, organizationId };
  }
  if (org) {
    const clientCode = clientCodeForOrganizationId(org);
    if (!clientCode) return { ok: false, reason: 'UNKNOWN_ORGANIZATION' };
    return { ok: true, clientCode, organizationId: org };
  }
  return { ok: false, reason: 'MISSING_IDENTITY' };
}

export async function dualResolveGccIdentityAsync(input: {
  clientCode?: string | null;
  organizationId?: string | null;
}): Promise<
  { ok: true; clientCode: string; organizationId: string } | { ok: false; reason: string }
> {
  await ensureCache();
  return dualResolveGccIdentity(input);
}

export function listGccClientCodeMappings(): readonly GccClientCodeMapping[] {
  return [...syncCacheOrEmpty().byCode.values()];
}

export async function listGccClientCodeMappingsAsync(): Promise<readonly GccClientCodeMapping[]> {
  const c = await ensureCache();
  return [...c.byCode.values()];
}
