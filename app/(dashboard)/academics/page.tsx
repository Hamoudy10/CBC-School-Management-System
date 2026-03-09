import { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AcademicsOverview } from "./components/AcademicsOverview";

export const metadata: Metadata = {
  title: "Academics",
  description: "Academic management hub - years, terms, curriculum, and more",
};

async function getAcademicData(schoolId: string) {
  const supabase = await createSupabaseServerClient();

  const [yearsRes, termsRes, classesRes] = await Promise.all([
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
  ]);

  return {
    academicYears: yearsRes.data || [],
    terms: termsRes.data || [],
    classes: classesRes.data || [],
  };
}

export default async function AcademicsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.schoolId) redirect("/login");

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
    </div>
  );
}
