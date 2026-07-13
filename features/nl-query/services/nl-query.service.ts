import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { NLQueryResult, NLQueryRequest } from "../types";

const queryPlanSchema = z.object({
  intent: z.string(),
  queryType: z.enum(["academic", "attendance", "discipline", "finance", "general"]),
  tablesNeeded: z.array(z.string()),
  filters: z.array(
    z.object({
      field: z.string(),
      operator: z.string(),
      value: z.union([z.string(), z.number()]),
    })
  ),
  aggregations: z.array(
    z.object({
      function: z.enum(["count", "avg", "sum", "min", "max"]),
      field: z.string(),
      alias: z.string().optional(),
    })
  ),
  groupBy: z.array(z.string()).optional(),
  orderBy: z
    .array(
      z.object({
        field: z.string(),
        direction: z.enum(["asc", "desc"]),
      })
    )
    .optional(),
  limit: z.number().optional(),
  requiresStudentScope: z.boolean(),
  requiresClassScope: z.boolean(),
  visualizationType: z.enum(["table", "bar_chart", "line_chart", "pie_chart", "stat_card", "text", "list"]),
  visualizationTitle: z.string(),
  visualizationDescription: z.string(),
});

function buildSqlFromPlan(plan: z.infer<typeof queryPlanSchema>, schoolId: string, context: { classId?: string; termId?: string; academicYearId?: string; studentId?: string }): string {
  const tableAliases: Record<string, string> = {
    assessments: "a",
    students: "s",
    classes: "c",
    learning_areas: "la",
    attendance: "att",
    disciplinary_records: "dr",
    fee_structures: "fs",
    student_fees: "sf",
    payments: "p",
    assessment_aggregates: "aa",
    terms: "t",
    academic_years: "ay",
    users: "u",
  };

  const aggregations = plan.aggregations
    .map((agg) => {
      const tablePrefix = Object.entries(tableAliases).find(([table]) =>
        plan.tablesNeeded.includes(table)
      )?.[1];
      const fieldRef = agg.field.includes(".") ? agg.field : `${tablePrefix || "a"}.${agg.field}`;
      return `${agg.function}(${fieldRef}) as ${agg.alias || `${agg.function}_${agg.field}`}`;
    })
    .join(", ");

  const selectClause = aggregations || "*";
  const mainTable = plan.tablesNeeded[0] || "assessments";
  const mainAlias = tableAliases[mainTable] || "a";

  const joins: string[] = [];
  if (plan.tablesNeeded.includes("students") && mainTable !== "students") {
    joins.push(`LEFT JOIN students s ON ${mainAlias}.student_id = s.student_id`);
  }
  if (plan.tablesNeeded.includes("classes")) {
    joins.push(`LEFT JOIN classes c ON s.current_class_id = c.class_id`);
  }
  if (plan.tablesNeeded.includes("learning_areas")) {
    joins.push(`LEFT JOIN learning_areas la ON ${mainAlias}.learning_area_id = la.learning_area_id`);
  }
  if (plan.tablesNeeded.includes("terms")) {
    joins.push(`LEFT JOIN terms t ON ${mainAlias}.term_id = t.term_id`);
  }
  if (plan.tablesNeeded.includes("academic_years")) {
    joins.push(`LEFT JOIN academic_years ay ON ${mainAlias}.academic_year_id = ay.academic_year_id`);
  }
  if (plan.tablesNeeded.includes("users")) {
    joins.push(`LEFT JOIN users u ON s.student_id = u.id`);
  }

  const whereClauses: string[] = [`${mainAlias}.school_id = '${schoolId}'`];

  if (context.classId) {
    whereClauses.push(`s.current_class_id = '${context.classId}'`);
  }
  if (context.termId) {
    whereClauses.push(`${mainAlias}.term_id = '${context.termId}'`);
  }
  if (context.academicYearId) {
    whereClauses.push(`${mainAlias}.academic_year_id = '${context.academicYearId}'`);
  }
  if (context.studentId) {
    whereClauses.push(`${mainAlias}.student_id = '${context.studentId}'`);
  }

  for (const filter of plan.filters) {
    const filterField = filter.field.includes(".") ? filter.field : `${mainAlias}.${filter.field}`;
    const filterVal = typeof filter.value === "string" ? `'${filter.value}'` : filter.value;
    whereClauses.push(`${filterField} ${filter.operator} ${filterVal}`);
  }

  const groupByClause = plan.groupBy?.length
    ? `GROUP BY ${plan.groupBy.map((g) => (g.includes(".") ? g : `${mainAlias}.${g}`)).join(", ")}`
    : "";

  const orderByClause = plan.orderBy?.length
    ? `ORDER BY ${plan.orderBy.map((o) => `${o.field} ${o.direction}`).join(", ")}`
    : "";

  const limitClause = plan.limit ? `LIMIT ${plan.limit}` : "";

  return `SELECT ${selectClause} FROM ${mainTable} ${mainAlias} ${joins.join(" ")} WHERE ${whereClauses.join(" AND ")} ${groupByClause} ${orderByClause} ${limitClause}`.trim();
}

