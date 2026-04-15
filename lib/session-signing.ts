// lib/session-signing.ts
// HMAC-SHA-256 signing for HTTP-only session cookies.
//
// WHY THIS EXISTS
// ───────────────
// Without a signature, anyone who can write to the cookie jar (XSS, cookie
// injection, man-in-the-middle on non-TLS connections) can forge a session
// payload and impersonate any user, including the Administrator.
//
// With HMAC signing, the server embeds a cryptographic signature derived from
// SESSION_SECRET. A tampered or forged cookie produces a signature that does
// not match, and verifyPayload() returns null — forcing a fresh login.
//
// FORMAT
// ──────
//   base64url(JSON(payload)) . HMAC-SHA-256(base64url(JSON(payload)))
//
// The separator is a literal period. The HMAC covers only the encoded payload,
// which is sufficient; signing the full value would be redundant.
//
// RUNTIME COMPATIBILITY
// ─────────────────────
// Uses the Web Crypto API (crypto.subtle) exclusively — no Node.js-only APIs.
// Works in both Node.js (≥18) and Edge runtimes, including Vercel Edge Functions.

// ── Env key ───────────────────────────────────────────────────────────────────

const SEPARATOR = ".";
const MIN_SECRET_LEN = 32;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    throw new Error(
      "SESSION_SECRET environment variable is not set.\n" +
      "Generate one with:  openssl rand -base64 32\n" +
      "Then add it to .env.local."
    );
  }
  if (s.length < MIN_SECRET_LEN) {
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SECRET_LEN} characters long.`
    );
  }
  return s;
}

// ── Web-Crypto helpers ────────────────────────────────────────────────────────

/** base64url-encode a Uint8Array without using Buffer (edge-safe). */
function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** base64url-decode a string to Uint8Array without using Buffer (edge-safe). */
function b64urlDecode(str: string): Uint8Array {
  const b64     = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded  = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  const binary  = atob(padded);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function computeHmac(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return b64urlEncode(new Uint8Array(sig));
}

// ── Constant-time comparison ──────────────────────────────────────────────────
//
// A naive `a === b` check leaks the position of the first differing byte
// via timing differences. An attacker could use thousands of requests to
// infer the expected HMAC one byte at a time (timing oracle attack).
// XOR-folding all differences and checking only at the end prevents this.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Serialise `payload` as JSON, encode it as base64url, and append an
 * HMAC-SHA-256 signature.  Store the returned string as the cookie value.
 *
 * @throws if SESSION_SECRET is missing or too short.
 */
export async function signPayload<T>(payload: T): Promise<string> {
  const json    = JSON.stringify(payload);
  const encoded = b64urlEncode(new TextEncoder().encode(json));
  const key     = await importHmacKey(getSecret());
  const sig     = await computeHmac(key, encoded);
  return `${encoded}${SEPARATOR}${sig}`;
}

/**
 * Verify the HMAC signature and deserialise the payload.
 *
 * Returns the original payload on success.
 * Returns `null` when the cookie is absent, truncated, tampered with,
 * signed with a different secret, or not valid JSON.
 *
 * @throws if SESSION_SECRET is missing or too short.
 */
export async function verifyPayload<T>(token: string): Promise<T | null> {
  const dotIndex = token.lastIndexOf(SEPARATOR);
  if (dotIndex === -1) return null;

  const encoded = token.slice(0, dotIndex);
  const sig     = token.slice(dotIndex + 1);

  try {
    const key      = await importHmacKey(getSecret());
    const expected = await computeHmac(key, encoded);

    if (!timingSafeEqual(sig, expected)) return null;

    const json = new TextDecoder().decode(b64urlDecode(encoded));
    return JSON.parse(json) as T;
  } catch {
    // Malformed base64, invalid JSON, or crypto failure — treat as invalid
    return null;
  }
}
