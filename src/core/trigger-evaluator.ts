import crypto from 'crypto';
import { stableStringify } from '@/utils/stable-stringify';
import type { TriggerCondition, TriggerConditions } from './types';

export interface SignalForEvaluation {
  signal_type: string;
  value: Record<string, unknown>;
}

export interface CompanyForEvaluation {
  metadata: Record<string, unknown> | null;
  source_data: Record<string, unknown> | null;
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

function getCompanyFieldValue(
  company: CompanyForEvaluation,
  field: string,
): unknown {
  const merged: Record<string, unknown> = {
    ...(company.source_data ?? {}),
    ...(company.metadata ?? {}),
  };
  return getFieldValue(merged, field);
}

function compareNumeric(a: unknown, b: unknown, op: 'lt' | 'gt'): boolean {
  const numA = typeof a === 'number' ? a : Number(a);
  const numB = typeof b === 'number' ? b : Number(b);
  if (!Number.isFinite(numA) || !Number.isFinite(numB)) return false;
  return op === 'lt' ? numA < numB : numA > numB;
}

export function evaluateCondition(
  condition: TriggerCondition,
  signals: SignalForEvaluation[],
  company?: CompanyForEvaluation,
): boolean {
  const source = condition.source ?? 'signal';

  if (source === 'company') {
    if (!company) return false;
    if (!condition.field) return false;

    const fieldValue = getCompanyFieldValue(company, condition.field);

    switch (condition.operator) {
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
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
      case 'lt':
        return compareNumeric(fieldValue, condition.value, 'lt');
      case 'gt':
        return compareNumeric(fieldValue, condition.value, 'gt');
      default:
        return false;
    }
  }

  const signal = signals.find((s) => s.signal_type === condition.signal_type);

  if (condition.operator === 'exists') {
    return signal !== undefined;
  }

  if (!signal) return false;

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
    case 'lt':
      return compareNumeric(fieldValue, condition.value, 'lt');
    case 'gt':
      return compareNumeric(fieldValue, condition.value, 'gt');
    default:
      return false;
  }
}

export function evaluateTrigger(
  conditions: TriggerConditions,
  signals: SignalForEvaluation[],
  company?: CompanyForEvaluation,
): boolean {
  if (conditions.match === 'all') {
    return conditions.conditions.every((c) => evaluateCondition(c, signals, company));
  }
  return conditions.conditions.some((c) => evaluateCondition(c, signals, company));
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
