import { createSupabaseAdminClient } from "@/lib/supabase/server";

export interface DbColumn {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
}

export interface DbForeignKey {
  column: string;
  ref_table: string;
  ref_column: string;
}

export interface DbEnum {
  column: string;
  values: string[];
}

export interface DbTable {
  table_name: string;
  columns: DbColumn[];
  primary_key: string[];
  foreign_keys: DbForeignKey[];
  enums: DbEnum[];
}

export interface DbSchema {
  tables: DbTable[];
}

export interface SchemaResult {
  success: boolean;
  tables: DbTable[];
  error?: string;
}

export function formatSchemaForPrompt(tables: DbTable[]): string {
  if (!tables || tables.length === 0) return "(no tables found)";
  const lines: string[] = [];
  for (const table of tables) {
    const cols = (table.columns ?? []).map((c) => {
      const parts = [`  - ${c.name} (${c.type})${c.nullable ? "" : " NOT NULL"}`];
      if ((table.primary_key ?? []).includes(c.name)) parts.push(" [PK]");
      const fk = (table.foreign_keys ?? []).find((f) => f.column === c.name);
      if (fk) parts.push(` -> ${fk.ref_table}.${fk.ref_column}`);
      return parts.join("");
    });
    const enumInfo = (table.enums ?? []).length > 0
      ? (table.enums ?? []).map((e) => `  ENUM ${e.column}: ${e.values.join(", ")}`)
      : [];
    lines.push(`- ${table.table_name}`);
    lines.push(...cols);
    lines.push(...enumInfo);
  }
  return lines.join("\n");
}

export async function getDbSchema(): Promise<SchemaResult> {
  try {
    const supabase = await createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("get_db_schema");
    if (error) return { success: false, tables: [], error: error.message };
    const tables = (data ?? []) as DbTable[];
    return { success: true, tables };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error fetching schema";
    return { success: false, tables: [], error: msg };
  }
}
