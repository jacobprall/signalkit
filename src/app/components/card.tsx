import { type ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, children, action, className = '' }: CardProps) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}
