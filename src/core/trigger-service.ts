import type { TriggerConditions, ActionChainStep } from './types';
import {
  evaluateTrigger,
  computeSignalHash,
  type CompanyForEvaluation,
  type SignalForEvaluation,
} from './trigger-evaluator';

export type { CompanyForEvaluation, SignalForEvaluation };

export interface TriggerRecord {
  id: string;
  name: string;
  conditions: TriggerConditions;
  actionType: string;
  actionConfig: Record<string, unknown>;
  // When set, defines an ordered chain of actions; actionType/actionConfig are ignored.
  actions?: ActionChainStep[];
  deliveries: Array<{ type: string; config: Record<string, unknown> }>;
  isActive: boolean;
}

export interface ITriggerRepository {
  findActive(): Promise<TriggerRecord[]>;
}

export interface ITriggerRunRepository {
  exists(triggerId: string, companyId: string, signalHash: string): Promise<boolean>;
  create(run: {
    triggerId: string;
    companyId: string;
    signalHash: string;
    actionRunId: string;
  }): Promise<string>;
}

export interface ISignalSource {
  findByCompany(companyId: string): Promise<SignalForEvaluation[]>;
}

export interface ICompanySource {
  findById(companyId: string): Promise<CompanyForEvaluation | null>;
}

export interface TriggeredAction {
  triggerId: string;
  companyId: string;
  signalHash: string;
  matchedSignals: SignalForEvaluation[];
  actionType: string;
  actionConfig: Record<string, unknown>;
  // Set when the trigger defines a multi-step chain; takes precedence over actionType/actionConfig.
  actions?: ActionChainStep[];
  deliveries: Array<{ type: string; config: Record<string, unknown> }>;
}

export class TriggerEvaluationService {
  constructor(
    private readonly triggerRepo: ITriggerRepository,
    private readonly triggerRunRepo: ITriggerRunRepository,
    private readonly signalSource: ISignalSource,
    private readonly companySource?: ICompanySource,
  ) {}

  async evaluate(companyId: string): Promise<TriggeredAction[]> {
    const [signals, triggers, company] = await Promise.all([
      this.signalSource.findByCompany(companyId),
      this.triggerRepo.findActive(),
      this.companySource?.findById(companyId) ?? Promise.resolve(null),
    ]);

    if (triggers.length === 0) return [];

    const companyData: CompanyForEvaluation | undefined = company ?? undefined;
    const results: TriggeredAction[] = [];

    for (const trigger of triggers) {
      const matched = evaluateTrigger(trigger.conditions, signals, companyData);
      if (!matched) continue;

      const matchedSignals = signals.filter((s) =>
        trigger.conditions.conditions.some((c) =>
          (c.source ?? 'signal') === 'signal' && c.signal_type === s.signal_type,
        ),
      );

      const signalHash = computeSignalHash(matchedSignals);

      const alreadyRun = await this.triggerRunRepo.exists(
        trigger.id,
        companyId,
        signalHash,
      );
      if (alreadyRun) continue;

      results.push({
        triggerId: trigger.id,
        companyId,
        signalHash,
        matchedSignals,
        actionType: trigger.actionType,
        actionConfig: trigger.actionConfig,
        actions: trigger.actions,
        deliveries: trigger.deliveries,
      });
    }

    return results;
  }

  async recordRun(run: {
    triggerId: string;
    companyId: string;
    signalHash: string;
    actionRunId: string;
  }): Promise<string> {
    return this.triggerRunRepo.create(run);
  }
}
