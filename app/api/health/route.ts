import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Check database connectivity
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("health_check").select("id").limit(1).maybeSingle();
    if (error && !error.message.includes("relation") && !error.message.includes("does not exist")) {
      checks.database = `unhealthy: ${error.message}`;
      healthy = false;
    } else {
      checks.database = "ok";
    }
  } catch (err) {
    checks.database = `unhealthy: ${err instanceof Error ? err.message : "unknown"}`;
    healthy = false;
  }

  const statusCode = healthy ? 200 : 503;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    },
    { status: statusCode },
  );
}
