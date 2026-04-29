import type { Company, Signal, ActionRun } from '@/db/schema';
import type { UpsertSignalInput } from '@/db/queries/signals';
import type { CreateActionRunInput } from '@/db/queries/action-runs';
import type { JobPayload } from './types';

export interface PipelineContext {
  getCompany(companyId: string): Promise<Company>;
  upsertSignal(input: UpsertSignalInput): Promise<{ signalId: string; isNew: boolean; changed: boolean }>;
  findSignalsByCompany(companyId: string): Promise<Signal[]>;
  findSignalsByIds(ids: readonly string[]): Promise<Signal[]>;
  createActionRun(input: CreateActionRunInput): Promise<ActionRun>;
  markActionRunRunning(id: string): Promise<void>;
  markActionRunCompleted(id: string, output: Record<string, unknown>): Promise<void>;
  markActionRunFailed(id: string, error: string): Promise<void>;
  findActionRun(id: string): Promise<ActionRun | null>;
  getPageText(companyId: string, pageType: string): Promise<string | null>;
  enqueue(job: JobPayload): Promise<void>;
}
