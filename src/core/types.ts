import type {
  Company,
  Signal,
  Trigger,
  ActionRun,
} from '@/db/schema';
import type {
  ActionType,
  ConditionSource,
  DeliveryType,
  PageType,
  SignalType,
  TriggerMatchMode,
  TriggerOperator,
} from './catalog';

export type { Company, Signal, Trigger, ActionRun };

// ---------------------------------------------------------------------------
// Action chain types
// ---------------------------------------------------------------------------

export interface ActionChainStep {
  readonly action_type: string;
  readonly action_config: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Job payload discriminated union
// ---------------------------------------------------------------------------

export type JobPayload =
  | { readonly type: 'collect:yc_directory' }
  | { readonly type: 'enrich'; readonly enricher: string; readonly companyId: string; readonly input: Record<string, unknown> }
  | { readonly type: 'detect:hosting'; readonly companyId: string }
  | { readonly type: 'detect:website_analysis'; readonly companyId: string }
  | { readonly type: 'evaluate_triggers'; readonly companyId: string }
  | { readonly type: 'evaluate_triggers:fanout' }
  | {
      readonly type: 'action:run';
      readonly actionRunId: string;
      readonly triggerId: string | null;
      readonly companyId: string;
      readonly signalIds: readonly string[];
      readonly actionType: string;
      readonly config: Record<string, unknown>;
      readonly deliveries: ReadonlyArray<{
        readonly type: string;
        readonly config: Record<string, unknown>;
      }>;
    }
  | {
      readonly type: 'action:run_chain';
      readonly chainId: string;
      readonly triggerId: string | null;
      readonly companyId: string;
      readonly steps: readonly ActionChainStep[];
      readonly deliveries: ReadonlyArray<{
        readonly type: string;
        readonly config: Record<string, unknown>;
      }>;
    }
  | {
      readonly type: 'deliver';
      readonly actionRunId: string;
      readonly deliveryType: string;
      readonly deliveryConfig: Record<string, unknown>;
    };

// ---------------------------------------------------------------------------
// Trigger condition types
// ---------------------------------------------------------------------------

export interface TriggerCondition {
  readonly source?: ConditionSource;
  readonly signal_type: SignalType | string;
  readonly field?: string;
  readonly operator: TriggerOperator;
  readonly value?: unknown;
}

export interface TriggerConditions {
  readonly match: TriggerMatchMode;
  readonly conditions: readonly TriggerCondition[];
}
