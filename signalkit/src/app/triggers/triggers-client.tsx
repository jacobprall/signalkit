'use client';

import { useState } from 'react';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import { Dialog } from '../components/dialog';
import { TriggerForm } from '../components/trigger-form';
import { useToast } from '../components/toast';

export interface ConditionRow {
  signal_type: string;
  field?: string;
  operator: string;
  value?: string;
}

export interface TriggerRow {
  id: string;
  name: string;
  conditions: { match: string; conditions: ConditionRow[] };
  actionType: string;
  isActive: boolean;
  createdAt: string;
}

function conditionsSummary(conditions: TriggerRow['conditions']): string {
  const parts = conditions.conditions.map((c) => {
    const field = c.field ? `.${c.field}` : '';
    const op = c.operator === 'exists' ? 'exists' : `${c.operator} ${c.value ?? ''}`;
    return `${c.signal_type}${field} ${op}`;
  });
  return parts.join(conditions.match === 'all' ? ' AND ' : ' OR ');
}

export function TriggersClient({ triggers: initial }: { triggers: TriggerRow[] }) {
  const [triggers, setTriggers] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TriggerRow | null>(null);
  const { showToast } = useToast();

  async function toggleActive(trigger: TriggerRow) {
    try {
      const res = await fetch(`/api/triggers/${trigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !trigger.isActive }),
      });
      if (!res.ok) throw new Error();
      setTriggers((prev) =>
        prev.map((t) => (t.id === trigger.id ? { ...t, isActive: !t.isActive } : t)),
      );
    } catch {
      showToast('Failed to update trigger', 'error');
    }
  }

  async function deleteTrigger(id: string) {
    try {
      const res = await fetch(`/api/triggers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setTriggers((prev) => prev.filter((t) => t.id !== id));
      showToast('Trigger deleted');
    } catch {
      showToast('Failed to delete trigger', 'error');
    }
  }

  function handleSaved() {
    window.location.reload();
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          + New Trigger
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {triggers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <p className="text-sm">No triggers configured yet</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowForm(true)}>
              Create your first trigger
            </Button>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Conditions</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Action</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {triggers.map((trigger) => (
                <tr key={trigger.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{trigger.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">
                    {conditionsSummary(trigger.conditions)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={trigger.actionType.replace(/_/g, ' ')} variant="signal" />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(trigger)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                        trigger.isActive ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform ${
                          trigger.isActive ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditing(trigger); setShowForm(true); }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTrigger(trigger.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <Dialog title={editing ? 'Edit Trigger' : 'New Trigger'} onClose={() => setShowForm(false)}>
          <TriggerForm
            trigger={editing ?? undefined}
            onClose={() => setShowForm(false)}
            onSaved={handleSaved}
          />
        </Dialog>
      )}
    </>
  );
}
