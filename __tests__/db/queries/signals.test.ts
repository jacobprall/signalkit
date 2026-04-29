import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import type { ISignalRepository } from '@/db/queries/signals';
import type { Signal } from '@/db/schema';

// In-memory implementation used to lock down the ISignalRepository
// contract. The real Drizzle-backed `SignalRepository` is exercised by
// integration tests against a live Postgres; this suite ensures any
// shape change to the interface is caught at compile time.
function createInMemoryRepo(): ISignalRepository {
  const store = new Map<string, Signal>();

  return {
    async upsert(input) {
      const key = `${input.companyId}:${input.signalType}`;
      const existing = store.get(key);

      if (!existing) {
        const row: Signal = {
          id: crypto.randomUUID(),
          companyId: input.companyId,
          signalType: input.signalType,
          source: input.source,
          value: input.value,
          previousValue: null,
          confidence: input.confidence,
          detectedAt: new Date(),
          expiresAt: null,
        };
        store.set(key, row);
        return { isNew: true, changed: false, signalId: row.id };
      }

      const changed =
        JSON.stringify(existing.value) !== JSON.stringify(input.value);
      if (changed) {
        store.set(key, {
          ...existing,
          previousValue: existing.value,
          value: input.value,
          source: input.source,
          confidence: input.confidence,
          detectedAt: new Date(),
        });
      }
      return { isNew: false, changed, signalId: existing.id };
    },

    async findByCompany(companyId) {
      return [...store.values()].filter((s) => s.companyId === companyId);
    },

    async findByCompanyAndType(companyId, signalType) {
      return store.get(`${companyId}:${signalType}`) ?? null;
    },

    async findByIds(ids) {
      return [...store.values()].filter((s) => ids.includes(s.id));
    },
  };
}

describe('ISignalRepository contract', () => {
  it('upsert returns isNew=true for new signals', async () => {
    const repo = createInMemoryRepo();

    const result = await repo.upsert({
      companyId: 'c-1',
      signalType: 'hosting_detected',
      source: 'dns_detector',
      value: { provider: 'heroku' },
      confidence: 0.9,
    });

    expect(result.isNew).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.signalId).toMatch(/^[0-9a-f-]+$/);
  });

  it('upsert returns changed=true when value differs', async () => {
    const repo = createInMemoryRepo();

    await repo.upsert({
      companyId: 'c-1',
      signalType: 'hosting_detected',
      source: 'dns_detector',
      value: { provider: 'heroku' },
      confidence: 0.9,
    });

    const result = await repo.upsert({
      companyId: 'c-1',
      signalType: 'hosting_detected',
      source: 'dns_detector',
      value: { provider: 'aws' },
      confidence: 0.95,
    });

    expect(result.isNew).toBe(false);
    expect(result.changed).toBe(true);
  });

  it('upsert returns changed=false when value is the same', async () => {
    const repo = createInMemoryRepo();

    const signal = {
      companyId: 'c-1',
      signalType: 'hosting_detected',
      source: 'dns_detector',
      value: { provider: 'heroku' },
      confidence: 0.9,
    };

    await repo.upsert(signal);
    const result = await repo.upsert(signal);

    expect(result.isNew).toBe(false);
    expect(result.changed).toBe(false);
  });

  it('findByCompany returns all signals for a company', async () => {
    const repo = createInMemoryRepo();

    await repo.upsert({
      companyId: 'c-1',
      signalType: 'hosting_detected',
      source: 'dns',
      value: { provider: 'aws' },
      confidence: 0.9,
    });
    await repo.upsert({
      companyId: 'c-1',
      signalType: 'careers_page',
      source: 'ai',
      value: { has_devops: true },
      confidence: 0.8,
    });
    await repo.upsert({
      companyId: 'c-2',
      signalType: 'hosting_detected',
      source: 'dns',
      value: { provider: 'heroku' },
      confidence: 0.85,
    });

    const signals = await repo.findByCompany('c-1');
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.companyId === 'c-1')).toBe(true);
  });

  it('findByCompanyAndType returns matching signal or null', async () => {
    const repo = createInMemoryRepo();

    await repo.upsert({
      companyId: 'c-1',
      signalType: 'hosting_detected',
      source: 'dns',
      value: { provider: 'aws' },
      confidence: 0.9,
    });

    const found = await repo.findByCompanyAndType('c-1', 'hosting_detected');
    expect(found).not.toBeNull();
    expect(found!.signalType).toBe('hosting_detected');

    const notFound = await repo.findByCompanyAndType('c-1', 'nonexistent');
    expect(notFound).toBeNull();
  });

  it('findByIds returns the requested signals', async () => {
    const repo = createInMemoryRepo();

    const a = await repo.upsert({
      companyId: 'c-1',
      signalType: 'hosting_detected',
      source: 'dns',
      value: {},
      confidence: 0.9,
    });
    const b = await repo.upsert({
      companyId: 'c-1',
      signalType: 'careers_page',
      source: 'ai',
      value: {},
      confidence: 0.5,
    });

    const found = await repo.findByIds([a.signalId, b.signalId]);
    expect(found).toHaveLength(2);
  });
});
