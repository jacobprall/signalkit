'use client';

import { useState } from 'react';
import { Button } from './button';
import { useToast } from './toast';

interface ActionButtonProps {
  companyId: string;
  actionType: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function ActionButton({
  companyId,
  actionType,
  label,
  variant = 'secondary',
  size = 'sm',
}: ActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleAction() {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType }),
      });
      if (!res.ok) throw new Error('Action failed');
      showToast(`${label} started successfully`);
    } catch {
      showToast(`${label} failed. Please try again.`, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant={variant} size={size} loading={loading} onClick={handleAction}>
      {label}
    </Button>
  );
}
