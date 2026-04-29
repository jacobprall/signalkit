import { describe, it, expect } from 'vitest';
import {
  ProductAnalysisSchema,
  TechStackSchema,
  buildProductPrompt,
  buildTechStackPrompt,
} from '@/ai/prompts/product-analysis';

describe('ProductAnalysisSchema', () => {
  const validInput = {
    description: 'A developer-focused CI/CD platform',
    category: 'DevTools',
    likely_stack: ['Node.js', 'React', 'PostgreSQL'],
    complexity: 'complex' as const,
    is_b2b: true,
    is_developer_tool: true,
  };

  it('validates correct input', () => {
    const result = ProductAnalysisSchema.parse(validInput);
    expect(result.description).toBe('A developer-focused CI/CD platform');
    expect(result.likely_stack).toHaveLength(3);
    expect(result.is_b2b).toBe(true);
  });

  it('validates complexity enum', () => {
    for (const complexity of ['simple', 'moderate', 'complex'] as const) {
      expect(() =>
        ProductAnalysisSchema.parse({ ...validInput, complexity }),
      ).not.toThrow();
    }

    expect(() =>
      ProductAnalysisSchema.parse({ ...validInput, complexity: 'extreme' }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() =>
      ProductAnalysisSchema.parse({ description: 'test' }),
    ).toThrow();
  });
});

describe('TechStackSchema', () => {
  const validInput = {
    detected: ['React', 'TypeScript', 'PostgreSQL'],
    source: 'combined' as const,
    has_backend: true,
    has_frontend: true,
    has_mobile: false,
  };

  it('validates correct input', () => {
    const result = TechStackSchema.parse(validInput);
    expect(result.detected).toHaveLength(3);
    expect(result.source).toBe('combined');
    expect(result.has_backend).toBe(true);
  });

  it('validates source enum', () => {
    for (const source of ['careers', 'homepage', 'login', 'combined'] as const) {
      expect(() =>
        TechStackSchema.parse({ ...validInput, source }),
      ).not.toThrow();
    }

    expect(() =>
      TechStackSchema.parse({ ...validInput, source: 'github' }),
    ).toThrow();
  });
});

describe('buildProductPrompt', () => {
  it('includes homepage text', () => {
    const prompt = buildProductPrompt('Welcome to Acme Corp');
    expect(prompt).toContain('Welcome to Acme Corp');
  });

  it('includes login text when provided', () => {
    const prompt = buildProductPrompt('Homepage content', 'Login with SSO');
    expect(prompt).toContain('Login with SSO');
  });

  it('works without login text', () => {
    const prompt = buildProductPrompt('Homepage only');
    expect(prompt).toContain('Homepage only');
    expect(prompt).toMatch(/JSON/i);
  });
});

describe('buildTechStackPrompt', () => {
  it('includes all page texts', () => {
    const pages = [
      { type: 'homepage', text: 'Built with React' },
      { type: 'careers', text: 'Experience with Go required' },
      { type: 'login', text: 'Powered by Auth0' },
    ];
    const prompt = buildTechStackPrompt(pages);

    expect(prompt).toContain('Built with React');
    expect(prompt).toContain('Experience with Go required');
    expect(prompt).toContain('Powered by Auth0');
  });

  it('labels each page by type', () => {
    const pages = [
      { type: 'homepage', text: 'content A' },
      { type: 'careers', text: 'content B' },
    ];
    const prompt = buildTechStackPrompt(pages);

    expect(prompt.toLowerCase()).toContain('homepage');
    expect(prompt.toLowerCase()).toContain('careers');
  });

  it('requests JSON output', () => {
    const prompt = buildTechStackPrompt([{ type: 'homepage', text: 'test' }]);
    expect(prompt).toMatch(/JSON/i);
  });
});
