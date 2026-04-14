import { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AcademicsOverview } from "./components/AcademicsOverview";
import { AcademicsManager } from "./components/AcademicsManager";
import { SchemeImport } from "./components/SchemeImport";

export const metadata: Metadata = {
  title: "Academics",
  description: "Academic management hub - years, terms, curriculum, and more",
};

async function getAcademicData(schoolId: string) {
  const supabase = await createSupabaseServerClient();

  const [yearsRes, termsRes, classesRes, learningAreasRes] = await Promise.all([
    supabase
      .from("academic_years")
      .select("*")
      .eq("school_id", schoolId)
      .order("start_date", { ascending: false }),
    supabase
      .from("terms")
      .select("*")
      .eq("school_id", schoolId)
      .order("start_date", { ascending: false })
      .limit(10),
    supabase
      .from("classes")
      .select("class_id, name, stream")
      .eq("school_id", schoolId),
    supabase
      .from("learning_areas")
      .select("learning_area_id, school_id, name, description, is_core, applicable_grades, created_at, updated_at")
      .eq("school_id", schoolId)
      .order("name", { ascending: true }),
  ]);

  return {
    academicYears: yearsRes.data || [],
    terms: termsRes.data || [],
    classes: classesRes.data || [],
    learningAreas: (learningAreasRes.data || []).map((row: any) => ({
      learningAreaId: row.learning_area_id,
      schoolId: row.school_id,
      name: row.name,
      description: row.description,
      isCore: row.is_core,
      applicableGrades: row.applicable_grades || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export default async function AcademicsPage() {
  const user = await getCurrentUser();
  if (!user) {redirect("/login");}
  if (!user.schoolId) {redirect("/login");}

  const academicData = await getAcademicData(user.schoolId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academics"
        description="Manage academic years, terms, timetable, and academic operations"
      />
      <AcademicsOverview
        academicYears={academicData.academicYears}
        terms={academicData.terms}
        classes={academicData.classes}
      />
      <AcademicsManager initialLearningAreas={academicData.learningAreas} />
      <SchemeImport />
    </div>
  );
}
