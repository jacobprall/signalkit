import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLeftJoin = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockOrderBy = vi.fn();

const mockDb = {
  select: mockSelect,
  query: {
    companies: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    signals: {
      findMany: vi.fn(),
    },
    pages: {
      findMany: vi.fn(),
    },
    actionRuns: {
      findMany: vi.fn(),
    },
  },
};

vi.mock('@/db/connection', () => ({
  getDb: () => mockDb,
}));

import {
  listCompanies,
  getCompanyById,
  getCompanyDetail,
} from '@/db/queries/companies';

beforeEach(() => {
  vi.clearAllMocks();

  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({
    leftJoin: mockLeftJoin,
    where: mockWhere,
    limit: mockLimit,
    offset: mockOffset,
    orderBy: mockOrderBy,
  });
  mockLeftJoin.mockReturnValue({
    where: mockWhere,
    limit: mockLimit,
    offset: mockOffset,
    orderBy: mockOrderBy,
  });
  mockWhere.mockReturnValue({
    limit: mockLimit,
    offset: mockOffset,
    orderBy: mockOrderBy,
  });
  mockLimit.mockReturnValue({ offset: mockOffset, orderBy: mockOrderBy });
  mockOffset.mockReturnValue({ orderBy: mockOrderBy });
  mockOrderBy.mockResolvedValue([]);
});

describe('listCompanies', () => {
  it('returns companies and total with no filters', async () => {
    const mockCompanies = [
      { id: '1', name: 'Acme', slug: 'acme', source: 'yc' },
      { id: '2', name: 'Beta', slug: 'beta', source: 'yc' },
    ];

    mockDb.query.companies.findMany.mockResolvedValue(mockCompanies);
    mockDb.query.signals.findMany.mockResolvedValue([]);

    const result = await listCompanies({});
    expect(result).toHaveProperty('companies');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.companies)).toBe(true);
  });

  it('passes hosting filter to query', async () => {
    mockDb.query.companies.findMany.mockResolvedValue([]);

    const result = await listCompanies({ hostingProvider: ['render'] });
    expect(result.companies).toEqual([]);
    expect(mockDb.query.companies.findMany).toHaveBeenCalled();
  });

  it('passes search filter to query', async () => {
    mockDb.query.companies.findMany.mockResolvedValue([
      { id: '1', name: 'Acme Corp', slug: 'acme', source: 'yc' },
    ]);
    mockDb.query.signals.findMany.mockResolvedValue([]);

    const result = await listCompanies({ search: 'Acme' });
    expect(mockDb.query.companies.findMany).toHaveBeenCalled();
  });

  it('respects limit and offset', async () => {
    mockDb.query.companies.findMany.mockResolvedValue([]);

    const result = await listCompanies({ limit: 10, offset: 20 });
    const callArgs = mockDb.query.companies.findMany.mock.calls[0][0];
    expect(callArgs.limit).toBe(10);
    expect(callArgs.offset).toBe(20);
  });
});

describe('getCompanyById', () => {
  it('returns null for missing company', async () => {
    mockDb.query.companies.findFirst.mockResolvedValue(undefined);

    const result = await getCompanyById('nonexistent-id');
    expect(result).toBeNull();
  });

  it('returns company with signals when found', async () => {
    const mockCompany = {
      id: '1',
      name: 'Acme',
      slug: 'acme',
      domain: 'acme.com',
      websiteUrl: 'https://acme.com',
      logoUrl: null,
      source: 'yc',
      sourceData: null,
      metadata: null,
      createdAt: new Date(),
    };

    mockDb.query.companies.findFirst.mockResolvedValue(mockCompany);
    mockDb.query.signals.findMany.mockResolvedValue([
      {
        signalType: 'hosting_provider',
        value: { provider: 'render' },
        confidence: 0.95,
        detectedAt: new Date(),
      },
    ]);

    const result = await getCompanyById('1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('1');
    expect(result!.signals).toHaveLength(1);
  });
});

describe('getCompanyDetail', () => {
  it('returns null for missing company', async () => {
    mockDb.query.companies.findFirst.mockResolvedValue(undefined);

    const result = await getCompanyDetail('nonexistent-id');
    expect(result).toBeNull();
  });

  it('includes pages and action runs', async () => {
    const mockCompany = {
      id: '1',
      name: 'Acme',
      slug: 'acme',
      domain: 'acme.com',
      websiteUrl: 'https://acme.com',
      logoUrl: null,
      source: 'yc',
      sourceData: null,
      metadata: null,
      createdAt: new Date(),
    };
    const mockPages = [
      { url: 'https://acme.com', pageType: 'homepage', contentText: 'Hello', scrapedAt: new Date() },
    ];
    const mockActionRuns = [
      { id: 'ar-1', actionType: 'prospect_brief', status: 'completed', output: { content: 'Brief' }, createdAt: new Date() },
    ];

    mockDb.query.companies.findFirst.mockResolvedValue(mockCompany);
    mockDb.query.signals.findMany.mockResolvedValue([]);
    mockDb.query.pages.findMany.mockResolvedValue(mockPages);
    mockDb.query.actionRuns.findMany.mockResolvedValue(mockActionRuns);

    const result = await getCompanyDetail('1');
    expect(result).not.toBeNull();
    expect(result!.company.id).toBe('1');
    expect(result!.pages).toHaveLength(1);
    expect(result!.pages[0].url).toBe('https://acme.com');
    expect(result!.actionRuns).toHaveLength(1);
    expect(result!.actionRuns[0].action_type).toBe('prospect_brief');
  });
});
