import { vi } from 'vitest';
import { z } from 'zod';
import type { Company, Signal } from '@/db/schema';
import type { PipelineContext, PersistPageResult, ExtractedPage } from '@/core/pipeline-context';
import type { IAIClient } from '@/ai/client';

// ---------------------------------------------------------------------------
// Row factories — type-checked against real Drizzle schemas.
// ---------------------------------------------------------------------------

export function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-1',
    name: 'Acme Corp',
    slug: 'acme',
    domain: 'acme.com',
    websiteUrl: 'https://acme.com',
    logoUrl: null,
    source: 'yc_directory',
    sourceId: '1',
    sourceData: { batch: 'W24', one_liner: 'Cloud SaaS platform' },
    metadata: { batch: 'W24', one_liner: 'Cloud SaaS platform' },
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  };
}

export function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'signal-1',
    companyId: 'company-1',
    signalType: 'hosting_detected',
    source: 'dns_detector',
    value: { provider: 'aws' },
    previousValue: null,
    confidence: 0.9,
    detectedAt: new Date('2026-04-01T00:00:00Z'),
    expiresAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PipelineContext stub — override individual methods per test.
// ---------------------------------------------------------------------------

export interface ContextOverrides {
  persistPage?: PersistPageResult;
  extractPageText?: ExtractedPage;
}

export function makeContext(overrides: ContextOverrides = {}): PipelineContext {
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
    persistPage: vi.fn(async () => overrides.persistPage ?? { pageId: 'page-1', contentChanged: true }),
    extractPageText: vi.fn(async () => overrides.extractPageText ?? { text: 'Page content', hrefs: [] }),
  };
}

// ---------------------------------------------------------------------------
// Mock AI client — responds with the given object, validated via schema.
// ---------------------------------------------------------------------------

export function createMockAIClient(response: unknown): IAIClient {
  return {
    analyze: vi.fn().mockImplementation(
      async <T>(_prompt: string, schema: z.ZodType<T>) => schema.parse(response),
    ),
  };
}
