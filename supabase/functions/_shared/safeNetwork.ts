// Outbound request guards shared by media resolvers. Only public HTTP(S)
// destinations are contacted; redirects are revalidated and capped.

declare const Deno: {
  resolveDns(host: string, type: 'A' | 'AAAA'): Promise<string[]>;
};

function ipv4ToInt(ip: string): number | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

const V4_BLOCKS: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

function v4IsPublic(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return false;
  for (const [base, bits] of V4_BLOCKS) {
    const baseValue = ipv4ToInt(base)!;
    const mask = (~0 << (32 - bits)) >>> 0;
    if (((value & mask) >>> 0) === ((baseValue & mask) >>> 0)) return false;
  }
  return true;
}

function expandIpv6(ip: string): number[] | null {
  let value = ip.toLowerCase();
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
  if (value.includes('%')) return null;
  const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(value);
  if (v4) {
    const parsed = ipv4ToInt(v4[1]);
    if (parsed === null) return null;
    value = value.slice(0, -v4[1].length) + ((parsed >>> 16) & 0xffff).toString(16) + ':' + (parsed & 0xffff).toString(16);
  }
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => parseInt(group, 16));
}

function v6IsPublic(ip: string): boolean {
  const groups = expandIpv6(ip);
  if (!groups) return false;
  if (groups.every((group) => group === 0)) return false;
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return false;
  const embedded = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
  if (groups.slice(0, 5).every((group) => group === 0) && (groups[5] === 0xffff || groups[5] === 0)) return v4IsPublic(embedded);
  if (groups[0] === 0x64 && groups[1] === 0xff9b) return v4IsPublic(embedded);
  if ((groups[0] & 0xfe00) === 0xfc00 || (groups[0] & 0xffc0) === 0xfe80 || (groups[0] & 0xff00) === 0xff00) return false;
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return false;
  if (groups[0] === 0x0100 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0) return false;
  if (groups[0] === 0x2002) return v4IsPublic(`${groups[1] >> 8}.${groups[1] & 255}.${groups[2] >> 8}.${groups[2] & 255}`);
  return (groups[0] & 0xe000) === 0x2000;
}

export function isPublicIp(ip: string): boolean {
  return ip.includes(':') ? v6IsPublic(ip) : v4IsPublic(ip);
}

const BLOCKED_HOSTS = new Set(['localhost', 'metadata', 'metadata.google.internal', 'instance-data', 'kubernetes.default']);
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.home.arpa', '.corp', '.intranet', '.localdomain', '.test', '.invalid', '.example'];
const isIpLiteral = (host: string) => ipv4ToInt(host) !== null || host.includes(':') || (host.startsWith('[') && host.endsWith(']'));

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Only HTTP(S) media sources are allowed.');
  if (url.username || url.password) throw new Error('Media URLs must not contain credentials.');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Only standard web ports are allowed.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) throw new Error('Local media hosts are not allowed.');
  if (isIpLiteral(host)) {
    if (!isPublicIp(host)) throw new Error('Private media addresses are not allowed.');
    return url;
  }
  if (!host.includes('.') || !/^[a-z0-9.-]+$/.test(host)) throw new Error('Invalid media hostname.');
  const addresses: string[] = [];
  for (const type of ['A', 'AAAA'] as const) {
    try {
      const records = await Deno.resolveDns(host, type);
      addresses.push(...records.map(String));
    } catch {
      // The other address family may still resolve.
    }
  }
  if (!addresses.length || addresses.some((ip) => !isPublicIp(ip))) throw new Error('Media host does not resolve publicly.');
  return url;
}

export async function probePublicHttpUrl(raw: string): Promise<Response> {
  let current = raw;
  for (let redirect = 0; redirect < 4; redirect++) {
    const url = await assertPublicHttpUrl(current);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1' },
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    try { await response.body?.cancel(); } catch { /* ignore */ }
    if (!location) throw new Error('Media redirect has no destination.');
    current = new URL(location, url).toString();
  }
  throw new Error('Too many media redirects.');
}
