"use client";

interface RouteLoadingProps {
  label?: string;
  hint?: string;
}

export function RouteLoading({
  label = "Loading module...",
  hint = "Compiling code, warming data, and preparing the next view.",
}: RouteLoadingProps) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.12),_transparent_35%),linear-gradient(135deg,_#f8fafc,_#eefdfb)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-slate-100">
        <div className="animate-route-progress h-full w-1/3 rounded-full bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-3 py-1 text-xs font-medium text-teal-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
            Navigating
          </div>

          <div>
            <p className="text-xl font-semibold text-slate-900">{label}</p>
            <p className="mt-2 max-w-xl text-sm text-slate-500">{hint}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {["Loading shell", "Preparing content", "Almost ready"].map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/70 bg-white/70 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  0{index + 1}
                </div>
                <div className="mt-3 h-2 w-20 rounded-full bg-slate-200" />
                <div className="mt-4 text-sm font-medium text-slate-700">{step}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 animate-pulse rounded-2xl bg-gradient-to-r from-slate-100 via-white to-slate-100"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
