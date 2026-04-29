import { describe, it, expect } from 'vitest';
import {
  CareersAnalysisSchema,
  buildCareersPrompt,
} from '@/ai/prompts/careers-analysis';

describe('CareersAnalysisSchema', () => {
  const validInput = {
    roles: [
      { title: 'Senior Backend Engineer', seniority: 'senior', department: 'engineering' },
      { title: 'DevOps Lead', seniority: 'lead', department: 'devops' },
    ],
    has_devops: true,
    has_infra: false,
    mentions_heroku: true,
    mentions_aws: false,
    mentions_cloud_migration: false,
    total_engineering_roles: 5,
  };

  it('validates correct input', () => {
    const result = CareersAnalysisSchema.parse(validInput);
    expect(result.roles).toHaveLength(2);
    expect(result.has_devops).toBe(true);
    expect(result.total_engineering_roles).toBe(5);
  });

  it('rejects missing required fields', () => {
    expect(() =>
      CareersAnalysisSchema.parse({ roles: [] }),
    ).toThrow();
  });

  it('validates role seniority enum', () => {
    const allSeniorities = ['junior', 'mid', 'senior', 'lead', 'manager', 'director', 'vp', 'unknown'] as const;
    for (const seniority of allSeniorities) {
      const input = {
        ...validInput,
        roles: [{ title: 'Test', seniority, department: 'engineering' }],
      };
      expect(() => CareersAnalysisSchema.parse(input)).not.toThrow();
    }

    const invalid = {
      ...validInput,
      roles: [{ title: 'Test', seniority: 'intern', department: 'engineering' }],
    };
    expect(() => CareersAnalysisSchema.parse(invalid)).toThrow();
  });

  it('validates department enum', () => {
    const allDepartments = [
      'engineering', 'devops', 'infrastructure', 'platform',
      'data', 'design', 'product', 'marketing', 'sales', 'other',
    ] as const;
    for (const department of allDepartments) {
      const input = {
        ...validInput,
        roles: [{ title: 'Test', seniority: 'mid', department }],
      };
      expect(() => CareersAnalysisSchema.parse(input)).not.toThrow();
    }

    const invalid = {
      ...validInput,
      roles: [{ title: 'Test', seniority: 'mid', department: 'accounting' }],
    };
    expect(() => CareersAnalysisSchema.parse(invalid)).toThrow();
  });
});

describe('buildCareersPrompt', () => {
  it('includes the careers text', () => {
    const prompt = buildCareersPrompt('We are hiring a Senior Engineer');
    expect(prompt).toContain('We are hiring a Senior Engineer');
  });

  it('requests JSON output', () => {
    const prompt = buildCareersPrompt('any text');
    expect(prompt).toMatch(/JSON/i);
  });

  it('mentions all required fields in the prompt', () => {
    const prompt = buildCareersPrompt('test');
    expect(prompt).toContain('has_devops');
    expect(prompt).toContain('has_infra');
    expect(prompt).toContain('mentions_heroku');
    expect(prompt).toContain('mentions_aws');
    expect(prompt).toContain('mentions_cloud_migration');
    expect(prompt).toContain('total_engineering_roles');
  });
});
