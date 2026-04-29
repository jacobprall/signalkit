import { describe, it, expect, vi } from 'vitest';
import { JobDispatcher } from '@/queue/dispatcher';
import type { JobPayload } from '@/core/types';

describe('JobDispatcher', () => {
  it('dispatches a registered handler with the correct payload', async () => {
    const dispatcher = new JobDispatcher();
    const handler = vi.fn().mockResolvedValue(undefined);
    const payload: JobPayload = { type: 'evaluate_triggers', companyId: 'co_123' };

    dispatcher.registerHandler('evaluate_triggers', handler);
    await dispatcher.dispatch(payload);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('throws a descriptive error when dispatching an unregistered type', async () => {
    const dispatcher = new JobDispatcher();
    const payload: JobPayload = {
      type: 'deliver',
      actionRunId: 'ar_1',
      deliveryType: 'slack',
      deliveryConfig: {},
    };

    await expect(dispatcher.dispatch(payload)).rejects.toThrow(/deliver/);
    await expect(dispatcher.dispatch(payload)).rejects.toThrow(/no handler/i);
  });

  it('hasHandler returns true for registered types', () => {
    const dispatcher = new JobDispatcher();
    dispatcher.registerHandler('collect:yc_directory', vi.fn());

    expect(dispatcher.hasHandler('collect:yc_directory')).toBe(true);
  });

  it('hasHandler returns false for unregistered types', () => {
    const dispatcher = new JobDispatcher();

    expect(dispatcher.hasHandler('collect:yc_directory')).toBe(false);
  });

  it('supports multiple handlers for different job types', async () => {
    const dispatcher = new JobDispatcher();
    const handlerA = vi.fn().mockResolvedValue(undefined);
    const handlerB = vi.fn().mockResolvedValue(undefined);

    dispatcher.registerHandler('evaluate_triggers', handlerA);
    dispatcher.registerHandler('deliver', handlerB);

    const payloadA: JobPayload = { type: 'evaluate_triggers', companyId: 'co_1' };
    const payloadB: JobPayload = {
      type: 'deliver',
      actionRunId: 'ar_1',
      deliveryType: 'slack',
      deliveryConfig: {},
    };

    await dispatcher.dispatch(payloadA);
    await dispatcher.dispatch(payloadB);

    expect(handlerA).toHaveBeenCalledOnce();
    expect(handlerB).toHaveBeenCalledOnce();
    expect(handlerA).toHaveBeenCalledWith(payloadA);
    expect(handlerB).toHaveBeenCalledWith(payloadB);
  });

  it('propagates handler errors to the caller', async () => {
    const dispatcher = new JobDispatcher();
    const error = new Error('handler failure');
    dispatcher.registerHandler('evaluate_triggers', vi.fn().mockRejectedValue(error));

    const payload: JobPayload = { type: 'evaluate_triggers', companyId: 'co_1' };

    await expect(dispatcher.dispatch(payload)).rejects.toThrow('handler failure');
  });

  it('allows replacing a handler for the same type', async () => {
    const dispatcher = new JobDispatcher();
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);

    dispatcher.registerHandler('evaluate_triggers', first);
    dispatcher.registerHandler('evaluate_triggers', second);

    const payload: JobPayload = { type: 'evaluate_triggers', companyId: 'co_1' };
    await dispatcher.dispatch(payload);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
