import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { sanitizeForAgent } from "./context-builder.service";
import { getEntity } from "./data-catalog.service";
import type { AuthUser } from "@/types/auth";
import type { DataCatalogEntity, DataCatalogJoin } from "./data-catalog.service";
import type { z } from "zod";
import type { querySchoolDataSchema } from "@/features/ai-agent/validators/aiAgent.schema";

export type QuerySchoolDataInput = z.infer<typeof querySchoolDataSchema>;

export interface QuerySchoolDataOutput {
  summary: string;
  rows: Record<string, unknown>[];
  count: number;
  totalCount?: number;
  grouped?: Record<string, number>;
  appliedFilters: { field: string; operator: string; value?: unknown }[];
  warnings: string[];
  executionMs: number;
}

export class QueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryValidationError";
  }
}

export class QueryPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryPermissionError";
  }
}

function validateAgainstCatalog(input: QuerySchoolDataInput): DataCatalogEntity {
  const entity = getEntity(input.entity);
  if (!entity) {
    throw new QueryValidationError(`Unknown entity "${input.entity}". Available entities: students, staff, classes, attendance, assessments, assessment_aggregates, report_cards, student_fees, payments, fee_structures, messages, announcements, timetable_slots, disciplinary_records, special_needs, teacher_subjects, academic_years, terms`);
  }

  if (input.select) {
    for (const col of input.select) {
      const isJoinColumn = entity.joins && Object.values(entity.joins).some((j: DataCatalogJoin) => j.select.split(",").map((s: string) => s.trim()).includes(col));
      if (!isJoinColumn && !entity.readableColumns.includes(col)) {
        throw new QueryValidationError(`Column "${col}" is not readable for entity "${input.entity}". Allowed: ${entity.readableColumns.join(", ")}`);
      }
    }
  }

  if (input.filters) {
    for (const f of input.filters) {
      if (!entity.filterableColumns.includes(f.field)) {
        throw new QueryValidationError(`Field "${f.field}" is not filterable for entity "${input.entity}". Allowed: ${entity.filterableColumns.join(", ")}`);
      }
      if (f.operator === "ilike" || f.operator === "contains") {
        if (!entity.searchableColumns.includes(f.field)) {
          throw new QueryValidationError(`Operator "${f.operator}" requires a searchable field. "${f.field}" is not searchable for entity "${input.entity}"`);
        }
      }
    }
  }

  if (input.search && entity.searchableColumns.length === 0) {
    throw new QueryValidationError(`Entity "${input.entity}" does not support text search`);
  }

  if (input.searchFields) {
    for (const sf of input.searchFields) {
      if (!entity.searchableColumns.includes(sf)) {
        throw new QueryValidationError(`Field "${sf}" is not searchable for entity "${input.entity}"`);
      }
    }
  }

  if (input.groupBy) {
    for (const gb of input.groupBy) {
      if (!entity.filterableColumns.includes(gb) && !entity.readableColumns.includes(gb)) {
        throw new QueryValidationError(`Field "${gb}" cannot be used for grouping. It must be a readable or filterable column`);
      }
    }
  }

  if (input.orderBy) {
    if (!entity.readableColumns.includes(input.orderBy) && !entity.filterableColumns.includes(input.orderBy)) {
      throw new QueryValidationError(`Field "${input.orderBy}" cannot be used for ordering`);
    }
  }

  if (input.limit && input.limit > 500) {
    throw new QueryValidationError("Limit cannot exceed 500");
  }

  return entity;
}

function checkPermission(entityName: string, user: AuthUser): void {
  const entity = getEntity(entityName);
  if (!entity) throw new QueryValidationError(`Unknown entity: ${entityName}`);
  if (!hasPermission(user.role, entity.module, entity.action)) {
    throw new QueryPermissionError(`You do not have ${entity.action} permission on ${entity.module} module`);
  }
}

function applyTenantScope(
  entity: DataCatalogEntity,
  user: AuthUser,
  input: QuerySchoolDataInput,
): { needsFilter: boolean; note?: string } {
  if (user.role === "super_admin") {
    const hasSchoolFilter = input.filters?.some((f) => f.field === entity.scopeColumn);
    if (!hasSchoolFilter) {
      return { needsFilter: false, note: "super_admin without school_id filter — query is global" };
    }
    return { needsFilter: false };
  }
  if (user.schoolId) {
    return { needsFilter: true };
  }
  return { needsFilter: false };
}

