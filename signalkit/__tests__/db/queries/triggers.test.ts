import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  query: {
    triggers: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/db/connection', () => ({
  getDb: () => mockDb,
}));

import {
  listTriggers,
  getTriggerById,
  createTrigger,
  updateTrigger,
  deleteTrigger,
  getActiveTriggers,
} from '@/db/queries/triggers';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listTriggers', () => {
  it('returns all triggers', async () => {
    const mockTriggers = [
      { id: '1', name: 'Trigger A', isActive: true },
      { id: '2', name: 'Trigger B', isActive: false },
    ];
    mockDb.query.triggers.findMany.mockResolvedValue(mockTriggers);

    const result = await listTriggers();
    expect(result).toEqual(mockTriggers);
    expect(mockDb.query.triggers.findMany).toHaveBeenCalled();
  });
});

describe('getTriggerById', () => {
  it('returns trigger when found', async () => {
    const mockTrigger = { id: '1', name: 'Trigger A' };
    mockDb.query.triggers.findFirst.mockResolvedValue(mockTrigger);

    const result = await getTriggerById('1');
    expect(result).toEqual(mockTrigger);
  });

  it('returns null when not found', async () => {
    mockDb.query.triggers.findFirst.mockResolvedValue(undefined);

    const result = await getTriggerById('nonexistent');
    expect(result).toBeNull();
  });
});

describe('createTrigger', () => {
  it('inserts and returns the new trigger', async () => {
    const newTrigger = {
      name: 'New Trigger',
      conditions: [{ signal_type: 'hosting_provider', operator: 'eq' as const, value: 'render' }],
      actionType: 'prospect_brief',
      actionConfig: {},
      deliveries: [{ type: 'dashboard', config: {} }],
      evaluation: 'on_new_signal',
    };
    const inserted = { id: '1', ...newTrigger, isActive: true, createdAt: new Date(), updatedAt: new Date() };

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([inserted]),
      }),
    });

    const result = await createTrigger(newTrigger);
    expect(result).toEqual(inserted);
    expect(mockDb.insert).toHaveBeenCalled();
  });
});

describe('updateTrigger', () => {
  it('updates and returns trigger', async () => {
    const updated = { id: '1', name: 'Updated', isActive: true };
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updated]),
        }),
      }),
    });

    const result = await updateTrigger('1', { name: 'Updated' });
    expect(result).toEqual(updated);
  });

  it('returns null when trigger not found', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await updateTrigger('nonexistent', { name: 'Nope' });
    expect(result).toBeNull();
  });
});

describe('deleteTrigger', () => {
  it('returns true when trigger deleted', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: '1' }]),
      }),
    });

    const result = await deleteTrigger('1');
    expect(result).toBe(true);
  });

  it('returns false when trigger not found', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await deleteTrigger('nonexistent');
    expect(result).toBe(false);
  });
});

describe('getActiveTriggers', () => {
  it('returns only active triggers', async () => {
    const activeTriggers = [{ id: '1', name: 'Active', isActive: true }];
    mockDb.query.triggers.findMany.mockResolvedValue(activeTriggers);

    const result = await getActiveTriggers();
    expect(result).toEqual(activeTriggers);
    expect(mockDb.query.triggers.findMany).toHaveBeenCalled();
  });
});
