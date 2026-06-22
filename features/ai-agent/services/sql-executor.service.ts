import { createSupabaseAdminClient } from "@/lib/supabase/server";

export interface SqlExecutionResult {
  success: boolean;
  rows: Record<string, unknown>[];
  count: number;
  error?: string;
  executionMs: number;
}

export async function executeSqlQuery(sql: string): Promise<SqlExecutionResult> {
  const startedAt = Date.now();

  try {
    const supabase = await createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("exec_readonly_sql", {
      query_text: sql,
    });

    if (error) {
      return {
        success: false,
        rows: [],
        count: 0,
        error: error.message,
        executionMs: Date.now() - startedAt,
      };
    }

    const rows = (Array.isArray(data) ? data : [data]).filter(
      (r: unknown) => r !== null && r !== undefined,
    ) as Record<string, unknown>[];

    return {
      success: true,
      rows,
      count: rows.length,
      executionMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      success: false,
      rows: [],
      count: 0,
      error: err instanceof Error ? err.message : "Unknown error executing SQL",
      executionMs: Date.now() - startedAt,
    };
  }
}
