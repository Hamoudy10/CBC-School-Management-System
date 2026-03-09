// lib/supabase/client.ts
// ============================================================
// Supabase Client Configuration
// - Browser client for frontend usage
// - Server client for API routes / middleware
// - Admin client for privileged operations (server-only)
// ============================================================

import { createBrowserClient } from "@supabase/ssr";

// ============================================================
// Browser Client (used in React components)
// ============================================================
export function createSupabaseBrowserClient() {
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Legacy alias used by existing services
export const createClient = createSupabaseBrowserClient;
