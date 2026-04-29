import { describe, it, expect, vi } from 'vitest';
import {
  matchCname,
  matchHeaders,
  detectHosting,
  resolveCnames,
  checkHttpHeaders,
  HOSTING_SIGNATURES,
  type HostingDetectionResult,
} from '@/utils/dns-detector';

describe('matchCname', () => {
  it('correctly identifies heroku CNAMEs', () => {
    expect(matchCname('proxy.herokuapp.com')).toBe('heroku');
    expect(matchCname('myapp.herokuapp.com')).toBe('heroku');
    expect(matchCname('ssl.herokussl.com')).toBe('heroku');
  });

  it('correctly identifies render CNAMEs', () => {
    expect(matchCname('myapp.onrender.com')).toBe('render');
    expect(matchCname('service.onrender.com')).toBe('render');
  });

  it('correctly identifies vercel CNAMEs', () => {
    expect(matchCname('cname.vercel-dns.com')).toBe('vercel');
    expect(matchCname('alias.vercel-dns.com')).toBe('vercel');
  });

  it('correctly identifies netlify CNAMEs', () => {
    expect(matchCname('mysite.netlify.app')).toBe('netlify');
  });

  it('correctly identifies railway CNAMEs', () => {
    expect(matchCname('myapp.railway.app')).toBe('railway');
  });

  it('correctly identifies fly CNAMEs', () => {
    expect(matchCname('myapp.fly.dev')).toBe('fly');
  });

  it('correctly identifies aws_apprunner CNAMEs', () => {
    expect(matchCname('abc123.awsapprunner.com')).toBe('aws_apprunner');
  });

  it('returns null for unknown CNAMEs', () => {
    expect(matchCname('example.com')).toBeNull();
    expect(matchCname('cdn.cloudflare.net')).toBeNull();
    expect(matchCname('some.random.domain.org')).toBeNull();
  });
});

describe('matchHeaders', () => {
  it('identifies heroku from Via header', () => {
    expect(matchHeaders({ via: '1.1 vegur' })).toBe('heroku');
  });

  it('identifies vercel from server header', () => {
    expect(matchHeaders({ server: 'Vercel' })).toBe('vercel');
  });

  it('identifies render from server header', () => {
    expect(matchHeaders({ server: 'Render' })).toBe('render');
  });

  it('identifies netlify from server header', () => {
    expect(matchHeaders({ server: 'Netlify' })).toBe('netlify');
  });

  it('identifies vercel from x-vercel-id header', () => {
    expect(matchHeaders({ 'x-vercel-id': 'iad1::abc123' })).toBe('vercel');
  });

  it('returns null for unknown headers', () => {
    expect(matchHeaders({})).toBeNull();
    expect(matchHeaders({ server: 'Apache' })).toBeNull();
    expect(matchHeaders({ 'x-powered-by': 'Express' })).toBeNull();
  });
});

describe('resolveCnames', () => {
  it('handles NODATA gracefully', async () => {
    const mockResolver = vi.fn().mockRejectedValue(
      Object.assign(new Error('queryA NODATA'), { code: 'ENODATA' }),
    );
    const result = await resolveCnames('example.com', mockResolver);
    expect(result).toEqual([]);
  });

  it('handles NOTFOUND gracefully', async () => {
    const mockResolver = vi.fn().mockRejectedValue(
      Object.assign(new Error('queryA ENOTFOUND'), { code: 'ENOTFOUND' }),
    );
    const result = await resolveCnames('nonexistent.com', mockResolver);
    expect(result).toEqual([]);
  });

  it('returns resolved CNAMEs for domain and www subdomain', async () => {
    const mockResolver = vi.fn()
      .mockImplementation((domain: string) => {
        if (domain === 'example.com') return Promise.resolve('proxy.herokuapp.com');
        if (domain === 'www.example.com') return Promise.resolve('proxy2.herokuapp.com');
        return Promise.reject(Object.assign(new Error('ENODATA'), { code: 'ENODATA' }));
      });

    const result = await resolveCnames('example.com', mockResolver);
    expect(result).toContain('proxy.herokuapp.com');
    expect(result).toContain('proxy2.herokuapp.com');
  });
});

describe('checkHttpHeaders', () => {
  it('returns headers from successful HEAD request', async () => {
    const mockClient = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([
        ['server', 'Vercel'],
        ['x-vercel-id', 'iad1::abc'],
      ]),
    });

    const result = await checkHttpHeaders('example.com', mockClient);
    expect(result.server).toBe('Vercel');
    expect(result['x-vercel-id']).toBe('iad1::abc');
  });

  it('returns empty object on failure', async () => {
    const mockClient = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    const result = await checkHttpHeaders('unreachable.com', mockClient);
    expect(result).toEqual({});
  });
});

describe('detectHosting', () => {
  it('returns correct provider when CNAME matches', async () => {
    const mockDnsResolver = vi.fn().mockResolvedValue('proxy.herokuapp.com');
    const mockHttpClient = vi.fn().mockRejectedValue(new Error('skip'));

    const result = await detectHosting('example.com', mockDnsResolver, mockHttpClient);
    expect(result.provider).toBe('heroku');
    expect(result.method).toBe('cname');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('returns correct provider when header matches', async () => {
    const mockDnsResolver = vi.fn().mockRejectedValue(
      Object.assign(new Error('ENODATA'), { code: 'ENODATA' }),
    );
    const mockHttpClient = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['server', 'Render']]),
    });

    const result = await detectHosting('example.com', mockDnsResolver, mockHttpClient);
    expect(result.provider).toBe('render');
    expect(result.method).toBe('header');
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('returns "unknown" when nothing matches', async () => {
    const mockDnsResolver = vi.fn().mockRejectedValue(
      Object.assign(new Error('ENODATA'), { code: 'ENODATA' }),
    );
    const mockHttpClient = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['server', 'Apache']]),
    });

    const result = await detectHosting('example.com', mockDnsResolver, mockHttpClient);
    expect(result.provider).toBe('unknown');
    expect(result.method).toBe('none');
    expect(result.confidence).toBe(0);
  });

  it('combines CNAME + header results for higher confidence', async () => {
    const mockDnsResolver = vi.fn().mockResolvedValue('cname.vercel-dns.com');
    const mockHttpClient = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['server', 'Vercel'], ['x-vercel-id', 'iad1::xyz']]),
    });

    const result = await detectHosting('example.com', mockDnsResolver, mockHttpClient);
    expect(result.provider).toBe('vercel');
    expect(result.method).toBe('both');
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });
});
