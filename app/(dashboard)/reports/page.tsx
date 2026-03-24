import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Button,
  Select,
  CardFooter,
  buttonVariants,
} from "@/components/ui";
import { BookOpen, FileText, Download, Plus } from "lucide-react";
import { formatDate, getInitials } from "@/lib/utils";

type RoleRelation = { name: string } | { name: string }[] | null;
type ReportLevel = NonNullable<ReportCard["overall_level"]>;

interface ReportCard {
  report_id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  academic_year_id: string;
  report_type: "term" | "yearly";
  overall_average: number | null;
  overall_level: "below_expectation" | "approaching" | "meeting" | "exceeding" | null;
  class_teacher_remarks: string | null;
  principal_remarks: string | null;
  analytics_json: any | null;
  pdf_url: string | null;
  is_published: boolean;
  published_at: string | null;
  generated_at: string;
  generated_by: string | null;
  students: {
    first_name: string;
    last_name: string;
    admission_number: string;
    photo_url: string | null;
  } | null;
  classes: {
    name: string;
    stream: string | null;
  } | null;
  terms: {
    name: "Term 1" | "Term 2" | "Term 3";
  } | null;
}

interface ReportCardRow {
  report_id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  academic_year_id: string;
  report_type: "term" | "yearly";
  overall_average: number | null;
  overall_level: ReportCard["overall_level"];
  is_published: boolean;
  generated_at: string;
  pdf_url: string | null;
  students:
    | {
        first_name: string;
        last_name: string;
        admission_number: string;
        photo_url: string | null;
      }
    | {
        first_name: string;
        last_name: string;
        admission_number: string;
        photo_url: string | null;
      }[]
    | null;
  classes:
    | {
        name: string;
        stream: string | null;
      }
    | {
        name: string;
        stream: string | null;
      }[]
    | null;
  terms:
    | {
        name: "Term 1" | "Term 2" | "Term 3";
      }
    | {
        name: "Term 1" | "Term 2" | "Term 3";
      }[]
    | null;
}

interface AcademicYear {
  academic_year_id: string;
  year: string;
  is_active: boolean;
}

interface Term {
  term_id: string;
  name: "Term 1" | "Term 2" | "Term 3";
  is_active: boolean;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function getRoleName(value: RoleRelation): string {
  const role = firstRelation(value);
  return role?.name ?? "student";
}

function isReportLevel(value: ReportCard["overall_level"]): value is ReportLevel {
  return (
    value === "below_expectation" ||
    value === "approaching" ||
    value === "meeting" ||
    value === "exceeding"
  );
}

export default async function ReportsPage({
  searchParams,
}: { 
  searchParams: { 
    term?: string; 
    class?: string; 
    student?: string; 
    status?: string;
    page?: string;
  }
}) {
  const supabase = await createSupabaseServerClient();

  // 1. Verify session and user role
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect("/login");
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("user_id, school_id, roles ( name )")
    .eq("user_id", session.user.id)
    .maybeSingle(); // Use maybeSingle to prevent 406 if user not found

  if (userError || !user || !user.school_id || !user.roles) {
    console.error("User data, school_id, or roles not found:", userError);
    redirect("/login");
  }

  const roleName = getRoleName(user.roles as RoleRelation);
  const schoolId = user.school_id;
  const userId = user.user_id;

  const isAdmin = ["super_admin", "school_admin", "principal", "deputy_principal"].includes(roleName);
  const isTeacher = ["teacher", "class_teacher", "subject_teacher"].includes(roleName);
  const isParent = roleName === "parent";
  const isStudent = roleName === "student";

  // Check if role is allowed to view reports page
  if (!(isAdmin || isTeacher || isParent || isStudent)) {
    redirect("/dashboard"); // Redirect unauthorized roles
  }

  // Fetch active academic year and term
  const { data: activeAcademicYear, error: yearError } = await supabase
    .from("academic_years")
    .select("academic_year_id, year, is_active")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  if (yearError || !activeAcademicYear) {
    console.warn("No active academic year found:", yearError);
    // Handle gracefully: show a message or redirect if critical
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold">No Active Academic Year Configured</h1>
        <p className="text-gray-600">Please contact your school administrator to set up the academic year.</p>
      </div>
    );
  }

  const { data: activeTerm, error: termError } = await supabase
    .from("terms")
    .select("term_id, name, is_active")
    .eq("school_id", schoolId)
    .eq("academic_year_id", activeAcademicYear.academic_year_id)
    .eq("is_active", true)
    .maybeSingle();

