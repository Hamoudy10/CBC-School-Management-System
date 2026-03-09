export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded bg-gray-200" />
        <div className="h-4 w-80 max-w-full rounded bg-gray-100" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="h-4 w-24 rounded bg-gray-100" />
            <div className="mt-4 h-8 w-16 rounded bg-gray-200" />
            <div className="mt-4 h-3 w-full rounded bg-gray-100" />
            <div className="mt-2 h-3 w-2/3 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="h-10 w-full rounded bg-gray-100" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 rounded bg-gray-50" />
          ))}
        </div>
      </div>
    </div>
  );
}
