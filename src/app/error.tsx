'use client';

import { Button } from './components/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <svg className="mb-4 h-12 w-12 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <h2 className="mb-2 text-lg font-semibold text-slate-900">Something went wrong</h2>
      <p className="mb-6 max-w-md text-sm text-slate-500">
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