  if (termError || !activeTerm) {
    console.warn("No active term found:", termError);
    // Handle gracefully: show a message or redirect if critical
     return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold">No Active Term Configured</h1>
        <p className="text-gray-600">Please contact your school administrator to set up the current term.</p>
      </div>
    );
  }

  // Query parameters for filtering
  const selectedTermId = searchParams.term || activeTerm?.term_id;
  const selectedClassId = searchParams.class;
  const selectedStudentId = searchParams.student;
  const selectedStatus = searchParams.status;
  const currentPage = Number(searchParams.page) || 1;
  const itemsPerPage = 10; // Assuming 10 items per page for now
  const offset = (currentPage - 1) * itemsPerPage;

  let reportQuery = supabase
    .from("report_cards")
    .select(`
      report_id,
      student_id,
      class_id,
      term_id,
      academic_year_id,
      report_type,
      overall_average,
      overall_level,
      is_published,
      generated_at,
      pdf_url,
      students ( first_name, last_name, admission_number, photo_url ),
      classes ( name, stream ),
      terms ( name )
    `, { count: "exact" })
    .eq("school_id", schoolId)
    .eq("academic_year_id", activeAcademicYear.academic_year_id)
    .order("generated_at", { ascending: false })
    .range(offset, offset + itemsPerPage - 1);

  if (selectedTermId) {
    reportQuery = reportQuery.eq("term_id", selectedTermId);
  }
  if (selectedClassId) {
    reportQuery = reportQuery.eq("class_id", selectedClassId);
  }
  if (selectedStatus) {
    reportQuery = reportQuery.eq("is_published", selectedStatus === "published");
  }

  if (isParent) {
    const { data: guardianLinks, error: guardianError } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_user_id", userId);

    if (guardianError) {
      console.error("Error fetching guardian links:", guardianError);
      return <p>Error loading reports.</p>;
    }
    const childrenIds = guardianLinks?.map(link => link.student_id) || [];
    reportQuery = reportQuery.in("student_id", childrenIds);
  } else if (isStudent) {
    const { data: studentRecord, error: studentError } = await supabase
      .from("students")
      .select("student_id")
      .eq("user_id", userId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (studentError || !studentRecord?.student_id) {
      return <p>Error loading student reports.</p>;
    }

    reportQuery = reportQuery.eq("student_id", studentRecord.student_id);
  } else if (selectedStudentId) {
    reportQuery = reportQuery.eq("student_id", selectedStudentId);
  }

  const { data: reportCardsRaw, count, error: reportError } = await reportQuery;

  if (reportError) {
    console.error("Error fetching report cards:", reportError);
    return <p>Error loading report cards.</p>;
  }

  const reportCards: ReportCard[] =
    (reportCardsRaw as ReportCardRow[] | null)?.map((report) => ({
      report_id: report.report_id,
      student_id: report.student_id,
      class_id: report.class_id,
      term_id: report.term_id,
      academic_year_id: report.academic_year_id,
      report_type: report.report_type,
      overall_average: report.overall_average,
      overall_level: report.overall_level,
      class_teacher_remarks: null,
      principal_remarks: null,
      analytics_json: null,
      pdf_url: report.pdf_url,
      is_published: report.is_published,
      published_at: null,
      generated_at: report.generated_at,
      generated_by: null,
      students: firstRelation(report.students),
      classes: firstRelation(report.classes),
      terms: firstRelation(report.terms),
    })) ?? [];

  const totalPages = count ? Math.ceil(count / itemsPerPage) : 0;

  // Aggregate stats
  const totalReports = count || 0;
  const publishedReports = reportCards.filter((rc) => rc.is_published).length;
  const pendingReports = totalReports - publishedReports;
  const reportsWithScores = reportCards.filter((report) => report.overall_average !== null);
  const averagePerformance =
    reportsWithScores.length > 0
      ? reportsWithScores.reduce((sum, report) => sum + (report.overall_average ?? 0), 0) /
        reportsWithScores.length
      : null;

  const performanceLevels: Record<NonNullable<ReportCard["overall_level"]>, number> = {
    exceeding: 0,
    meeting: 0,
    approaching: 0,
    below_expectation: 0,
  };

  reportCards.forEach((rc) => {
    if (isReportLevel(rc.overall_level)) {
      performanceLevels[rc.overall_level]++;
    }
  });

  const getLevelBadgeVariant = (level: ReportCard["overall_level"]) => {
    switch (level) {
      case "exceeding": return "success";
      case "meeting": return "primary";
      case "approaching": return "warning";
      case "below_expectation": return "danger";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Cards"
        description="Manage and view student report cards."
        icon={<FileText className="h-6 w-6" />}
      >
        {isAdmin && (
          <Link
            href="/reports/generate"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            <Plus className="h-4 w-4" />
            Generate Reports
          </Link>
        )}
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-4">
            <CardTitle className="text-lg font-semibold">Total Reports</CardTitle>
            <p className="text-3xl font-bold">{totalReports}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-4">
            <CardTitle className="text-lg font-semibold">Published</CardTitle>
            <p className="text-3xl font-bold text-green-600">{publishedReports}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-4">
            <CardTitle className="text-lg font-semibold">Pending</CardTitle>
            <p className="text-3xl font-bold text-yellow-600">{pendingReports}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-4">
            <CardTitle className="text-lg font-semibold">Avg. Performance</CardTitle>
            <p className="text-3xl font-bold">
              {averagePerformance !== null ? averagePerformance.toFixed(2) : "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(performanceLevels).map(([level, count]) => (
          <Card key={level}>
            <CardContent className="flex flex-col items-center justify-center p-4">
              <CardTitle className="text-sm font-semibold capitalize">{level.replace(/_/g, " ")}</CardTitle>
              <p className="text-2xl font-bold"><Badge variant={getLevelBadgeVariant(level as ReportCard["overall_level"])}>{count}</Badge></p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters (simplified for now, full implementation would involve Client Components) */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="text-lg font-semibold mb-3">Filters</h3>
        <form method="GET" className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {selectedClassId ? <input type="hidden" name="class" value={selectedClassId} /> : null}
          {selectedStudentId ? <input type="hidden" name="student" value={selectedStudentId} /> : null}
          {selectedStatus ? <input type="hidden" name="status" value={selectedStatus} /> : null}
          <label className="block">
            <span className="text-gray-700">Term:</span>
            <Select name="term" defaultValue={selectedTermId || ""}>
              <option value="">All Terms</option>
              {activeTerm ? <option value={activeTerm.term_id}>{activeTerm.name}</option> : null}
            </Select>
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">Apply Filters</Button>
          </div>
        </form>
      </div>

      {/* Report Cards Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Report Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Avg. Score</TableHead>
                <TableHead>Performance Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Generated Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportCards.length > 0 ? (
                reportCards.map((report) => (
                  <TableRow key={report.report_id}>
                    <TableCell className="flex items-center space-x-2">
                      <img
                        src={report.students?.photo_url || `/api/placeholder/avatar?name=${getInitials(report.students?.first_name || "N A")}`}
                        alt={report.students?.first_name || "Student"}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium">{report.students?.first_name} {report.students?.last_name}</p>
                        <p className="text-sm text-gray-500">{report.students?.admission_number}</p>
                      </div>
                    </TableCell>
                    <TableCell>{report.classes?.name} {report.classes?.stream}</TableCell>
                    <TableCell>{report.terms?.name}</TableCell>
                    <TableCell>
                      {report.overall_average !== null ? report.overall_average.toFixed(2) : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getLevelBadgeVariant(report.overall_level)}>
                        {report.overall_level?.replace(/_/g, " ") || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={report.is_published ? "success" : "warning"}>
                        {report.is_published ? "Published" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(report.generated_at)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link
                        href={`/reports/${report.report_id}`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        <BookOpen className="mr-1 h-4 w-4" /> View
                      </Link>
                      {report.pdf_url && (
                        <a
                          href={report.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          <Download className="mr-1 h-4 w-4" /> PDF
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-4">
                    No report cards found for the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {/* Pagination */}
        {totalPages > 1 && (
          <CardFooter className="flex justify-between items-center">
            <Link
              aria-disabled={currentPage === 1}
              className={buttonVariants({ variant: "secondary", size: "md" })}
              href={`/reports?${new URLSearchParams({
                ...(selectedTermId ? { term: selectedTermId } : {}),
                ...(selectedClassId ? { class: selectedClassId } : {}),
                ...(selectedStudentId ? { student: selectedStudentId } : {}),
                ...(selectedStatus ? { status: selectedStatus } : {}),
                page: String(Math.max(1, currentPage - 1)),
              }).toString()}`}
            >
              Previous
            </Link>
            <span>Page {currentPage} of {totalPages}</span>
            <Link
              aria-disabled={currentPage === totalPages}
              className={buttonVariants({ variant: "secondary", size: "md" })}
              href={`/reports?${new URLSearchParams({
                ...(selectedTermId ? { term: selectedTermId } : {}),
                ...(selectedClassId ? { class: selectedClassId } : {}),
                ...(selectedStudentId ? { student: selectedStudentId } : {}),
                ...(selectedStatus ? { status: selectedStatus } : {}),
                page: String(Math.min(totalPages, currentPage + 1)),
              }).toString()}`}
            >
              Next
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
