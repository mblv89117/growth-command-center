import { createHmac, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 15 * 60 * 1000;

function stateSecret(): string {
  const secret =
    process.env.QUICKBOOKS_STATE_SECRET ||
    process.env.QUICKBOOKS_CLIENT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!secret) {
    throw new Error("oauth_state_secret_missing");
  }
  return secret;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", stateSecret()).update(payloadB64).digest("base64url");
}

export type QuickBooksOAuthState = {
  organizationId: string;
  userId: string;
  exp: number;
};

/** GCC-RT-03: signed, expiring OAuth state bound to authenticated user + org. */
export function createSignedQuickBooksState(input: {
  organizationId: string;
  userId: string;
  nowMs?: number;
}): string {
  const body: QuickBooksOAuthState = {
    organizationId: input.organizationId,
    userId: input.userId,
    exp: (input.nowMs ?? Date.now()) + STATE_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(body), "utf-8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySignedQuickBooksState(
  state: string,
  expected?: { userId?: string; nowMs?: number },
): QuickBooksOAuthState {
  const [payloadB64, signature] = state.split(".");
  if (!payloadB64 || !signature) {
    throw new Error("invalid_oauth_state");
  }
  const expectedSig = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("oauth_state_tampered");
  }
  const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as QuickBooksOAuthState;
  if (!parsed.organizationId || !parsed.userId || !parsed.exp) {
    throw new Error("invalid_oauth_state_payload");
  }
  if ((expected?.nowMs ?? Date.now()) > parsed.exp) {
    throw new Error("oauth_state_expired");
  }
  if (expected?.userId && expected.userId !== parsed.userId) {
    throw new Error("oauth_state_user_mismatch");
  }
  return parsed;
}
