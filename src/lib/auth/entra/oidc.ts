/**
 * Microsoft Entra External ID (CIAM) OIDC helpers.
 * Authorization-code + PKCE; encrypted session cookie.
 * Never logs tokens or secrets.
 */
import { createHash, randomBytes } from "crypto";
import * as jose from "jose";
import { getEntraConfig, isEntraAuthEnabled, isEntraConfigured } from "./config";

export const ENTRA_SESSION_COOKIE = "gcc_entra_session";
export const ENTRA_STATE_COOKIE = "gcc_entra_oauth";

export interface EntraSession {
  sub: string;
  email: string;
  name?: string;
  oid?: string;
  exp: number;
}

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? process.env.ENTRA_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET (32+ chars) required when AUTH_PROVIDER=entra");
  }
  return new TextEncoder().encode(secret);
}

export function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}


export function createOAuthState(): string {
  return b64url(randomBytes(24));
}

export function buildAuthorizationUrl(params: {
  state: string;
  codeChallenge: string;
  loginHint?: string;
}): string {
  const cfg = getEntraConfig();
  if (!cfg) throw new Error("Entra External ID is not configured");
  const url = new URL(`${cfg.authority}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "openid profile email offline_access");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (params.loginHint) url.searchParams.set("login_hint", params.loginHint);
  return url.toString();
}

export function buildLogoutUrl(): string {
  const cfg = getEntraConfig();
  if (!cfg) throw new Error("Entra External ID is not configured");
  const url = new URL(`${cfg.authority}/oauth2/v2.0/logout`);
  url.searchParams.set("post_logout_redirect_uri", cfg.postLogoutRedirectUri);
  url.searchParams.set("client_id", cfg.clientId);
  return url.toString();
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
}): Promise<{ idToken: string; accessToken: string; expiresIn: number }> {
  const cfg = getEntraConfig();
  if (!cfg) throw new Error("Entra External ID is not configured");

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: cfg.redirectUri,
    code_verifier: params.codeVerifier,
    scope: "openid profile email offline_access",
  });

  const res = await fetch(`${cfg.authority}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Entra token exchange failed (HTTP ${res.status})`);

  const json = (await res.json()) as {
    id_token?: string;
    access_token?: string;
    expires_in?: number;
  };
  if (!json.id_token || !json.access_token) {
    throw new Error("Entra token response missing id_token/access_token");
  }
  return {
    idToken: json.id_token,
    accessToken: json.access_token,
    expiresIn: json.expires_in ?? 3600,
  };
}

export async function verifyIdToken(idToken: string): Promise<EntraSession> {
  const cfg = getEntraConfig();
  if (!cfg) throw new Error("Entra External ID is not configured");

  const jwks = jose.createRemoteJWKSet(new URL(`${cfg.authority}/discovery/v2.0/keys`));
  const { payload } = await jose.jwtVerify(idToken, jwks, {
    issuer: `${cfg.authority}/v2.0`,
    audience: cfg.clientId,
  });

  const email =
    (typeof payload.email === "string" && payload.email) ||
    (typeof payload.preferred_username === "string" && payload.preferred_username) ||
    "";
  if (!payload.sub || !email) throw new Error("Entra id_token missing sub/email");

  return {
    sub: String(payload.sub),
    email: email.toLowerCase(),
    name: typeof payload.name === "string" ? payload.name : undefined,
    oid: typeof payload.oid === "string" ? payload.oid : undefined,
    exp: typeof payload.exp === "number" ? payload.exp : Math.floor(Date.now() / 1000) + 3600,
  };
}

export async function sealSession(session: EntraSession): Promise<string> {
  return new jose.EncryptJWT({ ...session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(session.exp)
    .encrypt(sessionKey());
}

export async function unsealSession(token: string): Promise<EntraSession | null> {
  try {
    const { payload } = await jose.jwtDecrypt(token, sessionKey());
    if (!payload.sub || typeof payload.email !== "string") return null;
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    if (exp * 1000 < Date.now()) return null;
    return {
      sub: String(payload.sub),
      email: String(payload.email).toLowerCase(),
      name: typeof payload.name === "string" ? payload.name : undefined,
      oid: typeof payload.oid === "string" ? payload.oid : undefined,
      exp,
    };
  } catch {
    return null;
  }
}

export function entraReadyForProduction(): boolean {
  return isEntraAuthEnabled() && isEntraConfigured();
}
