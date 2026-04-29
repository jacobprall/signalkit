import { describe, it, expect } from 'vitest';
import { createDashboardDelivery } from '@/deliveries/dashboard';
import type { PipelineContext } from '@/core/pipeline-context';
import { makeCompany } from '../_helpers/fixtures';

const ctx = {} as PipelineContext;

describe('DashboardDelivery', () => {
  it("name is 'dashboard'", () => {
    const delivery = createDashboardDelivery();
    expect(delivery.name).toBe('dashboard');
  });

  it('deliver completes without error', async () => {
    const delivery = createDashboardDelivery();
    await expect(
      delivery.deliver(
        {
          id: 'ar-1',
          triggerId: null,
          companyId: 'c-1',
          signalIds: [],
          actionType: 'prospect_brief',
          status: 'completed',
          input: {},
          output: { summary: 'ok' },
          error: null,
          createdAt: new Date(),
          completedAt: new Date(),
        },
        makeCompany(),
        {},
        ctx,
      ),
    ).resolves.toBeUndefined();
  });
});
