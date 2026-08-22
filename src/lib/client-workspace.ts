/**
 * GCC client workspace isolation.
 * Shared GCC app; logical workspaces keyed by HVCG ClientCode.
 * Client A never sees Client B. Fail closed. No wildcard.
 */

export const GCC_CLIENT_CODE_RE = /^[A-Z][A-Z0-9]{2,15}$/;

export function isGccClientCode(raw: string | null | undefined): boolean {
  return typeof raw === "string" && GCC_CLIENT_CODE_RE.test(raw);
}

export function gccWorkspaceKey(clientCode: string): string {
  if (!isGccClientCode(clientCode)) {
    throw new ClientWorkspaceError(404, "not_found");
  }
  return `gcc-${clientCode}`;
}

export class ClientWorkspaceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message = code) {
    super(message);
    this.name = "ClientWorkspaceError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Bound caller ClientCode vs requested ClientCode.
 * Missing, malformed, wildcard, or mismatch → 403 fail-closed.
 */
export function assertClientWorkspaceAccess(
  callerClientCode: string | null | undefined,
  requestedClientCode: string | null | undefined
): string {
  if (!isGccClientCode(callerClientCode) || callerClientCode === "*") {
    throw new ClientWorkspaceError(403, "forbidden", "No isolated GCC workspace is bound to this principal.");
  }
  if (!requestedClientCode) return callerClientCode;
  if (!isGccClientCode(requestedClientCode) || requestedClientCode === "*") {
    throw new ClientWorkspaceError(403, "forbidden", "Access denied: client not in principal scope");
  }
  if (requestedClientCode !== callerClientCode) {
    throw new ClientWorkspaceError(403, "forbidden", "Access denied: client not in principal scope");
  }
  return callerClientCode;
}

export function isolateTenantPayload<T extends { organizationId?: string }>(
  payload: T,
  clientCode: string
): T & { clientCode: string; gccWorkspaceKey: string; isolated: true } {
  return {
    ...payload,
    clientCode,
    gccWorkspaceKey: gccWorkspaceKey(clientCode),
    isolated: true,
  };
}
