'use client';

import { useState } from 'react';
import { Button } from './button';
import { useToast } from './toast';

interface SyncButtonProps {
  companyId?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SyncButton({ companyId, label = 'Sync', size = 'sm' }: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleSync() {
    setLoading(true);
    try {
      const url = companyId ? `/api/companies/${companyId}/sync` : '/api/sync';
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      showToast(companyId ? 'Company synced successfully' : 'Sync started for all companies');
    } catch {
      showToast('Sync failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size={size} loading={loading} onClick={handleSync}>
      {!loading && (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
        </svg>
      )}
      {label}
    </Button>
  );
}
