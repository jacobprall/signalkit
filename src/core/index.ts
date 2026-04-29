export type {
  CollectedRecord,
  DetectedSignal,
  ActionOutput,
  CollectorDefinition,
  DetectorDefinition,
  ActionDefinition,
  DeliveryDefinition,
  PluginDefinition,
} from './define-plugin';

export {
  defineCollector,
  defineDetector,
  defineAction,
  defineDelivery,
} from './define-plugin';

export { PluginRegistry } from './plugin-registry';
export type { PipelineContext } from './pipeline-context';

export type { Company, Signal, Trigger, ActionRun } from '@/db/schema';

export type {
  TriggerCondition,
  TriggerConditions,
  JobPayload,
} from './types';