function tryExecuteSql(sql: string, plan: z.infer<typeof queryPlanSchema>, context: { classId?: string }, schoolData: any): any {
  const schoolId = schoolData.schoolId;
  const assessments = schoolData.assessments || [];
  const students = schoolData.students || [];
  const attendance = schoolData.attendance || [];
  const discipline = schoolData.discipline || [];
  const fees = schoolData.fees || [];
  const aggregates = schoolData.aggregates || [];
  const learningAreas = schoolData.learningAreas || [];
  const classes = schoolData.classes || [];

  let data: any[] = [];

  if (plan.queryType === "academic") {
    let filtered = [...aggregates];
    for (const filter of plan.filters) {
      if (filter.field === "average_score" || filter.field === "score") {
        const val = Number(filter.value);
        filtered = filtered.filter((r: any) => {
          if (filter.operator === ">=") return r.average_score >= val;
          if (filter.operator === "<=") return r.average_score <= val;
          if (filter.operator === ">") return r.average_score > val;
          if (filter.operator === "<") return r.average_score < val;
          if (filter.operator === "=") return r.average_score === val;
          return true;
        });
      }
      if (filter.field === "learning_area_id") {
        filtered = filtered.filter((r: any) => r.learning_area_id === filter.value);
      }
    }

    if (context.classId) {
      filtered = filtered.filter((r: any) => r.class_id === context.classId);
    }

    if (plan.groupBy?.includes("learning_area_id") || plan.groupBy?.includes("la.name") || plan.groupBy?.includes("learning_area_name")) {
      const grouped: Record<string, any> = {};
      for (const r of filtered) {
        const key = r.learning_area_id;
        if (!grouped[key]) {
          grouped[key] = { learningAreaId: key, learningAreaName: r.learning_areas?.name || "Unknown", total: 0, count: 0 };
        }
        grouped[key].total += r.average_score;
        grouped[key].count++;
      }
      data = Object.values(grouped).map((g: any) => ({
        name: g.learningAreaName,
        value: g.count > 0 ? Math.round((g.total / g.count) * 100) / 100 : 0,
        count: g.count,
      }));
    } else if (plan.aggregations.some((a) => a.function === "count")) {
      data = [{ count: filtered.length }];
    } else {
      data = filtered.slice(0, plan.limit || 20).map((r: any) => {
        const student = students.find((s: any) => s.student_id === r.student_id);
        return {
          name: student ? `${student.first_name || ""} ${student.last_name || ""}`.trim() : "Unknown",
          score: r.average_score,
        };
      });
    }
  } else if (plan.queryType === "attendance") {
    let filtered = [...attendance];
    if (context.classId) {
      const classStudentIds = students.filter((s: any) => s.current_class_id === context.classId).map((s: any) => s.student_id);
      filtered = filtered.filter((r: any) => classStudentIds.includes(r.student_id));
    }
    for (const filter of plan.filters) {
      if (filter.field === "status" || filter.field === "att.status") {
        filtered = filtered.filter((r: any) => r.status === filter.value);
      }
    }
    if (plan.aggregations.some((a) => a.function === "count")) {
      const statusCounts: Record<string, number> = {};
      for (const r of filtered) {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      }
      data = Object.entries(statusCounts).map(([status, count]) => ({ name: status, value: count }));
    } else {
      data = filtered.slice(0, plan.limit || 20);
    }
  } else if (plan.queryType === "discipline") {
    let filtered = [...discipline];
    if (context.classId) {
      const classStudentIds = students.filter((s: any) => s.current_class_id === context.classId).map((s: any) => s.student_id);
      filtered = filtered.filter((r: any) => classStudentIds.includes(r.student_id));
    }
    if (plan.aggregations.some((a) => a.function === "count")) {
      const typeCounts: Record<string, number> = {};
      for (const r of filtered) {
        typeCounts[r.incident_type] = (typeCounts[r.incident_type] || 0) + 1;
      }
      data = Object.entries(typeCounts).map(([type, count]) => ({ name: type, value: count }));
    } else {
      data = filtered.slice(0, plan.limit || 20);
    }
  } else if (plan.queryType === "finance") {
    let filtered = [...fees];
    if (context.classId) {
      const classStudentIds = students.filter((s: any) => s.current_class_id === context.classId).map((s: any) => s.student_id);
      filtered = filtered.filter((r: any) => classStudentIds.includes(r.student_id));
    }
    if (plan.aggregations.some((a) => a.function === "count")) {
      const statusCounts: Record<string, number> = {};
      for (const r of filtered) {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      }
      data = Object.entries(statusCounts).map(([status, count]) => ({ name: status, value: count }));
    } else {
      data = filtered.slice(0, plan.limit || 20);
    }
  }

  return data;
}

