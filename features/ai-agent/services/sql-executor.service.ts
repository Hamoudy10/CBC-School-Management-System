import { createSupabaseAdminClient } from "@/lib/supabase/server";

export interface SqlExecutionResult {
  success: boolean;
  rows: Record<string, unknown>[];
  count: number;
  error?: string;
  executionMs: number;
}

const SCHOOL_SCOPED_TABLES = new Set([
  "users",
  "students",
  "staff",
  "classes",
  "subjects",
  "learning_areas",
  "timetable_slots",
  "attendance_records",
  "assessments",
  "assessment_results",
  "fee_structures",
  "student_fees",
  "payments",
  "discipline_records",
  "announcements",
  "messages",
  "report_cards",
  "academic_years",
  "terms",
  "ai_agent_sessions",
  "ai_agent_actions",
  "mpesa_stk_requests",
  "mpesa_c2b_transactions",
  "student_guardians",
  "invoices",
]);

const TABLE_ALIAS_PATTERN = /\b(FROM|JOIN)\s+([a-z_][a-z0-9_]*)\s+(?:AS\s+)?([a-zA-Z][a-zA-Z0-9_]*)\b/gi;

function injectSchoolFilter(sql: string, schoolId: string): string {
  if (!schoolId) return sql;

  // Extract all table references
  const tables: string[] = [];
  let match: RegExpExecArray | null;
  const fromJoinRegex = /\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)\b/gi;
  while ((match = fromJoinRegex.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    if (SCHOOL_SCOPED_TABLES.has(tableName) && !tables.includes(tableName)) {
      tables.push(tableName);
    }
  }

  if (tables.length === 0) return sql;

  // Inject school_id filter into WHERE clause or append if no WHERE
  const whereIndex = sql.toUpperCase().lastIndexOf("WHERE");
  if (whereIndex === -1) {
    // No WHERE clause — add one with school_id for each scoped table
    const conditions = tables.map((t) => `${t}.school_id = '${schoolId}'`);
    return `${sql} WHERE ${conditions.join(" AND ")}`;
  }

  // Has WHERE — inject for each scoped table that doesn't already have a school_id filter
  const upperSql = sql.toUpperCase();
  const beforeWhere = sql.slice(0, whereIndex);
  const afterWhere = sql.slice(whereIndex + 5); // skip "WHERE"

  const newConditions = tables.filter((t) => {
    const scopedCheck = new RegExp(`\\b${t}\\.school_id\\s*=`, "i");
    const bareCheck = new RegExp(`\\bschool_id\\s*=`, "i");
    return !scopedCheck.test(afterWhere) && !bareCheck.test(afterWhere);
  });

  if (newConditions.length === 0) return sql;

  const additional = newConditions.map((t) => `${t}.school_id = '${schoolId}'`).join(" AND ");
  return `${beforeWhere}WHERE (${afterWhere.trim()}) AND ${additional}`;
}

export async function executeSqlQuery(
  sql: string,
  schoolId?: string,
): Promise<SqlExecutionResult> {
  const startedAt = Date.now();

  if (!sql.trim().toUpperCase().startsWith("SELECT") && !sql.trim().toUpperCase().startsWith("WITH")) {
    return {
      success: false,
      rows: [],
      count: 0,
      error: "Only SELECT queries are allowed.",
      executionMs: Date.now() - startedAt,
    };
  }

  const finalSql = schoolId ? injectSchoolFilter(sql, schoolId) : sql;

  try {
    const supabase = await createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("exec_readonly_sql", {
      query_text: finalSql,
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
