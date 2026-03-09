"use client";

interface RouteLoadingProps {
  label?: string;
}

export function RouteLoading({
  label = "Loading module...",
}: RouteLoadingProps) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">
            Compiling data and preparing the page.
          </p>
        </div>
      </div>
    </div>
  );
}
