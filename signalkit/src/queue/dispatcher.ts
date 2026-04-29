import type { JobPayload } from '../core/types';

export type JobHandler = (payload: JobPayload) => Promise<void>;

export class JobDispatcher {
  private readonly handlers = new Map<string, JobHandler>();

  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
  }

  async dispatch(payload: JobPayload): Promise<void> {
    const handler = this.handlers.get(payload.type);
    if (!handler) {
      throw new Error(`No handler registered for job type: ${payload.type}`);
    }
    await handler(payload);
  }

  hasHandler(jobType: string): boolean {
    return this.handlers.has(jobType);
  }
}
