import { Parser, type AST } from "node-sql-parser";

const parser = new Parser();
const PARSE_OPTIONS = { database: "postgresql" as const };

export interface AnalysisResult {
  safe: boolean;
  sql: string;
  warnings: string[];
  error?: string;
}

const DANGEROUS_KEYWORDS = [
  "delete", "drop", "truncate", "insert", "update", "alter",
  "create", "grant", "revoke", "copy", "import", "execute",
  "call", "reindex", "vacuum", "analyze", "cluster", "listen",
  "notify",
];

export function analyzeSql(
  rawSql: string,
  context: { schoolId?: string; userId?: string },
): AnalysisResult {
  const warnings: string[] = [];

  const trimmed = rawSql.trim();
  if (!trimmed) {
    return { safe: false, sql: "", warnings, error: "Empty SQL query" };
  }

  const lower = trimmed.toLowerCase();

  // Quick check for dangerous keywords
  for (const kw of DANGEROUS_KEYWORDS) {
    const regex = new RegExp(`(^|\\s)${kw}(\\s|$|\\(|;)`, "i");
    if (regex.test(trimmed)) {
      return {
        safe: false,
        sql: "",
        warnings,
        error: `Query contains dangerous keyword: ${kw}`,
      };
    }
  }

  // Must start with SELECT or WITH
  if (!lower.startsWith("select ") && !lower.startsWith("with ")) {
    return {
      safe: false,
      sql: "",
      warnings,
      error: "Only SELECT queries are allowed",
    };
  }

  // Parse the SQL to AST for deep validation
  try {
    const raw = parser.astify(trimmed, PARSE_OPTIONS);
    const statements = Array.isArray(raw) ? raw : [raw];
    const stmt = statements[0] as unknown as Record<string, unknown>;

    if (!stmt || (stmt.type !== "select" && stmt.type !== "union")) {
      return {
        safe: false,
        sql: "",
        warnings,
        error: "Expected SELECT statement",
      };
    }

    if (stmt.type === "union") {
      return {
        safe: false,
        sql: "",
        warnings,
        error: "UNION queries are not allowed",
      };
    }

    if (stmt._nolock || stmt.for_update) {
      return {
        safe: false,
        sql: "",
        warnings,
        error: "Locking clauses are not allowed",
      };
    }
  } catch {
    warnings.push("Could not parse SQL structure, using basic safety checks");
  }

  // Inject LIMIT if missing
  let modified = trimmed;
  const hasLimit = /\blimit\s+\d+/i.test(modified);
  if (!hasLimit) {
    modified = modified.replace(/;?\s*$/, " LIMIT 100");
    warnings.push("Added LIMIT 100 to prevent large result sets");
  }

  // Warn about missing WHERE clause
  const hasWhere = /\bwhere\s/i.test(modified);
  if (!hasWhere) {
    warnings.push("Query has no WHERE clause — this may return many rows");
  }

  return {
    safe: true,
    sql: modified,
    warnings,
  };
}
