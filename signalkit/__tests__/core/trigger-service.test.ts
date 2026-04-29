import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TriggerEvaluationService,
  type ITriggerRepository,
  type ITriggerRunRepository,
  type ISignalSource,
  type TriggerRecord,
  type TriggeredAction,
} from '@/core/trigger-service';

function makeTrigger(overrides: Partial<TriggerRecord> = {}): TriggerRecord {
  return {
    id: 'trigger-1',
    name: 'Test Trigger',
    conditions: { match: 'all' as const, conditions: [{ signal_type: 'hosting', operator: 'exists' as const }] },
    actionType: 'prospect_brief',
    actionConfig: {},
    deliveries: [{ type: 'dashboard', config: {} }],
    isActive: true,
    ...overrides,
  };
}

describe('TriggerEvaluationService', () => {
  let triggerRepo: ITriggerRepository;
  let triggerRunRepo: ITriggerRunRepository;
  let signalSource: ISignalSource;
  let service: TriggerEvaluationService;

  beforeEach(() => {
    triggerRepo = { findActive: vi.fn().mockResolvedValue([]) };
    triggerRunRepo = {
      exists: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue('run-1'),
    };
    signalSource = { findByCompany: vi.fn().mockResolvedValue([]) };
    service = new TriggerEvaluationService(triggerRepo, triggerRunRepo, signalSource);
  });

  it('returns empty when no active triggers', async () => {
    (signalSource.findByCompany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { signal_type: 'hosting', value: { provider: 'aws' } },
    ]);

    const result = await service.evaluate('company-1');
    expect(result).toEqual([]);
  });

  it('returns empty when no signals match', async () => {
    (triggerRepo.findActive as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTrigger({
        conditions: {
          match: 'all',
          conditions: [{ signal_type: 'dns_records', operator: 'exists' }],
        },
      }),
    ]);
    (signalSource.findByCompany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { signal_type: 'hosting', value: { provider: 'aws' } },
    ]);

    const result = await service.evaluate('company-1');
    expect(result).toEqual([]);
  });

  it('returns triggered action when conditions match', async () => {
    (triggerRepo.findActive as ReturnType<typeof vi.fn>).mockResolvedValue([makeTrigger()]);
    (signalSource.findByCompany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { signal_type: 'hosting', value: { provider: 'aws' } },
    ]);

    const result = await service.evaluate('company-1');
    expect(result).toHaveLength(1);
    expect(result[0].triggerId).toBe('trigger-1');
    expect(result[0].companyId).toBe('company-1');
    expect(result[0].actionType).toBe('prospect_brief');
  });

  it('skips trigger when signal hash already exists (dedup)', async () => {
    (triggerRepo.findActive as ReturnType<typeof vi.fn>).mockResolvedValue([makeTrigger()]);
    (signalSource.findByCompany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { signal_type: 'hosting', value: { provider: 'aws' } },
    ]);
    (triggerRunRepo.exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await service.evaluate('company-1');
    expect(result).toEqual([]);
  });

  it('handles multiple triggers matching same company', async () => {
    (triggerRepo.findActive as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTrigger({ id: 'trigger-1', actionType: 'prospect_brief' }),
      makeTrigger({ id: 'trigger-2', actionType: 'cost_analysis' }),
    ]);
    (signalSource.findByCompany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { signal_type: 'hosting', value: { provider: 'aws' } },
    ]);

    const result = await service.evaluate('company-1');
    expect(result).toHaveLength(2);
    expect(result.map((r: TriggeredAction) => r.actionType)).toEqual([
      'prospect_brief',
      'cost_analysis',
    ]);
  });

  it("correctly uses 'all' match mode", async () => {
    (triggerRepo.findActive as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTrigger({
        conditions: {
          match: 'all',
          conditions: [
            { signal_type: 'hosting', operator: 'exists' },
            { signal_type: 'hosting', field: 'provider', operator: 'eq', value: 'aws' },
          ],
        },
      }),
    ]);
    (signalSource.findByCompany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { signal_type: 'hosting', value: { provider: 'aws' } },
    ]);

    const result = await service.evaluate('company-1');
    expect(result).toHaveLength(1);
  });

  it("correctly uses 'any' match mode", async () => {
    (triggerRepo.findActive as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTrigger({
        conditions: {
          match: 'any',
          conditions: [
            { signal_type: 'dns_records', operator: 'exists' },
            { signal_type: 'hosting', operator: 'exists' },
          ],
        },
      }),
    ]);
    (signalSource.findByCompany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { signal_type: 'hosting', value: { provider: 'aws' } },
    ]);

    const result = await service.evaluate('company-1');
    expect(result).toHaveLength(1);
  });
});
