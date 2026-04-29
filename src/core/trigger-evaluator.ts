import crypto from 'crypto';
import { stableStringify } from '@/utils/stable-stringify';
import type { TriggerCondition, TriggerConditions } from './types';

export interface SignalForEvaluation {
  signal_type: string;
  value: Record<string, unknown>;
}

export function getFieldValue(value: Record<string, unknown>, field: string): unknown {
  const parts = field.split('.');
  let current: unknown = value;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function evaluateCondition(
  condition: TriggerCondition,
  signals: SignalForEvaluation[],
): boolean {
  const signal = signals.find((s) => s.signal_type === condition.signal_type);

  if (condition.operator === 'exists') {
    return signal !== undefined;
  }

  if (!signal) return false;

  // For non-`exists` operators a field is required. Without it we have
  // nothing meaningful to compare against, so reject rather than silently
  // matching `undefined === condition.value`.
  if (!condition.field) return false;

  const fieldValue = getFieldValue(signal.value, condition.field);

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'contains': {
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.includes(condition.value);
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(condition.value);
      }
      return false;
    }
    default:
      return false;
  }
}

export function evaluateTrigger(
  conditions: TriggerConditions,
  signals: SignalForEvaluation[],
): boolean {
  if (conditions.match === 'all') {
    return conditions.conditions.every((c) => evaluateCondition(c, signals));
  }
  return conditions.conditions.some((c) => evaluateCondition(c, signals));
}

// Canonicalize to ensure two semantically-equal signal sets always hash
// identically regardless of object key insertion order.
export function computeSignalHash(matchedSignals: SignalForEvaluation[]): string {
  const sorted = [...matchedSignals].sort((a, b) =>
    a.signal_type.localeCompare(b.signal_type),
  );
  const payload = stableStringify(
    sorted.map((s) => ({ type: s.signal_type, value: s.value })),
  );
  return crypto.createHash('sha256').update(payload).digest('hex');
}
