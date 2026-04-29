export default function ActionsLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
                  <div className="mt-1 h-3 w-28 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
