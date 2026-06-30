"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EngagementError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Parent engagement error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center p-8 max-w-md">
        <h2 className="text-xl font-bold text-secondary-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-secondary-600 mb-4">
          {error.message || "An unexpected error occurred."}
        </p>
        <p className="text-xs text-secondary-400 mb-6 font-mono">
          {error.digest ? `Error ID: ${error.digest}` : ""}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
