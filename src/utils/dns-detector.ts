import dns from 'dns/promises';
import { createLogger } from '@/lib/logger';

const log = createLogger('dns-detector');

export const HOSTING_SIGNATURES = {
  heroku: {
    cnames: ['herokuapp.com', 'herokussl.com'],
    headers: { via: '1.1 vegur' },
  },
  render: {
    cnames: ['onrender.com'],
    headers: { server: 'Render' },
  },
  vercel: {
    cnames: ['vercel-dns.com'],
    headers: { server: 'Vercel', 'x-vercel-id': '*' },
  },
  netlify: {
    cnames: ['netlify.app'],
    headers: { server: 'Netlify' },
  },
  railway: {
    cnames: ['railway.app'],
    headers: {},
  },
  fly: {
    cnames: ['fly.dev'],
    headers: {},
  },
  aws_apprunner: {
    cnames: ['awsapprunner.com'],
    headers: {},
  },
} as const;

export type HostingProvider = keyof typeof HOSTING_SIGNATURES;

export interface HostingDetectionResult {
  provider: HostingProvider | 'unknown';
  method: 'cname' | 'header' | 'both' | 'none';
  confidence: number;
  rawCname?: string;
  rawHeaders?: Record<string, string>;
}

type DnsResolver = (domain: string) => Promise<string>;
type HttpClient = (url: string, init?: RequestInit) => Promise<{
  ok: boolean;
  headers: Map<string, string> | Headers;
}>;

const RELEVANT_HEADERS = ['server', 'via', 'x-vercel-id', 'x-powered-by'];
const IGNORABLE_DNS_ERRORS = new Set(['ENODATA', 'ENOTFOUND', 'ESERVFAIL', 'ETIMEOUT']);
const HTTP_TIMEOUT_MS = 10_000;

export function matchCname(cname: string): HostingProvider | null {
  const lower = cname.toLowerCase();
  for (const [provider, sig] of Object.entries(HOSTING_SIGNATURES)) {
    for (const suffix of sig.cnames) {
      if (lower.endsWith(suffix)) {
        return provider as HostingProvider;
      }
    }
  }
  return null;
}

export function matchHeaders(headers: Record<string, string>): HostingProvider | null {
  for (const [provider, sig] of Object.entries(HOSTING_SIGNATURES)) {
    const sigHeaders = sig.headers as Record<string, string>;
    if (Object.keys(sigHeaders).length === 0) continue;

    for (const [headerName, expectedValue] of Object.entries(sigHeaders)) {
      const actual = headers[headerName.toLowerCase()];
      if (!actual) continue;

      if (expectedValue === '*' || actual.toLowerCase().includes(expectedValue.toLowerCase())) {
        return provider as HostingProvider;
      }
    }
  }
  return null;
}

export async function resolveCnames(
  domain: string,
  resolver?: DnsResolver,
): Promise<string[]> {
  const resolve = resolver ?? ((d: string) => dns.resolveCname(d).then(records => records[0]));
  const results: string[] = [];

  for (const target of [domain, `www.${domain}`]) {
    try {
      const cname = await resolve(target);
      if (cname) results.push(cname);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code && IGNORABLE_DNS_ERRORS.has(code)) continue;
      // Log unexpected errors so they surface in the worker logs without
      // failing the whole detection (a missing CNAME is the common case).
      log.warn({ domain: target, err }, 'unexpected DNS error');
    }
  }

  return results;
}

export async function checkHttpHeaders(
  domain: string,
  httpClient?: HttpClient,
): Promise<Record<string, string>> {
  const client = httpClient ?? (globalThis.fetch as unknown as HttpClient);

  for (const scheme of ['https', 'http']) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const response = await client(`${scheme}://${domain}`, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });

      if (!response.ok) continue;

      const extracted: Record<string, string> = {};
      for (const name of RELEVANT_HEADERS) {
        const value = response.headers instanceof Map
          ? response.headers.get(name)
          : (response.headers as Headers).get(name);
        if (value) extracted[name] = value;
      }
      return extracted;
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return {};
}

export async function detectHosting(
  domain: string,
  dnsResolver?: DnsResolver,
  httpClient?: HttpClient,
): Promise<HostingDetectionResult> {
  const cnames = await resolveCnames(domain, dnsResolver);
  const headers = await checkHttpHeaders(domain, httpClient);

  let cnameProvider: HostingProvider | null = null;
  let rawCname: string | undefined;

  for (const cname of cnames) {
    const matched = matchCname(cname);
    if (matched) {
      cnameProvider = matched;
      rawCname = cname;
      break;
    }
  }

  const headerProvider = matchHeaders(headers);

  if (cnameProvider && headerProvider && cnameProvider === headerProvider) {
    return {
      provider: cnameProvider,
      method: 'both',
      confidence: 0.95,
      rawCname,
      rawHeaders: headers,
    };
  }

  if (cnameProvider) {
    return {
      provider: cnameProvider,
      method: 'cname',
      confidence: 0.85,
      rawCname,
      rawHeaders: Object.keys(headers).length > 0 ? headers : undefined,
    };
  }

  if (headerProvider) {
    return {
      provider: headerProvider,
      method: 'header',
      confidence: 0.65,
      rawHeaders: headers,
    };
  }

  return {
    provider: 'unknown',
    method: 'none',
    confidence: 0,
    rawHeaders: Object.keys(headers).length > 0 ? headers : undefined,
  };
}
