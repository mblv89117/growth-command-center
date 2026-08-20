import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * GCC-RT-07: Atlas → GCC activation handoff service attestation.
 * Accepts HMAC-SHA256 over `${timestamp}.${rawBody}` using ATLAS_GCC_HANDOFF_HMAC_SECRET.
 * Headers:
 *   X-Atlas-Gcc-Timestamp: unix seconds
 *   X-Atlas-Gcc-Signature: hex HMAC
 * Max skew: 5 minutes.
 */
const MAX_SKEW_SEC = 5 * 60;

export function getAtlasHandoffHmacSecret(): string | null {
  const secret = process.env.ATLAS_GCC_HANDOFF_HMAC_SECRET?.trim();
  return secret || null;
}

export function signAtlasHandoffBody(rawBody: string, timestampSec: number, secret: string): string {
  return createHmac("sha256", secret).update(`${timestampSec}.${rawBody}`).digest("hex");
}

export function verifyAtlasHandoffAttestation(input: {
  rawBody: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  nowSec?: number;
  secret?: string | null;
}): { ok: true } | { ok: false; reason: string } {
  const secret = input.secret === undefined ? getAtlasHandoffHmacSecret() : input.secret;
  if (!secret) {
    return { ok: false, reason: "handoff_hmac_secret_unconfigured" };
  }
  const tsRaw = String(input.timestampHeader || "").trim();
  const sigRaw = String(input.signatureHeader || "").trim().toLowerCase();
  if (!tsRaw || !sigRaw) {
    return { ok: false, reason: "handoff_attestation_missing" };
  }
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || ts <= 0) {
    return { ok: false, reason: "handoff_timestamp_invalid" };
  }
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_SKEW_SEC) {
    return { ok: false, reason: "handoff_timestamp_skew" };
  }
  const expected = signAtlasHandoffBody(input.rawBody, ts, secret);
  const a = Buffer.from(sigRaw, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "handoff_signature_invalid" };
  }
  return { ok: true };
}