async function applyRoleDataScope(
  entityName: string,
  user: AuthUser,
): Promise<{ studentIds?: string[]; classIds?: string[] } | null> {
  if (user.role === "parent") {
    if (entityName === "students" || entityName === "student_fees" || entityName === "attendance" || entityName === "assessments" || entityName === "assessment_aggregates" || entityName === "report_cards" || entityName === "disciplinary_records" || entityName === "special_needs") {
      const supabase = await createSupabaseServerClient();
      const { data: linked } = await supabase
        .from("student_guardians")
        .select("student_id")
        .eq("guardian_id", user.id);
      if (!linked?.length) {
        throw new QueryPermissionError("No linked students found for your account");
      }
      return { studentIds: linked.map((l: any) => l.student_id) };
    }
  }

  if (user.role === "student") {
    if (entityName === "students") {
      return { studentIds: [user.id] };
    }
    if (entityName === "attendance" || entityName === "assessments" || entityName === "assessment_aggregates" || entityName === "student_fees" || entityName === "report_cards" || entityName === "disciplinary_records" || entityName === "special_needs") {
      const supabase = await createSupabaseServerClient();
      const { data: student } = await supabase
        .from("students")
        .select("student_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (student) {
        return { studentIds: [student.student_id] };
      }
    }
  }

  if (["teacher", "class_teacher", "subject_teacher"].includes(user.role)) {
    if (entityName === "students" && user.schoolId) {
      const supabase = await createSupabaseServerClient();
      const { data: teacherSubjects } = await supabase
        .from("teacher_subjects")
        .select("class_id")
        .eq("school_id", user.schoolId)
        .eq("teacher_id", user.id)
        .eq("is_active", true);
      if (teacherSubjects?.length) {
        const classIds = [...new Set(teacherSubjects.map((t: any) => t.class_id))];
        return { classIds };
      }
    }
  }

  return null;
}

function applyScopeToQuery(query: any, entity: DataCatalogEntity, user: AuthUser, scope: ReturnType<typeof applyTenantScope>, roleScope: Awaited<ReturnType<typeof applyRoleDataScope>>): any {
  if (scope.needsFilter && user.schoolId) {
    query = query.eq(entity.scopeColumn, user.schoolId);
  }
  if (roleScope?.studentIds) {
    query = query.in("student_id", roleScope.studentIds);
  }
  if (roleScope?.classIds) {
    query = query.in("current_class_id", roleScope.classIds);
  }
  return query;
}

function applyFiltersToQuery(query: any, input: QuerySchoolDataInput, appliedFilters: { field: string; operator: string; value?: unknown }[]): any {
  if (input.filters) {
    for (const f of input.filters) {
      switch (f.operator) {
        case "eq": query = query.eq(f.field, f.value); break;
        case "neq": query = query.neq(f.field, f.value); break;
        case "in": query = query.in(f.field, f.value as any[]); break;
        case "gte": query = query.gte(f.field, f.value); break;
        case "lte": query = query.lte(f.field, f.value); break;
        case "gt": query = query.gt(f.field, f.value); break;
        case "lt": query = query.lt(f.field, f.value); break;
        case "ilike": query = query.ilike(f.field, `%${f.value}%`); break;
        case "is_null": query = query.is(f.field, null); break;
        case "not_null": query = query.not(f.field, "is", null); break;
      }
      appliedFilters.push({ field: f.field, operator: f.operator, value: f.value });
    }
  }
  return query;
}

function applySearchToQuery(query: any, input: QuerySchoolDataInput, entity: DataCatalogEntity, appliedFilters: { field: string; operator: string; value?: unknown }[]): any {
  if (input.search && entity.searchableColumns.length > 0) {
    const searchable = input.searchFields ?? entity.searchableColumns;
    if (searchable.length === 1) {
      query = query.ilike(searchable[0], `%${input.search}%`);
      appliedFilters.push({ field: searchable[0], operator: "ilike", value: input.search });
    } else if (searchable.length > 1) {
      const orConditions = searchable.map((s: string) => `${s}.ilike.%${input.search}%`);
      query = query.or(orConditions.join(","));
      appliedFilters.push({ field: searchable.join(","), operator: "ilike", value: input.search });
    }
  }
  return query;
}

