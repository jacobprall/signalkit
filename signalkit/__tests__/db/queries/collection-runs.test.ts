import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  query: {
    collectionRuns: {
      findMany: vi.fn(),
    },
  },
  insert: vi.fn(),
  update: vi.fn(),
};

vi.mock('@/db/connection', () => ({
  getDb: () => mockDb,
}));

import {
  createCollectionRun,
  completeCollectionRun,
  failCollectionRun,
  listRecentCollectionRuns,
} from '@/db/queries/collection-runs';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createCollectionRun', () => {
  it('inserts a new run and returns the id', async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'run-1' }]),
      }),
    });

    const id = await createCollectionRun('yc_directory');
    expect(id).toBe('run-1');
    expect(mockDb.insert).toHaveBeenCalled();
  });
});

describe('completeCollectionRun', () => {
  it('updates run with completed status and stats', async () => {
    const mockSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockDb.update.mockReturnValue({ set: mockSet });

    await completeCollectionRun('run-1', { companiesProcessed: 100 });
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
  });
});

describe('failCollectionRun', () => {
  it('updates run with failed status and error', async () => {
    const mockSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockDb.update.mockReturnValue({ set: mockSet });

    await failCollectionRun('run-1', 'Network timeout');
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });
});

describe('listRecentCollectionRuns', () => {
  it('returns recent runs with default limit', async () => {
    const mockRuns = [
      { id: 'run-1', collectorType: 'yc_directory', status: 'completed' },
      { id: 'run-2', collectorType: 'yc_directory', status: 'running' },
    ];
    mockDb.query.collectionRuns.findMany.mockResolvedValue(mockRuns);

    const result = await listRecentCollectionRuns();
    expect(result).toEqual(mockRuns);
    expect(mockDb.query.collectionRuns.findMany).toHaveBeenCalled();
  });

  it('respects custom limit', async () => {
    mockDb.query.collectionRuns.findMany.mockResolvedValue([]);

    await listRecentCollectionRuns(5);
    const callArgs = mockDb.query.collectionRuns.findMany.mock.calls[0][0];
    expect(callArgs.limit).toBe(5);
  });
});
