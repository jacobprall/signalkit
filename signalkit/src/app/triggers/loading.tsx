export default function TriggersLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded bg-slate-100" />
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <div className="h-9 w-28 animate-pulse rounded-md bg-slate-200" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
              <div className="h-5 flex-1 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-28 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
