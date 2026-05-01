import { describe, it, expect, vi } from 'vitest';
import { MockAIClient } from '@/ai/client';
import { createWebsiteAnalysisDetector } from '@/detectors/website-analysis';
import { createHiringAnalysisDetector } from '@/detectors/hiring-analysis';
import { createProductAnalysisDetector } from '@/detectors/product-analysis';
import { createTechStackAnalysisDetector } from '@/detectors/tech-stack-analysis';
import type { CareersAnalysis } from '@/ai/prompts/careers-analysis';
import type { ProductAnalysis, TechStack } from '@/ai/prompts/product-analysis';
import type { PipelineContext } from '@/core/pipeline-context';
import { makeCompany } from '../_helpers/fixtures';

function makeContext(pages: Record<string, string | null>): PipelineContext {
  return {
    getPageText: vi.fn(async (_companyId: string, pageType: string) => {
      return pages[pageType] ?? null;
    }),
    getCompany: vi.fn(),
    upsertSignal: vi.fn(),
    findSignalsByCompany: vi.fn(),
    findSignalsByIds: vi.fn(),
    createActionRun: vi.fn(),
    markActionRunRunning: vi.fn(),
    markActionRunCompleted: vi.fn(),
    markActionRunFailed: vi.fn(),
    findActionRun: vi.fn(),
    enqueue: vi.fn(),
  } as unknown as PipelineContext;
}

const careersResponse: CareersAnalysis = {
  roles: [
    { title: 'Senior Backend Engineer', seniority: 'senior', department: 'engineering' },
    { title: 'DevOps Engineer', seniority: 'mid', department: 'devops' },
  ],
  has_devops: true,
  has_infra: false,
  mentions_heroku: true,
  mentions_aws: true,
  mentions_cloud_migration: false,
  total_engineering_roles: 5,
};

const productResponse: ProductAnalysis = {
  description: 'A B2B analytics platform',
  category: 'Analytics',
  likely_stack: ['Python', 'React'],
  complexity: 'complex',
  is_b2b: true,
  is_developer_tool: false,
};

const techStackResponse: TechStack = {
  detected: ['React', 'Python', 'PostgreSQL'],
  source: 'combined',
  has_backend: true,
  has_frontend: true,
  has_mobile: false,
};

describe('WebsiteAnalysisDetector', () => {
  it('detects careers signals from careers page text', async () => {
    const ai = new MockAIClient();
    ai.setResponse('careers', careersResponse);

    const detector = createWebsiteAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      careers: 'We are hiring! Senior Backend Engineer, DevOps Engineer...',
    });

    const signals = await detector.detect(company, ctx);

    const careersSignal = signals.find((s) => s.signalType === 'careers_page');
    expect(careersSignal).toBeDefined();
    expect(careersSignal!.source).toBe('ai_analysis');
    expect(careersSignal!.confidence).toBeGreaterThan(0);
    expect((careersSignal!.value as Record<string, unknown>).has_devops).toBe(true);
  });

  it('detects product_profile from homepage text', async () => {
    const ai = new MockAIClient();
    ai.setResponse('product and technical profile', productResponse);
    ai.setResponse('detect their technology stack', techStackResponse);

    const detector = createWebsiteAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      homepage: 'Welcome to Acme - the leading analytics product platform',
    });

    const signals = await detector.detect(company, ctx);

    const productSignal = signals.find((s) => s.signalType === 'product_profile');
    expect(productSignal).toBeDefined();
    expect(productSignal!.source).toBe('ai_analysis');
    expect((productSignal!.value as Record<string, unknown>).is_b2b).toBe(true);
  });

  it('detects tech_stack from combined page texts', async () => {
    const ai = new MockAIClient();
    ai.setResponse('product and technical profile', productResponse);
    ai.setResponse('detect their technology stack', techStackResponse);

    const detector = createWebsiteAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      homepage: 'Built with modern tech',
      login: 'Sign in with SSO',
    });

    const signals = await detector.detect(company, ctx);

    const techSignal = signals.find((s) => s.signalType === 'tech_stack');
    expect(techSignal).toBeDefined();
    expect((techSignal!.value as Record<string, unknown>).detected).toEqual([
      'React',
      'Python',
      'PostgreSQL',
    ]);
  });

  it('returns empty array when no pages available', async () => {
    const ai = new MockAIClient();
    const detector = createWebsiteAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({});

    const signals = await detector.detect(company, ctx);
    expect(signals).toEqual([]);
  });

  it('handles AI client errors gracefully (logs and skips)', async () => {
    const ai = new MockAIClient();

    const detector = createWebsiteAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      careers: 'Some careers text',
      homepage: 'Some homepage text',
    });

    const signals = await detector.detect(company, ctx);
    expect(signals).toEqual([]);
  });

  it('skips careers analysis when no careers page exists', async () => {
    const ai = new MockAIClient();
    ai.setResponse('product and technical profile', productResponse);
    ai.setResponse('detect their technology stack', techStackResponse);

    const detector = createWebsiteAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      homepage: 'Welcome to NoCareers Inc',
    });

    const signals = await detector.detect(company, ctx);

    const careersSignal = signals.find((s) => s.signalType === 'careers_page');
    expect(careersSignal).toBeUndefined();

    const productSignal = signals.find((s) => s.signalType === 'product_profile');
    expect(productSignal).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// HiringAnalysisDetector
