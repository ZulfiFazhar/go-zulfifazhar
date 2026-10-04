import type { UserSession } from "../../context";

export interface GoogleTokens {
  access_token: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
  refresh_token?: string;
  scope?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getCryptoKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  );
}

// ponytail: default 7-day session lifetime; upgrade to configurable or rolling TTL when refresh tokens needed
const DEFAULT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;

export async function signSessionJwt(
  payload: UserSession,
  secret: string,
  expiresInSeconds: number = DEFAULT_EXPIRATION_SECONDS
): Promise<string> {
  const enc = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerB64 = bytesToBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = bytesToBase64Url(enc.encode(JSON.stringify(claims)));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const key = await getCryptoKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
  const signatureB64 = bytesToBase64Url(new Uint8Array(signature));

  return `${dataToSign}.${signatureB64}`;
}

export async function verifySessionJwt(
  token: string,
  secret: string
): Promise<UserSession | null> {
  if (!token || typeof token !== "string" || !secret) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const enc = new TextEncoder();
    const key = await getCryptoKey(secret, ["verify"]);
    const signatureBytes = base64UrlToBytes(signatureB64);
    const dataBytes = enc.encode(`${headerB64}.${payloadB64}`);

    const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes, dataBytes);
    if (!isValid) {
      return null;
    }

    const payloadJson = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    const claims = JSON.parse(payloadJson);

    if (claims.exp && typeof claims.exp === "number") {
      const now = Math.floor(Date.now() / 1000);
      if (now > claims.exp) {
        return null;
      }
    }

    if (!claims.userId || typeof claims.userId !== "string" || !claims.email || typeof claims.email !== "string") {
      return null;
    }

    const session: UserSession = {
      userId: claims.userId,
      email: claims.email,
    };
    if (claims.name) session.name = claims.name;
    if (claims.avatarUrl) session.avatarUrl = claims.avatarUrl;

    return session;
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", params.scope || "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${errorText}`);
  }

  return (await res.json()) as GoogleTokens;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch Google userinfo: ${res.status} ${errorText}`);
  }

  const data = (await res.json()) as any;
  return {
    id: data.id || data.sub,
    email: data.email,
    verified_email: data.verified_email,
    name: data.name,
    given_name: data.given_name,
    family_name: data.family_name,
    picture: data.picture,
  };
}
