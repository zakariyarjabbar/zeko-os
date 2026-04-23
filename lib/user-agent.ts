// lib/user-agent.ts
// Minimal user-agent classifier for display in the Active Sessions panel.
//
// We deliberately do NOT pull in ua-parser-js / bowser. The Active Sessions
// panel only needs to tell a user "which device is this?" at a glance —
// "Chrome on macOS" is enough. Anything more precise (version numbers,
// engine fingerprints) is security theatre for a personal-console UI.
//
// Order of checks matters: Edge pretends to be Chrome, Opera pretends to
// be Chrome, etc. — match the most specific vendor first.

export interface ParsedUA {
  browser: string;   // e.g. "Chrome", "Firefox", "Safari", "Edge", "Opera"
  os:      string;   // e.g. "Windows", "macOS", "Linux", "iOS", "Android"
}

export function parseUserAgent(raw: string | null | undefined): ParsedUA {
  if (!raw) return { browser: "Unknown", os: "Unknown" };
  const ua = raw.toLowerCase();

  // ── Browser ─────────────────────────────────────────────────
  let browser = "Unknown";
  if      (ua.includes("edg/"))     browser = "Edge";
  else if (ua.includes("opr/")
        || ua.includes("opera"))    browser = "Opera";
  else if (ua.includes("firefox"))  browser = "Firefox";
  else if (ua.includes("chrome"))   browser = "Chrome";
  else if (ua.includes("safari"))   browser = "Safari";

  // ── OS ──────────────────────────────────────────────────────
  let os = "Unknown";
  if      (ua.includes("windows"))  os = "Windows";
  else if (ua.includes("iphone")
        || ua.includes("ipad"))     os = "iOS";
  else if (ua.includes("mac os")
        || ua.includes("macintosh"))os = "macOS";
  else if (ua.includes("android"))  os = "Android";
  else if (ua.includes("linux"))    os = "Linux";

  return { browser, os };
}

/** Short "Chrome · macOS" label for a row in the sessions panel. */
export function formatDeviceLabel(ua: string | null | undefined): string {
  const { browser, os } = parseUserAgent(ua);
  if (browser === "Unknown" && os === "Unknown") return "Unknown device";
  if (browser === "Unknown")                     return os;
  if (os === "Unknown")                          return browser;
  return `${browser} · ${os}`;
}
