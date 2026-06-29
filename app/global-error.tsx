"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-secondary-50">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold text-secondary-900 mb-4">
            Something went wrong
          </h1>
          <p className="text-secondary-600 mb-6">
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={reset}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
