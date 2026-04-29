export default function PipelineLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-28 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-slate-100" />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-8 w-12 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="mb-3 h-6 w-36 animate-pulse rounded bg-slate-200" />
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-36 animate-pulse rounded bg-slate-100" />
              <div className="h-5 flex-1 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
