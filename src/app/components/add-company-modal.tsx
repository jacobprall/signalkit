'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './button';
import { useToast } from './toast';

const ENRICHER_OPTIONS = [
  { id: 'homepage', label: 'Homepage', description: 'Scrape homepage, discover careers & login pages' },
  { id: 'careers', label: 'Careers Page', description: 'Scrape careers page for hiring signals' },
  { id: 'login', label: 'Login Page', description: 'Scrape login page for tech stack signals' },
] as const;

interface AddCompanyModalProps {
  onClose: () => void;
}

export function AddCompanyModal({ onClose }: AddCompanyModalProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [selectedEnrichers, setSelectedEnrichers] = useState<Set<string>>(new Set(['homepage']));
  const [detectHosting, setDetectHosting] = useState(true);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  function toggleEnricher(id: string) {
    setSelectedEnrichers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/companies/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          name: name.trim() || undefined,
          enrichers: [...selectedEnrichers],
          detectHosting,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add company');
      }
      const data = await res.json();
      showToast(data.message);
      router.refresh();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add company', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">Add Company</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
          <div>
            <label htmlFor="company-url" className="block text-sm font-medium text-slate-700 mb-1">
              Website URL
            </label>
            <input
              id="company-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="company-name" className="block text-sm font-medium text-slate-700 mb-1">
              Company Name <span className="text-slate-400 font-normal">(optional — auto-detected from domain)</span>
            </label>
            <input
              id="company-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-slate-700 mb-2">
              Scraping & Enrichment
            </legend>
            <div className="space-y-2">
              {ENRICHER_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    selectedEnrichers.has(opt.id)
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedEnrichers.has(opt.id)}
                    onChange={() => toggleEnricher(opt.id)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                    <p className="text-xs text-slate-500">{opt.description}</p>
                  </div>
                </label>
              ))}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  detectHosting
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={detectHosting}
                  onChange={() => setDetectHosting(!detectHosting)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">Hosting Detection</span>
                  <p className="text-xs text-slate-500">Detect hosting provider via DNS lookup</p>
                </div>
              </label>
            </div>
          </fieldset>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={!url.trim() || (selectedEnrichers.size === 0 && !detectHosting)}
            >
              Add & Start Scraping
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