// ---------------------------------------------------------------------------

describe('HiringAnalysisDetector', () => {
  it('produces hiring_activity signal from careers text', async () => {
    const ai = new MockAIClient();
    ai.setResponse('careers', careersResponse);

    const detector = createHiringAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      careers: 'We are hiring! Senior Backend Engineer, DevOps Engineer...',
    });

    const signals = await detector.detect(company, ctx);

    expect(signals).toHaveLength(1);
    expect(signals[0].signalType).toBe('hiring_activity');
    expect(signals[0].source).toBe('ai_analysis');
    expect(signals[0].confidence).toBe(0.85);
    expect((signals[0].value as Record<string, unknown>).has_devops).toBe(true);
  });

  it('returns empty array when no careers page exists', async () => {
    const ai = new MockAIClient();
    const detector = createHiringAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({});

    const signals = await detector.detect(company, ctx);
    expect(signals).toEqual([]);
  });

  it('handles AI errors gracefully', async () => {
    const ai = new MockAIClient();

    const detector = createHiringAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      careers: 'Some careers text',
    });

    const signals = await detector.detect(company, ctx);
    expect(signals).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ProductAnalysisDetector
// ---------------------------------------------------------------------------

describe('ProductAnalysisDetector', () => {
  it('produces product_profile signal from homepage text', async () => {
    const ai = new MockAIClient();
    ai.setResponse('product and technical profile', productResponse);

    const detector = createProductAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      homepage: 'Welcome to Acme - the leading analytics product platform',
    });

    const signals = await detector.detect(company, ctx);

    expect(signals).toHaveLength(1);
    expect(signals[0].signalType).toBe('product_profile');
    expect(signals[0].source).toBe('ai_analysis');
    expect(signals[0].confidence).toBe(0.8);
    expect((signals[0].value as Record<string, unknown>).is_b2b).toBe(true);
  });

  it('returns empty array when no homepage exists', async () => {
    const ai = new MockAIClient();
    const detector = createProductAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({});

    const signals = await detector.detect(company, ctx);
    expect(signals).toEqual([]);
  });

  it('handles AI errors gracefully', async () => {
    const ai = new MockAIClient();

    const detector = createProductAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      homepage: 'Some homepage text',
    });

    const signals = await detector.detect(company, ctx);
    expect(signals).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// TechStackAnalysisDetector
// ---------------------------------------------------------------------------

describe('TechStackAnalysisDetector', () => {
  it('produces tech_stack signal from combined pages', async () => {
    const ai = new MockAIClient();
    ai.setResponse('detect their technology stack', techStackResponse);

    const detector = createTechStackAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      homepage: 'Built with modern tech',
      login: 'Sign in with SSO',
      careers: 'We use React and Python',
    });

    const signals = await detector.detect(company, ctx);

    expect(signals).toHaveLength(1);
    expect(signals[0].signalType).toBe('tech_stack');
    expect(signals[0].source).toBe('ai_analysis');
    expect(signals[0].confidence).toBe(0.75);
    expect((signals[0].value as Record<string, unknown>).detected).toEqual([
      'React',
      'Python',
      'PostgreSQL',
    ]);
  });

  it('returns empty array when no homepage exists', async () => {
    const ai = new MockAIClient();
    const detector = createTechStackAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      careers: 'Some careers text',
    });

    const signals = await detector.detect(company, ctx);
    expect(signals).toEqual([]);
  });

  it('handles AI errors gracefully', async () => {
    const ai = new MockAIClient();

    const detector = createTechStackAnalysisDetector(ai);
    const company = makeCompany();
    const ctx = makeContext({
      homepage: 'Some homepage text',
    });

    const signals = await detector.detect(company, ctx);
    expect(signals).toEqual([]);
  });
});
