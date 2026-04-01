'use client';

import React from 'react';
import { SWRConfig } from 'swr';

type FetcherResult<T> = Promise<T>;

const fetcher = async <T,>(url: string): FetcherResult<T> => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  return response.json() as FetcherResult<T>;
};

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 10000,
        keepPreviousData: true,
        shouldRetryOnError: false,
        // Cache data for 5 minutes to avoid unnecessary refetches
        provider: () => new Map(),
      }}
    >
      {children}
    </SWRConfig>
  );
}
