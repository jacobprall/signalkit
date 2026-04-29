import { describe, it, expect, vi } from 'vitest';
import { createYCDirectoryCollector } from '@/collectors/yc-directory';
import { parseDomain } from '@/utils/parse-domain';
import type { PipelineContext } from '@/core/pipeline-context';

function makeContext(): PipelineContext {
  return {
    getCompany: vi.fn(),
    upsertSignal: vi.fn(),
    findSignalsByCompany: vi.fn(),
    findSignalsByIds: vi.fn(),
    createActionRun: vi.fn(),
    markActionRunRunning: vi.fn(),
    markActionRunCompleted: vi.fn(),
    markActionRunFailed: vi.fn(),
    findActionRun: vi.fn(),
    getPageText: vi.fn(),
    enqueue: vi.fn(),
  } as unknown as PipelineContext;
}

describe('parseDomain', () => {
  it('extracts hostname from valid URLs', () => {
    expect(parseDomain('https://example.com')).toBe('example.com');
    expect(parseDomain('https://app.example.com/path')).toBe('app.example.com');
    expect(parseDomain('http://foo.io:8080/bar?q=1')).toBe('foo.io');
  });

  it('strips www prefix', () => {
    expect(parseDomain('https://www.example.com')).toBe('example.com');
    expect(parseDomain('http://www.foo.io/bar')).toBe('foo.io');
  });

  it('returns null for invalid URLs', () => {
    expect(parseDomain('')).toBeNull();
    expect(parseDomain('not a url')).toBeNull();
    expect(parseDomain('://missing-scheme')).toBeNull();
  });

  it('handles URLs without protocol by returning null', () => {
    expect(parseDomain('example.com')).toBeNull();
    expect(parseDomain('www.example.com/path')).toBeNull();
  });
});

describe('YCDirectoryCollector', () => {
  const sampleCompanies = [
    {
      id: 1,
      name: 'ActiveSmall Co',
      slug: 'active-small',
      website: 'https://www.activesmall.com',
      team_size: 10,
      status: 'Active',
      one_liner: 'We do things',
      long_description: 'Longer description',
      industries: ['SaaS'],
      tags: ['B2B'],
      batch: 'W23',
      stage: 'Series A',
      isHiring: true,
      url: 'https://www.ycombinator.com/companies/active-small',
    },
    {
      id: 2,
      name: 'InactiveCo',
      slug: 'inactive-co',
      website: 'https://inactive.com',
      team_size: 5,
      status: 'Inactive',
      one_liner: 'Gone',
      long_description: '',
      industries: [],
      tags: [],
      batch: 'S22',
      stage: 'Seed',
      isHiring: false,
      url: 'https://www.ycombinator.com/companies/inactive-co',
    },
    {
      id: 3,
      name: 'BigCo',
      slug: 'big-co',
      website: 'https://bigco.com',
      team_size: 200,
      status: 'Active',
      one_liner: 'Too big',
      long_description: '',
      industries: ['Fintech'],
      tags: [],
      batch: 'W21',
      stage: 'Series C',
      isHiring: true,
      url: 'https://www.ycombinator.com/companies/big-co',
    },
    {
      id: 4,
      name: 'ZeroTeam',
      slug: 'zero-team',
      website: 'https://zeroteam.io',
      team_size: 0,
      status: 'Active',
      one_liner: 'No team',
      long_description: '',
      industries: [],
      tags: [],
      batch: 'S23',
      stage: 'Pre-seed',
      isHiring: false,
      url: 'https://www.ycombinator.com/companies/zero-team',
    },
    {
      id: 5,
      name: 'AnotherActive',
      slug: 'another-active',
      website: 'https://another.dev',
      team_size: 50,
      status: 'Active',
      one_liner: 'At the edge',
      long_description: 'Edge case with 50',
      industries: ['DevTools'],
      tags: ['Developer'],
      batch: 'W24',
      stage: 'Series A',
      isHiring: false,
      url: 'https://www.ycombinator.com/companies/another-active',
    },
  ];

  function createMockFetcher(data: unknown[], shouldFail = false) {
    if (shouldFail) {
      return vi.fn().mockRejectedValue(new Error('Network error'));
    }
    return vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });
  }

  it('has name "yc_directory"', () => {
    const collector = createYCDirectoryCollector();
    expect(collector.name).toBe('yc_directory');
  });

  it('filters by team_size (1-50) and status (Active)', async () => {
    const fetcher = createMockFetcher(sampleCompanies);
    const collector = createYCDirectoryCollector(fetcher);
    const ctx = makeContext();

    const records: Array<{ source: string; sourceId: string; data: Record<string, unknown> }> = [];
    for await (const record of collector.collect(ctx)) {
      records.push(record);
    }

    expect(records).toHaveLength(2);
    expect(records[0].sourceId).toBe('1');
    expect(records[1].sourceId).toBe('5');
  });

  it('yields CollectedRecord with correct shape', async () => {
    const fetcher = createMockFetcher([sampleCompanies[0]]);
    const collector = createYCDirectoryCollector(fetcher);
    const ctx = makeContext();

    const records: Array<{ source: string; sourceId: string; data: Record<string, unknown> }> = [];
    for await (const record of collector.collect(ctx)) {
      records.push(record);
    }

    expect(records).toHaveLength(1);
    const rec = records[0];
    expect(rec.source).toBe('yc_directory');
    expect(rec.sourceId).toBe('1');
    expect(rec.data.name).toBe('ActiveSmall Co');
    expect(rec.data.slug).toBe('active-small');
    expect(rec.data.website).toBe('https://www.activesmall.com');
    expect(rec.data.domain).toBe('activesmall.com');
    expect(rec.data.team_size).toBe(10);
    expect(rec.data.one_liner).toBe('We do things');
    expect(rec.data.long_description).toBe('Longer description');
    expect(rec.data.industries).toEqual(['SaaS']);
    expect(rec.data.tags).toEqual(['B2B']);
    expect(rec.data.batch).toBe('W23');
    expect(rec.data.stage).toBe('Series A');
    expect(rec.data.isHiring).toBe(true);
    expect(rec.data.url).toBe('https://www.ycombinator.com/companies/active-small');
  });

  it('handles empty response', async () => {
    const fetcher = createMockFetcher([]);
    const collector = createYCDirectoryCollector(fetcher);
    const ctx = makeContext();

    const records: Array<{ source: string; sourceId: string; data: Record<string, unknown> }> = [];
    for await (const record of collector.collect(ctx)) {
      records.push(record);
    }

    expect(records).toHaveLength(0);
  });

  it('handles network errors gracefully', async () => {
    const fetcher = createMockFetcher([], true);
    const collector = createYCDirectoryCollector(fetcher);
    const ctx = makeContext();

    const records: Array<{ source: string; sourceId: string; data: Record<string, unknown> }> = [];
    for await (const record of collector.collect(ctx)) {
      records.push(record);
    }

    expect(records).toHaveLength(0);
  });
});
