export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Opening your dashboard
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Loading your school workspace...
        </p>
      </div>
    </div>
  );
}
