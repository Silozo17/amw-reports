// Server-side URL validator. Rejects javascript:, data:, file: and other
// dangerous schemes. Use whenever the app accepts a URL from user input
// that will later be rendered as a link or fetched server-side.

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export interface SafeUrlResult {
  ok: boolean;
  url?: string;
  reason?: string;
}

export function validateSafeUrl(input: string | null | undefined): SafeUrlResult {
  if (!input) return { ok: false, reason: 'empty' };
  const trimmed = String(input).trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  let withScheme = trimmed;
  if (!/^https?:\/\//i.test(withScheme)) {
    withScheme = `https://${withScheme}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, reason: 'forbidden_protocol' };
  }

  // Disallow private/loopback hosts to prevent SSRF
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.local')
  ) {
    return { ok: false, reason: 'private_host' };
  }

  return { ok: true, url: parsed.toString() };
}
