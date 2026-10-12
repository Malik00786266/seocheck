import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 100.64.0.0/10 ( Carrier-grade NAT )
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local / cloud metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24, 192.0.2.0/24
  if (a === 192 && b === 0) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;

  return false;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // Unique local
  if (normalized.startsWith('fe80:')) return true; // Link-local
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.slice(7);
    if (net.isIPv4(v4Part)) return isPrivateOrReservedIPv4(v4Part);
  }
  return false;
}

export async function validateSafePublicUrl(rawUrl: string): Promise<{
  valid: boolean;
  parsedUrl?: URL;
  reason?: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: 'Invalid URL syntax.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTP and HTTPS protocols are permitted.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'URLs with embedded credentials are not permitted.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    return { valid: false, reason: 'Internal or local hostnames are blocked for security (SSRF protection).' };
  }

  if (net.isIPv4(hostname)) {
    if (isPrivateOrReservedIPv4(hostname)) {
      return { valid: false, reason: 'Private or reserved IPv4 addresses are blocked.' };
    }
    return { valid: true, parsedUrl: parsed };
  }

  if (net.isIPv6(hostname)) {
    if (isPrivateOrReservedIPv6(hostname)) {
      return { valid: false, reason: 'Private or reserved IPv6 addresses are blocked.' };
    }
    return { valid: true, parsedUrl: parsed };
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { valid: false, reason: 'Could not resolve domain name.' };
    }
    for (const rec of records) {
      if (rec.family === 4 && isPrivateOrReservedIPv4(rec.address)) {
        return { valid: false, reason: 'Domain resolves to a restricted private IPv4 address.' };
      }
      if (rec.family === 6 && isPrivateOrReservedIPv6(rec.address)) {
        return { valid: false, reason: 'Domain resolves to a restricted private IPv6 address.' };
      }
    }
  } catch {
    return { valid: false, reason: 'DNS resolution failed for hostname.' };
  }

  return { valid: true, parsedUrl: parsed };
}
