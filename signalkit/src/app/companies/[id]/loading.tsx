export default function CompanyDetailLoading() {
  return (
    <div>
      <div className="mb-4 h-5 w-36 animate-pulse rounded bg-slate-200" />

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 flex gap-3">
              <div className="h-5 w-28 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-16 animate-pulse rounded-md bg-slate-200" />
            <div className="h-8 w-28 animate-pulse rounded-md bg-slate-200" />
            <div className="h-8 w-32 animate-pulse rounded-md bg-slate-200" />
          </div>
        </div>
      </div>

      <div className="mb-3 h-6 w-20 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
