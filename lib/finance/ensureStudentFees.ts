import { createStudentFee } from "@/features/finance";
import { getCurrentAcademicContext } from "@/app/api/students/_utils";

type SupabaseLike = any;

export async function ensureCurrentMandatoryFeesForStudent(
  supabase: SupabaseLike,
  {
    schoolId,
    studentId,
    gradeId,
    userId,
    roleName,
  }: {
    schoolId: string;
    studentId: string;
    gradeId: string | null;
    userId: string;
    roleName: string;
  },
) {
  const activeContext = await getCurrentAcademicContext(supabase, schoolId);
  const academicYearId = activeContext.academicYear?.academic_year_id;

  if (!academicYearId) {
    return;
  }

  const { data: feeStructures, error: feeStructuresError } = await supabase
    .from("fee_structures")
    .select("id, grade_id, term_id, is_mandatory, is_active")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .eq("is_active", true)
    .eq("is_mandatory", true);

  if (feeStructuresError) {
    throw new Error(feeStructuresError.message);
  }

  const applicableFeeStructures = (feeStructures ?? []).filter((feeStructure: any) => {
    const gradeMatches = !feeStructure.grade_id || feeStructure.grade_id === gradeId;
    const termMatches =
      !activeContext.term?.term_id ||
      !feeStructure.term_id ||
      feeStructure.term_id === activeContext.term.term_id;

    return gradeMatches && termMatches;
  });

  for (const feeStructure of applicableFeeStructures) {
    const result = await createStudentFee(
      {
        studentId,
        feeStructureId: feeStructure.id,
        academicYearId,
        termId: activeContext.term?.term_id ?? undefined,
      },
      {
        id: userId,
        schoolId,
        role: roleName,
      } as any,
    );

    if (!result.success && !result.message.includes("already assigned")) {
      throw new Error(result.message);
    }
  }
}