function getDefaultDataForType(queryType: string, schoolData: any, context: { classId?: string }): any {
  const { students, aggregates, attendance, discipline, fees } = schoolData;
  let filteredStudents = students || [];
  if (context.classId) {
    filteredStudents = filteredStudents.filter((s: any) => s.current_class_id === context.classId);
  }

  switch (queryType) {
    case "academic": {
      const studentScores = filteredStudents.map((s: any) => {
        const studentAggs = (aggregates || []).filter((a: any) => a.student_id === s.student_id);
        const avg = studentAggs.length > 0 ? studentAggs.reduce((sum: number, a: any) => sum + a.average_score, 0) / studentAggs.length : 0;
        return { name: `${s.first_name || ""} ${s.last_name || ""}`.trim(), score: Math.round(avg * 100) / 100 };
      }).filter((s: any) => s.score > 0).sort((a: any, b: any) => b.score - a.score);
      return studentScores.slice(0, 20);
    }
    case "attendance": {
      const attRecords = (attendance || []).filter((a: any) =>
        filteredStudents.some((s: any) => s.student_id === a.student_id)
      );
      const counts: Record<string, number> = {};
      for (const r of attRecords) {
        counts[r.status] = (counts[r.status] || 0) + 1;
      }
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }
    case "discipline": {
      const discRecords = (discipline || []).filter((d: any) =>
        filteredStudents.some((s: any) => s.student_id === d.student_id)
      );
      const counts: Record<string, number> = {};
      for (const r of discRecords) {
        counts[r.incident_type] = (counts[r.incident_type] || 0) + 1;
      }
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }
    case "finance": {
      const feeRecords = (fees || []).filter((f: any) =>
        filteredStudents.some((s: any) => s.student_id === f.student_id)
      );
      const counts: Record<string, number> = {};
      for (const r of feeRecords) {
        counts[r.status] = (counts[r.status] || 0) + 1;
      }
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }
    default:
      return [];
  }
}

