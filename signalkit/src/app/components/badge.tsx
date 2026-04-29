interface BadgeProps {
  label: string;
  variant?: 'hosting' | 'signal' | 'status' | 'batch';
}

const hostingColors: Record<string, string> = {
  heroku: 'bg-purple-100 text-purple-700',
  render: 'bg-teal-100 text-teal-700',
  vercel: 'bg-slate-900 text-white',
  netlify: 'bg-emerald-100 text-emerald-700',
  aws: 'bg-amber-100 text-amber-700',
  gcp: 'bg-blue-100 text-blue-700',
  azure: 'bg-sky-100 text-sky-700',
  fly: 'bg-violet-100 text-violet-700',
  railway: 'bg-pink-100 text-pink-700',
  cloudflare: 'bg-orange-100 text-orange-700',
};

const signalColors: Record<string, string> = {
  hosting_detected: 'bg-indigo-100 text-indigo-700',
  careers_page: 'bg-emerald-100 text-emerald-700',
  product_profile: 'bg-amber-100 text-amber-700',
  tech_stack: 'bg-sky-100 text-sky-700',
  website_analysis: 'bg-rose-100 text-rose-700',
};

const statusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  running: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-500',
};

function getColorClasses(label: string, variant?: string): string {
  const key = label.toLowerCase().replace(/\s+/g, '_');

  if (variant === 'hosting') return hostingColors[key] ?? 'bg-slate-100 text-slate-700';
  if (variant === 'signal') return signalColors[key] ?? 'bg-slate-100 text-slate-700';
  if (variant === 'status') return statusColors[key] ?? 'bg-slate-100 text-slate-600';
  if (variant === 'batch') return 'bg-indigo-50 text-indigo-600';

  return 'bg-slate-100 text-slate-700';
}

export function Badge({ label, variant }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getColorClasses(label, variant)}`}
    >
      {label}
    </span>
  );
}
