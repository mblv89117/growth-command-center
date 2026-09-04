import { describe, expect, it } from 'vitest';
import {
  clientCodeForOrganizationId,
  dualResolveGccIdentity,
  organizationIdForClientCode,
} from '../clientCodeMap';

describe('GCC ClientCode map', () => {
  it('fail-closes unknown ClientCode', () => {
    expect(organizationIdForClientCode('ZZZZ99')).toBeNull();
    expect(organizationIdForClientCode('bad')).toBeNull();
  });

  it('dual-resolves SYN01 fixture', () => {
    const r = dualResolveGccIdentity({ clientCode: 'SYN01' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.organizationId).toBe('org-syn01');
  });

  it('rejects cross-tenant injection', () => {
    const r = dualResolveGccIdentity({
      clientCode: 'SYN01',
      organizationId: 'org-other',
    });
    expect(r.ok).toBe(false);
  });

  it('resolves org → ClientCode for fixture', () => {
    expect(clientCodeForOrganizationId('org-syn01')).toBe('SYN01');
    expect(clientCodeForOrganizationId('missing')).toBeNull();
  });
});
