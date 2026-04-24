import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";

type ContextEntity = {
  id: string;
  name: string;
};

type CBCClassContext = {
  id: string;
  name: string;
  stream: string | null;
  gradeName: string;
  gradeLevel: number | null;
};

export type CBCContext = {
  schoolId: string;
  class: CBCClassContext | null;
  learning_area: ContextEntity | null;
  strand: ContextEntity | null;
  sub_strand: ContextEntity | null;
  competency: ContextEntity | null;
  warnings: string[];
};

export type CBCContextBuilderInput = {
  user: AuthUser;
  classId?: string;
  learningAreaId?: string;
  strandId?: string;
  subStrandId?: string;
  competencyId?: string;
};

async function findRecordById(
  table: string,
  idField: string,
  idValue: string,
  schoolId: string,
) {
  const supabase = await createSupabaseServerClient();
  const query = (supabase.from(table) as any)
    .select("*")
    .eq(idField, idValue)
    .eq("school_id", schoolId)
    .maybeSingle();

  const { data } = await query;
  return data as Record<string, any> | null;
}

export async function buildCBCContext({
  user,
  classId,
  learningAreaId,
  strandId,
  subStrandId,
  competencyId,
}: CBCContextBuilderInput): Promise<CBCContext> {
  if (!user.schoolId) {
    throw new Error("School context is required for CBC AI operations.");
  }

  const schoolId = user.schoolId;
  const warnings: string[] = [];
  let resolvedLearningAreaId = learningAreaId;
  let resolvedStrandId = strandId;
  let resolvedSubStrandId = subStrandId;
  let resolvedCompetencyId = competencyId;

  let classContext: CBCClassContext | null = null;
  let learningAreaContext: ContextEntity | null = null;
  let strandContext: ContextEntity | null = null;
  let subStrandContext: ContextEntity | null = null;
  let competencyContext: ContextEntity | null = null;

  if (classId) {
    const supabase = await createSupabaseServerClient();
    const { data: classRow } = await (supabase.from("classes") as any)
      .select(
        `
        class_id,
        name,
        stream,
        grade:grades(name, level_order)
      `,
      )
      .eq("class_id", classId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (classRow) {
      const grade = Array.isArray(classRow.grade) ? classRow.grade[0] : classRow.grade;
      classContext = {
        id: classRow.class_id,
        name: classRow.name,
        stream: classRow.stream ?? null,
        gradeName: grade?.name ?? "Grade",
        gradeLevel:
          typeof grade?.level_order === "number" ? grade.level_order : null,
      };
    } else {
      warnings.push("Selected class was not found in this school.");
    }
  }

  if (resolvedCompetencyId) {
    const competencyRow = await findRecordById(
      "competencies",
      "competency_id",
      resolvedCompetencyId,
      schoolId,
    );

    if (competencyRow) {
      competencyContext = {
        id: competencyRow.competency_id,
        name: competencyRow.name,
      };
      resolvedSubStrandId = resolvedSubStrandId ?? competencyRow.sub_strand_id;
    } else {
      warnings.push("Selected competency was not found in this school.");
    }
  }

  if (resolvedSubStrandId) {
    const subStrandRow = await findRecordById(
      "sub_strands",
      "sub_strand_id",
      resolvedSubStrandId,
      schoolId,
    );

    if (subStrandRow) {
      subStrandContext = {
        id: subStrandRow.sub_strand_id,
        name: subStrandRow.name,
      };
      resolvedStrandId = resolvedStrandId ?? subStrandRow.strand_id;
    } else {
      warnings.push("Selected sub-strand was not found in this school.");
    }
  }

  if (resolvedStrandId) {
    const strandRow = await findRecordById(
      "strands",
      "strand_id",
      resolvedStrandId,
      schoolId,
    );

    if (strandRow) {
      strandContext = {
        id: strandRow.strand_id,
        name: strandRow.name,
      };
      resolvedLearningAreaId = resolvedLearningAreaId ?? strandRow.learning_area_id;
    } else {
      warnings.push("Selected strand was not found in this school.");
    }
  }

  if (resolvedLearningAreaId) {
    const learningAreaRow = await findRecordById(
      "learning_areas",
      "learning_area_id",
      resolvedLearningAreaId,
      schoolId,
    );

    if (learningAreaRow) {
      learningAreaContext = {
        id: learningAreaRow.learning_area_id,
        name: learningAreaRow.name,
      };
    } else {
      warnings.push("Selected learning area was not found in this school.");
    }
  }

  return {
    schoolId,
    class: classContext,
    learning_area: learningAreaContext,
    strand: strandContext,
    sub_strand: subStrandContext,
    competency: competencyContext,
    warnings,
  };
}

export function formatCBCContextForPrompt(context: CBCContext): string {
  const rows = [
    `school_id: ${context.schoolId}`,
    `class: ${context.class?.name ?? "unknown"}`,
    `grade: ${context.class?.gradeName ?? "unknown"}`,
    `learning_area: ${context.learning_area?.name ?? "unknown"}`,
    `strand: ${context.strand?.name ?? "unknown"}`,
    `sub_strand: ${context.sub_strand?.name ?? "unknown"}`,
    `competency: ${context.competency?.name ?? "unknown"}`,
  ];

  if (context.warnings.length > 0) {
    rows.push(`context_warnings: ${context.warnings.join(" | ")}`);
  }

  return rows.join("\n");
}