export async function processNLQuery(
  input: NLQueryRequest,
  schoolId: string,
  userId: string
): Promise<NLQueryResult> {
  const supabase = await createSupabaseServerClient();

  const [students, classes, learningAreas, aggregates, attendance, discipline, fees] =
    await Promise.all([
      supabase.from("students").select("student_id, first_name, last_name, current_class_id").eq("school_id", schoolId).limit(200),
      supabase.from("classes").select("class_id, name").eq("school_id", schoolId),
      supabase.from("learning_areas").select("learning_area_id, name").eq("school_id", schoolId),
      supabase.from("assessment_aggregates").select("student_id, learning_area_id, average_score, class_id, learning_areas(name)").eq("school_id", schoolId).limit(500),
      supabase.from("attendance").select("student_id, status, date").eq("school_id", schoolId).limit(500),
      supabase.from("disciplinary_records").select("student_id, incident_type, severity, created_at").eq("school_id", schoolId).limit(200),
      supabase.from("student_fees").select("student_id, status, amount_due").eq("school_id", schoolId).limit(200),
    ]);

  const schoolData = {
    schoolId,
    students: students.data || [],
    classes: classes.data || [],
    learningAreas: learningAreas.data || [],
    aggregates: aggregates.data || [],
    attendance: attendance.data || [],
    discipline: discipline.data || [],
    fees: fees.data || [],
  };

  const contextDesc = [
    input.classId ? `class_id filter available` : "no class filter",
    input.termId ? "term filter available" : "no term filter",
    input.studentId ? "student filter available" : "no student filter",
  ].join(", ");

  try {
    const ai = await generateGroqCompletion<z.infer<typeof queryPlanSchema>>({
      system: `You are a natural language to school-data query engine for Kenyan CBC schools.
Interpret the user's plain-English question and produce a structured query plan.
Available tables: assessments, assessment_aggregates, students, classes, learning_areas, attendance, disciplinary_records, student_fees, payments, terms, academic_years, users.
The CBC score scale is 1-4 (1=Below Expectation, 2=Approaching, 3=Meeting, 4=Exceeding).
Return JSON only.`,
      prompt: `User query: "${input.query}"

School context: ${contextDesc}
Available data summary:
- ${schoolData.students.length} students
- ${schoolData.classes.length} classes
- ${schoolData.learningAreas.length} learning areas
- ${schoolData.aggregates.length} assessment aggregates
- ${schoolData.attendance.length} attendance records
- ${schoolData.discipline.length} discipline records
- ${schoolData.fees.length} fee records

Interpret the user's question and produce a query plan.

Rules:
- Identify the correct table(s) needed
- Infer proper filters from the question
- Choose appropriate aggregations
- Pick the best visualization type for the data
- If the question asks for "top/bottom", include orderBy
- If the question asks for counts, use count aggregation
- If the question asks for averages, use avg aggregation
- For performance questions, use assessment_aggregates as the primary table
- Attendance questions use attendance table
- Discipline questions use disciplinary_records
- Finance questions use student_fees`,
      responseFormat: "json",
      temperature: 0.15,
      responseSchema: queryPlanSchema,
      requestLabel: "nl-query.process",
      cache: { schoolId, ttlSeconds: 1800 },
    });

    const plan = queryPlanSchema.parse(ai.data);

    let data: any;
    let sql = "";
    let dataSource = "ai_interpretation";

    try {
      sql = buildSqlFromPlan(plan, schoolId, {
        classId: input.classId,
        termId: input.termId,
        academicYearId: input.academicYearId,
        studentId: input.studentId,
      });
      data = tryExecuteSql(sql, plan, { classId: input.classId }, schoolData);

      if (!data || data.length === 0) {
        data = getDefaultDataForType(plan.queryType, schoolData, { classId: input.classId });
        dataSource = "fallback_context";
      }
    } catch {
      data = getDefaultDataForType(plan.queryType, schoolData, { classId: input.classId });
      dataSource = "fallback_context";
      sql = "Uses contextual data extraction (SQL simulation unavailable)";
    }

    const summary = generateSummary(plan, data, input.query);

    return {
      originalQuery: input.query,
      interpretedIntent: plan.intent,
      queryType: plan.queryType,
      data,
      visualization: {
        type: plan.visualizationType as any,
        title: plan.visualizationTitle,
        description: plan.visualizationDescription,
      },
      queryPlanPreview: sql,
      summary,
      confidence: ai.confidence,
      warnings: [
        ...(ai.warnings || []),
        dataSource === "fallback_context"
          ? "Used contextual data extraction (AI query plan could not be fully executed)"
          : "",
        schoolData.students.length >= 200 ? "Data is sampled (max 200 students loaded)" : "",
        schoolData.aggregates.length >= 500 ? "Assessment data is sampled (max 500 records)" : "",
        schoolData.attendance.length >= 500 ? "Attendance data is sampled (max 500 records)" : "",
        schoolData.discipline.length >= 200 ? "Discipline data is sampled (max 200 records)" : "",
        schoolData.fees.length >= 200 ? "Fee data is sampled (max 200 records)" : "",
      ].filter(Boolean),
    };
  } catch (error) {
    logger.warn("AI NL-query failed, using context-based fallback", {
      error: error instanceof Error ? error.message : "Unknown",
    });

    const data = getDefaultDataForType("general", schoolData, { classId: input.classId });

    return {
      originalQuery: input.query,
      interpretedIntent: "Extracted from available school data context",
      queryType: "general",
      data,
      visualization: {
        type: "text",
        title: "Query Results",
        description: `Results based on your query: "${input.query}"`,
      },
      queryPlanPreview: "Fallback mode - contextual data extraction",
      summary: `Here is what I found based on your question. The available data covers ${schoolData.students.length} students, ${schoolData.classes.length} classes, and ${schoolData.learningAreas.length} learning areas.`,
      confidence: 0.6,
      warnings: [
        "AI interpretation was unavailable - showing contextual data overview",
        schoolData.students.length >= 200 ? "Data is sampled (max 200 students loaded)" : "",
      ].filter(Boolean),
    };
  }
}

function generateSummary(plan: z.infer<typeof queryPlanSchema>, data: any[], query: string): string {
  if (!data || data.length === 0) {
    return "No data matched your query criteria.";
  }

  if (plan.visualizationType === "stat_card") {
    const first = data[0];
    const keys = Object.keys(first);
    return `${keys[0]}: ${first[keys[0]]}`;
  }

  if (plan.visualizationType === "table" || plan.visualizationType === "list") {
    return `Found ${data.length} result${data.length !== 1 ? "s" : ""} for your query.`;
  }

  if (plan.visualizationType === "bar_chart" || plan.visualizationType === "pie_chart") {
    const total = data.reduce((sum: number, item: any) => sum + (item.value || item.count || 0), 0);
    return `Showing ${data.length} categories with a total of ${Math.round(total * 100) / 100}.`;
  }

  return `Query returned ${data.length} results.`;
}
