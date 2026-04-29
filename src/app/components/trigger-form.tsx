'use client';

import { useId, useState } from 'react';
import {
  ACTION_TYPES,
  SIGNAL_TYPES,
  TRIGGER_OPERATORS,
} from '@/core/catalog';
import { Button } from './button';
import { useToast } from './toast';

interface ConditionRow {
  rid: string; // stable React key (independent of array index)
  signal_type: string;
  field: string;
  operator: string;
  value: string;
}

interface TriggerInput {
  signal_type: string;
  field?: string;
  operator: string;
  value?: unknown;
}

interface TriggerFormProps {
  trigger?: {
    id: string;
    name: string;
    conditions: { match: string; conditions: TriggerInput[] };
    actionType: string;
    isActive: boolean;
  };
  onClose: () => void;
  onSaved?: () => void;
}

const SIGNAL_TYPE_OPTIONS = [...SIGNAL_TYPES] as readonly string[];
const ACTION_TYPE_OPTIONS = [...ACTION_TYPES] as readonly string[];
const OPERATOR_OPTIONS = [...TRIGGER_OPERATORS] as readonly string[];

function newRid(): string {
  return Math.random().toString(36).slice(2, 11);
}

function emptyCondition(): ConditionRow {
  return {
    rid: newRid(),
    signal_type: SIGNAL_TYPE_OPTIONS[0],
    field: '',
    operator: OPERATOR_OPTIONS[0],
    value: '',
  };
}

// Best-effort coercion of the free-text "value" input into the actual
// type the operator expects: booleans, numbers, JSON, or string.
function coerceValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through */
    }
  }
  return trimmed;
}

export function TriggerForm({ trigger, onClose, onSaved }: TriggerFormProps) {
  const formId = useId();
  const [name, setName] = useState(trigger?.name ?? '');
  const [matchMode, setMatchMode] = useState<'all' | 'any'>(
    (trigger?.conditions?.match as 'all' | 'any') ?? 'all',
  );
  const [conditions, setConditions] = useState<ConditionRow[]>(() =>
    trigger?.conditions?.conditions?.length
      ? trigger.conditions.conditions.map((c) => ({
          rid: newRid(),
          signal_type: c.signal_type,
          field: c.field ?? '',
          operator: c.operator,
          value:
            c.value === undefined
              ? ''
              : typeof c.value === 'string'
                ? c.value
                : JSON.stringify(c.value),
        }))
      : [emptyCondition()],
  );
  const [actionType, setActionType] = useState(
    trigger?.actionType ?? ACTION_TYPE_OPTIONS[0],
  );
  const [isActive, setIsActive] = useState(trigger?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  function updateCondition(rid: string, partial: Partial<ConditionRow>) {
    setConditions((prev) =>
      prev.map((c) => (c.rid === rid ? { ...c, ...partial } : c)),
    );
  }

  function removeCondition(rid: string) {
    setConditions((prev) => prev.filter((c) => c.rid !== rid));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const body = {
        name,
        conditions: conditions.map((c) => ({
          signal_type: c.signal_type,
          field: c.field || undefined,
          operator: c.operator,
          value: c.operator === 'exists' ? undefined : coerceValue(c.value),
        })),
        match: matchMode,
        action_type: actionType,
        is_active: isActive,
      };
      const url = trigger ? `/api/triggers/${trigger.id}` : '/api/triggers';
      const method = trigger ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast(trigger ? 'Trigger updated' : 'Trigger created');
      onSaved?.();
      onClose();
    } catch {
      showToast('Failed to save trigger', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="e.g. Heroku companies in latest batch"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">Conditions</label>
          <select
            value={matchMode}
            onChange={(e) => setMatchMode(e.target.value as 'all' | 'any')}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">Match all</option>
            <option value="any">Match any</option>
          </select>
        </div>

        <div className="space-y-2">
          {conditions.map((cond) => (
            <div key={cond.rid} className="flex items-center gap-2">
              <select
                value={cond.signal_type}
                onChange={(e) => updateCondition(cond.rid, { signal_type: e.target.value })}
                className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              >
                {SIGNAL_TYPE_OPTIONS.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              <input
                value={cond.field}
                onChange={(e) => updateCondition(cond.rid, { field: e.target.value })}
                placeholder="field"
                className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <select
                value={cond.operator}
                onChange={(e) => updateCondition(cond.rid, { operator: e.target.value })}
                className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              >
                {OPERATOR_OPTIONS.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              <input
                value={cond.value}
                onChange={(e) => updateCondition(cond.rid, { value: e.target.value })}
                placeholder={cond.operator === 'exists' ? '(unused)' : 'value'}
                disabled={cond.operator === 'exists'}
                className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              />
              {conditions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCondition(cond.rid)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Remove condition"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setConditions((prev) => [...prev, emptyCondition()])}
          className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          + Add condition
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Action Type</label>
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {ACTION_TYPE_OPTIONS.map((at) => (
            <option key={at} value={at}>{at.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          onClick={() => setIsActive(!isActive)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
            isActive ? 'bg-indigo-600' : 'bg-slate-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform ${
              isActive ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className="text-sm text-slate-700">Active</span>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {trigger ? 'Update Trigger' : 'Create Trigger'}
        </Button>
      </div>
    </form>
  );
}
