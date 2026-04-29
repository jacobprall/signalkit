import { z } from 'zod';
import {
  ACTION_TYPES,
  CONDITION_SOURCES,
  DELIVERY_TYPES,
  HOSTING_PROVIDERS,
  SIGNAL_TYPES,
  TRIGGER_EVALUATION_MODES,
  TRIGGER_MATCH_MODES,
  TRIGGER_OPERATORS,
} from '@/core/catalog';

// ---------------------------------------------------------------------------
// Trigger CRUD
// ---------------------------------------------------------------------------

export const TriggerConditionShape = z.object({
  source: z.enum(CONDITION_SOURCES).optional(),
  signal_type: z.string(),
  field: z.string().optional(),
  operator: z.enum(TRIGGER_OPERATORS),
  value: z.unknown().optional(),
});

export const TriggerDeliveryShape = z.object({
  type: z.enum(DELIVERY_TYPES),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const CreateTriggerSchema = z.object({
  name: z.string().min(1).max(200),
  conditions: z.array(TriggerConditionShape).min(1),
  match: z.enum(TRIGGER_MATCH_MODES).default('all'),
  action_type: z.enum(ACTION_TYPES),
  action_config: z.record(z.string(), z.unknown()).default({}),
  deliveries: z
    .array(TriggerDeliveryShape)
    .default([{ type: 'dashboard', config: {} }]),
  evaluation: z.enum(TRIGGER_EVALUATION_MODES).default('on_new_signal'),
});

export type CreateTriggerInput = z.infer<typeof CreateTriggerSchema>;

export const UpdateTriggerSchema = CreateTriggerSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type UpdateTriggerInput = z.infer<typeof UpdateTriggerSchema>;

// ---------------------------------------------------------------------------
// Per-company actions API (manual one-off trigger)
// ---------------------------------------------------------------------------

export const TriggerActionSchema = z.object({
  actionType: z.enum(ACTION_TYPES),
  config: z.record(z.string(), z.unknown()).default({}),
  deliveries: z.array(TriggerDeliveryShape).default([{ type: 'dashboard', config: {} }]),
});

export type TriggerActionInput = z.infer<typeof TriggerActionSchema>;

// ---------------------------------------------------------------------------
// Query-param schemas (shared)
// ---------------------------------------------------------------------------

const intFromQuery = (max: number, fallback: number) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (v === undefined) return fallback;
      const raw = Array.isArray(v) ? v[0] : v;
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) ? Math.max(0, Math.min(n, max)) : fallback;
    });

const stringArrayFromQuery = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]));

const enumArrayFromQuery = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v): string[] =>
      v === undefined ? [] : Array.isArray(v) ? v : [v],
    )
    .transform((arr): Array<T[number]> => {
      const allowed = new Set<string>(values);
      return arr.filter((s): s is T[number] => allowed.has(s));
    });

export const CompaniesQuerySchema = z.object({
  hosting: enumArrayFromQuery(HOSTING_PROVIDERS),
  batch: stringArrayFromQuery,
  industry: stringArrayFromQuery,
  signalType: enumArrayFromQuery(SIGNAL_TYPES),
  search: z.string().max(200).optional(),
  q: z.string().max(200).optional(),
  teamSizeMin: intFromQuery(10_000, 0).optional(),
  teamSizeMax: intFromQuery(10_000, 10_000).optional(),
  limit: intFromQuery(100, 50),
  offset: intFromQuery(100_000, 0),
  page: intFromQuery(100_000, 1),
});

export type CompaniesQuery = z.infer<typeof CompaniesQuerySchema>;

export const SignalsQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  signalType: z.enum(SIGNAL_TYPES).optional(),
  limit: intFromQuery(100, 50),
  offset: intFromQuery(100_000, 0),
});

export type SignalsQuery = z.infer<typeof SignalsQuerySchema>;

export const ActionRunsQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  actionType: z.enum(ACTION_TYPES).optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  limit: intFromQuery(100, 50),
});

export type ActionRunsQuery = z.infer<typeof ActionRunsQuerySchema>;
