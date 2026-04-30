import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClayDelivery } from '@/deliveries/clay';
import type { PipelineContext } from '@/core/pipeline-context';
import { makeCompany } from '../_helpers/fixtures';
import type { ActionRun } from '@/db/schema';

const ctx = {} as PipelineContext;

function makeActionRun(overrides: Partial<ActionRun> = {}): ActionRun {
  return {
    id: 'ar-1',
    triggerId: null,
    companyId: 'company-1',
    signalIds: [],
    actionType: 'prospect_brief',
    status: 'completed',
    input: {},
    output: { summary: 'Brief headline', infrastructure_assessment: 'x' },
    error: null,
    chainId: null,
    stepIndex: null,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    completedAt: new Date('2026-04-01T01:00:00Z'),
    ...overrides,
  };
}

describe('ClayDelivery', () => {
  let prevAppBase: string | undefined;

  beforeEach(() => {
    prevAppBase = process.env.APP_BASE_URL;
    delete process.env.APP_BASE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (prevAppBase === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = prevAppBase;
  });

  it("name is 'clay'", () => {
    const delivery = createClayDelivery();
    expect(delivery.name).toBe('clay');
  });

  it('POSTs JSON to webhookUrl with flat Clay-friendly fields', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    const delivery = createClayDelivery(fetcher);
    const company = makeCompany({ id: 'c-uuid', name: 'Acme', domain: 'acme.com' });
    const run = makeActionRun({
      id: 'run-uuid',
      companyId: 'c-uuid',
      output: { summary: 'S', foo: 1 },
    });

    await delivery.deliver(run, company, { webhookUrl: 'https://app.clay.com/webhooks/test' }, ctx);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://app.clay.com/webhooks/test');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBeUndefined();

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      company_name: 'Acme',
      company_domain: 'acme.com',
      company_url: 'https://acme.com',
      action_type: 'prospect_brief',
      headline: 'S',
      output: { summary: 'S', foo: 1 },
      signalkit_action_run_id: 'run-uuid',
      completed_at: '2026-04-01T01:00:00.000Z',
    });
    expect(body).not.toHaveProperty('signalkit_company_url');
  });

  it('uses APP_BASE_URL for signalkit_company_url when set', async () => {
    process.env.APP_BASE_URL = 'https://signalkit.example.com/';
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    const delivery = createClayDelivery(fetcher);
    const company = makeCompany({ id: 'c-1' });
    await delivery.deliver(makeActionRun(), company, { webhookUrl: 'https://clay.test/hook' }, ctx);

    const init = fetcher.mock.calls[0]![1];
    const body = JSON.parse(init.body);
    expect(body.signalkit_company_url).toBe('https://signalkit.example.com/companies/c-1');
  });

  it('adds Authorization Bearer when authToken is set', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    const delivery = createClayDelivery(fetcher);
    await delivery.deliver(
      makeActionRun(),
      makeCompany(),
      { webhookUrl: 'https://clay.test/hook', authToken: 'secret-token' },
      ctx,
    );

    const init = fetcher.mock.calls[0]![1];
    expect(init.headers.Authorization).toBe('Bearer secret-token');
  });

  it('headline falls back per action type fields', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    const delivery = createClayDelivery(fetcher);

    await delivery.deliver(
      makeActionRun({
        actionType: 'outreach_draft',
        output: { subject: 'Subj', body: 'Hi' },
      }),
      makeCompany(),
      { webhookUrl: 'https://clay.test/h' },
      ctx,
    );
    expect(JSON.parse(fetcher.mock.calls[0]![1].body).headline).toBe('Subj');

    await delivery.deliver(
      makeActionRun({
        actionType: 'cost_analysis',
        output: { recommendation: 'Rec', current_provider: 'x' },
      }),
      makeCompany(),
      { webhookUrl: 'https://clay.test/h' },
      ctx,
    );
    expect(JSON.parse(fetcher.mock.calls[1]![1].body).headline).toBe('Rec');

    await delivery.deliver(
      makeActionRun({
        actionType: 'change_alert',
        output: { change_description: 'Changed', significance: 'x' },
      }),
      makeCompany(),
      { webhookUrl: 'https://clay.test/h' },
      ctx,
    );
    expect(JSON.parse(fetcher.mock.calls[2]![1].body).headline).toBe('Changed');
  });

  it('throws on non-OK response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'bad',
    });
    const delivery = createClayDelivery(fetcher);

    await expect(
      delivery.deliver(makeActionRun(), makeCompany(), { webhookUrl: 'https://clay.test/h' }, ctx),
    ).rejects.toThrow('Clay webhook failed: 422 bad');
  });

  it('rejects invalid config', async () => {
    const fetcher = vi.fn();
    const delivery = createClayDelivery(fetcher);

    await expect(
      delivery.deliver(makeActionRun(), makeCompany(), { webhookUrl: 'not-a-url' }, ctx),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
