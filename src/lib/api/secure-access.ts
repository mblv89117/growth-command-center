import type { ZodSchema } from "zod";
import { requireApiAccess, type AccessContext } from "@/lib/auth/access";
import { enforceRateLimit, type RateLimitOptions } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/validation/parse-body";

type OrganizationScoped = { organizationId: string };

export interface SecureTenantRequestOptions<TBody extends OrganizationScoped> {
  request: Request;
  schema: ZodSchema<TBody>;
  rateLimit?: Omit<RateLimitOptions, "userId">;
}

export interface SecureTenantContext<TBody extends OrganizationScoped> {
  access: AccessContext;
  body: TBody;
}

/**
 * Tenant-safe API entry point:
 * - Parses and validates JSON with Zod
 * - Requires authenticated access via requireApiAccess
 * - Enforces cross-tenant 403 (including demo org pinning)
 * - Optionally applies per-user/per-route rate limits
 */
export async function requireSecureTenantRequest<TBody extends OrganizationScoped>(
  options: SecureTenantRequestOptions<TBody>
): Promise<SecureTenantContext<TBody>> {
  const body = await parseJsonBody(options.request, options.schema);
  const access = await requireApiAccess({ organizationId: body.organizationId });

  if (options.rateLimit) {
    await enforceRateLimit({
      ...options.rateLimit,
      userId: access.userId,
    });
  }

  return { access, body };
}
