import type { Company, Signal } from '@/db/schema';

// ---------------------------------------------------------------------------
// Test fixtures that match the real Drizzle row shapes. Use these so
// tests are guaranteed to type-check against the actual schema and won't
// silently rot when the DB shape changes.
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
