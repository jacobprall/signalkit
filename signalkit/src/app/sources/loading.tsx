export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-4 w-48 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
