import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="mb-2 text-5xl font-bold text-slate-200">404</p>
      <h2 className="mb-2 text-lg font-semibold text-slate-900">Page not found</h2>
      <p className="mb-6 text-sm text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/companies"
        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        Go to Companies
      </Link>
    </div>
  );
}