async function executeCountQuery(input: QuerySchoolDataInput, entity: DataCatalogEntity, user: AuthUser): Promise<QuerySchoolDataOutput> {
  const supabase = await createSupabaseServerClient();
  const appliedFilters: { field: string; operator: string; value?: unknown }[] = [];
  let query = supabase.from(entity.table).select("*", { count: "exact", head: true });
  query = applyFiltersToQuery(query, input, appliedFilters);

  const scope = applyTenantScope(entity, user, input);
  const roleScope = await applyRoleDataScope(input.entity, user);
  query = applyScopeToQuery(query, entity, user, scope, roleScope);

  const { count, error } = await query;
  if (error) throw new Error(`Query failed: ${error.message}`);

  return { summary: `Found ${count ?? 0} ${input.entity}(s)`, rows: [], count: count ?? 0, appliedFilters, warnings: scope.note ? [scope.note] : [], executionMs: 0 };
}

async function executeExistsQuery(input: QuerySchoolDataInput, entity: DataCatalogEntity, user: AuthUser): Promise<QuerySchoolDataOutput> {
  const result = await executeCountQuery(input, entity, user);
  return { ...result, summary: `Records exist: ${result.count > 0}`, rows: [], count: result.count };
}

async function executeGroupedQuery(input: QuerySchoolDataInput, entity: DataCatalogEntity, user: AuthUser): Promise<QuerySchoolDataOutput> {
  const groupField = input.groupBy![0];

  const listResult = await executeListQuery(
    { ...input, select: entity.readableColumns, limit: 5000 },
    entity,
    user,
  );

  const grouped: Record<string, number> = {};
  for (const row of listResult.rows) {
    const key = String(row[groupField] ?? "unknown");
    grouped[key] = (grouped[key] ?? 0) + 1;
  }

  return {
    ...listResult,
    summary: `Grouped by ${groupField}: ${Object.keys(grouped).length} group(s)`,
    grouped,
    count: Object.keys(grouped).length,
  };
}

async function executeListQuery(
  input: QuerySchoolDataInput,
  entity: DataCatalogEntity,
  user: AuthUser,
): Promise<QuerySchoolDataOutput> {
  const supabase = await createSupabaseServerClient();
  const startedAt = Date.now();
  const appliedFilters: { field: string; operator: string; value?: unknown }[] = [];

  const selectCols = input.select ?? entity.defaultSelect;
  const allSelect = [...selectCols];

  if (entity.joins) {
    for (const [alias, join] of Object.entries(entity.joins)) {
      const joinCols = (join as DataCatalogJoin).select.split(",").map((s: string) => `${alias}(${s.trim()})`);
      allSelect.push(...joinCols);
    }
  }

  let query = supabase.from(entity.table).select(allSelect.join(","));
  query = applyFiltersToQuery(query, input, appliedFilters);
  query = applySearchToQuery(query, input, entity, appliedFilters);

  const scope = applyTenantScope(entity, user, input);
  const roleScope = await applyRoleDataScope(input.entity, user);
  query = applyScopeToQuery(query, entity, user, scope, roleScope);

  if (input.orderBy) {
    query = query.order(input.orderBy, { ascending: input.orderDirection !== "desc" });
  }
  if (input.limit) {
    query = query.limit(input.limit);
  }
  if (input.offset) {
    query = query.range(input.offset, input.offset + (input.limit ?? 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Query failed: ${error.message}`);

  const rawRows = (data ?? []) as unknown[];
  const rows = rawRows.map((row: any) => sanitizeForAgent(row)) as Record<string, unknown>[];

  return {
    summary: `Found ${rows.length} ${input.entity}(s)`,
    rows,
    count: rows.length,
    appliedFilters,
    warnings: scope.note ? [scope.note] : [],
    executionMs: Date.now() - startedAt,
  };
}

export async function executeSafeQuery(input: QuerySchoolDataInput, user: AuthUser): Promise<QuerySchoolDataOutput> {
  const entity = validateAgainstCatalog(input);
  checkPermission(input.entity, user);

  switch (input.operation) {
    case "count":
      return executeCountQuery(input, entity, user);
    case "exists":
      return executeExistsQuery(input, entity, user);
    case "summary":
      if (input.groupBy && input.groupBy.length > 0) {
        return executeGroupedQuery(input, entity, user);
      }
      return executeListQuery(input, entity, user);
    case "list":
      return executeListQuery(input, entity, user);
    default:
      throw new QueryValidationError(`Unsupported operation: ${input.operation}`);
  }
}
