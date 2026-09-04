/**
 * Atlas ClientCode ↔ GCC organization mapping.
 * Fail-closed: unknown ClientCode never routes to a tenant.
 * Additive only — does not delete gcc_organizations rows.
 */

export type GccClientCodeMapping = {
  clientCode: string;
  organizationId: string;
  confidence: 'VERIFIED' | 'ESTIMATED' | 'INFERRED';
  notes?: string;
};

/**
 * Verified / fixture mappings only.
 * Production ClientCodes without a GCC org remain unmapped (fail-closed).
 * SYN01 is an observation fixture for contract tests — not a production entitlement.
 */
const MAPPINGS: readonly GccClientCodeMapping[] = [
  {
    clientCode: 'SYN01',
    organizationId: 'org-syn01',
    confidence: 'INFERRED',
    notes: 'Atlas→GCC observation fixture only; auto-provision remains false.',
  },
];

const byCode = new Map(MAPPINGS.map((m) => [m.clientCode, m]));
const byOrg = new Map(MAPPINGS.map((m) => [m.organizationId, m]));

const CLIENT_CODE_RE = /^[A-Z][A-Z0-9]{2,15}$/;

export function isCanonicalClientCode(raw: string | null | undefined): boolean {
  return typeof raw === 'string' && CLIENT_CODE_RE.test(raw);
}

/** Resolve ClientCode → GCC org. Unknown/malformed → null (fail closed). */
export function organizationIdForClientCode(clientCode: string): string | null {
  if (!isCanonicalClientCode(clientCode)) return null;
  return byCode.get(clientCode)?.organizationId ?? null;
}

/** Resolve GCC org → ClientCode. Unknown → null (fail closed). */
export function clientCodeForOrganizationId(organizationId: string): string | null {
  if (!organizationId) return null;
  return byOrg.get(organizationId)?.clientCode ?? null;
}

/**
 * Dual-resolve: when both provided they must agree; otherwise fail closed.
 */
export function dualResolveGccIdentity(input: {
  clientCode?: string | null;
  organizationId?: string | null;
}): { ok: true; clientCode: string; organizationId: string } | { ok: false; reason: string } {
  const code = input.clientCode ?? null;
  const org = input.organizationId ?? null;

  if (code && org) {
    const mappedOrg = organizationIdForClientCode(code);
    const mappedCode = clientCodeForOrganizationId(org);
    if (!mappedOrg || !mappedCode) {
      return { ok: false, reason: 'UNKNOWN_MAPPING' };
    }
    if (mappedOrg !== org || mappedCode !== code) {
      return { ok: false, reason: 'AMBIGUOUS_CROSS_TENANT' };
    }
    return { ok: true, clientCode: code, organizationId: org };
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

export function listGccClientCodeMappings(): readonly GccClientCodeMapping[] {
  return MAPPINGS;
}
