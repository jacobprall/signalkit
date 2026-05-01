import type { ZodSchema } from 'zod';
import type { Company, Signal, ActionRun } from '@/db/schema';
import type { PipelineContext } from './pipeline-context';
import type { JobPayload } from './types';

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

export interface CollectedRecord {
  readonly source: string;
  readonly sourceId: string;
  readonly data: Record<string, unknown>;
}

export interface CollectorDefinition {
  readonly kind: 'collector';
  readonly name: string;
  readonly schema?: ZodSchema<Record<string, unknown>>;
  collect(ctx: PipelineContext): AsyncGenerator<CollectedRecord>;
}

export function defineCollector(
  config: Omit<CollectorDefinition, 'kind'>,
): CollectorDefinition {
  return { ...config, kind: 'collector' };
}

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

export interface DetectedSignal {
  readonly signalType: string;
  readonly source: string;
  readonly value: Record<string, unknown>;
  readonly confidence: number;
}

export interface DetectorDefinition {
  readonly kind: 'detector';
  readonly name: string;
  readonly schema?: ZodSchema;
  readonly triggersDetectors?: string[];
  detect(
    company: Company,
    ctx: PipelineContext,
  ): Promise<DetectedSignal[]>;
}

export function defineDetector(
  config: Omit<DetectorDefinition, 'kind'>,
): DetectorDefinition {
  return { ...config, kind: 'detector' };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export interface ActionOutput {
  readonly content: Record<string, unknown>;
}

export interface ActionDefinition {
  readonly kind: 'action';
  readonly name: string;
  readonly schema?: ZodSchema;
  execute(
    company: Company,
    signals: Signal[],
    config: Record<string, unknown>,
    ctx: PipelineContext,
  ): Promise<ActionOutput>;
}

export function defineAction(
  config: Omit<ActionDefinition, 'kind'>,
): ActionDefinition {
  return { ...config, kind: 'action' };
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export interface DeliveryDefinition {
  readonly kind: 'delivery';
  readonly name: string;
  deliver(
    actionRun: ActionRun,
    company: Company,
    config: Record<string, unknown>,
    ctx: PipelineContext,
  ): Promise<void>;
}

export function defineDelivery(
  config: Omit<DeliveryDefinition, 'kind'>,
): DeliveryDefinition {
  return { ...config, kind: 'delivery' };
}

// ---------------------------------------------------------------------------
// Enricher
// ---------------------------------------------------------------------------

export interface EnrichmentResult {
  readonly contentChanged: boolean;
  readonly data?: Record<string, unknown>;
  readonly followUp?: JobPayload[];
}

export interface EnricherDefinition {
  readonly kind: 'enricher';
  readonly name: string;
  readonly schema?: ZodSchema;
  readonly triggersDetectors?: string[];
  enrich(
    company: Company,
    input: Record<string, unknown>,
    ctx: PipelineContext,
  ): Promise<EnrichmentResult>;
}

export function defineEnricher(
  config: Omit<EnricherDefinition, 'kind'>,
): EnricherDefinition {
  return { ...config, kind: 'enricher' };
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

export type PluginDefinition =
  | CollectorDefinition
  | DetectorDefinition
  | ActionDefinition
  | DeliveryDefinition
  | EnricherDefinition;
