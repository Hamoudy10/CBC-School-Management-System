import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  PageHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { Download, Eye, FileText, Plus, Printer } from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { RoleName } from "@/types/roles";

type RoleRelation = { name: string } | { name: string }[] | null;
type PerformanceLevel =
  | "below_expectation"
  | "approaching"
  | "meeting"
  | "exceeding"
  | null;

interface ReportRow {
  report_id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  academic_year_id: string;
  report_type: "term" | "yearly";
  overall_average: number | null;
  overall_level: PerformanceLevel;
  is_published: boolean;
  generated_at: string;
  students:
    | {
        first_name: string;
        last_name: string;
        admission_number: string;
      }
    | {
        first_name: string;
        last_name: string;
        admission_number: string;
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

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getRoleName(value: RoleRelation): string {
  return firstRelation(value)?.name ?? "student";
}

function titleCaseLevel(level: PerformanceLevel) {
  return level ? level.replace(/_/g, " ") : "Not Assessed";
}

function getLevelBadgeVariant(level: PerformanceLevel) {
  switch (level) {
    case "exceeding":
      return "success";
    case "meeting":
      return "primary";
    case "approaching":
      return "warning";
    case "below_expectation":
      return "danger";
    default:
      return "default";
  }
}

function getStatusBadgeVariant(isPublished: boolean) {
  return isPublished ? "success" : "warning";
}

function buildReportsQueryString(filters: Record<string, string>) {
  return new URLSearchParams(
    Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value.length > 0),
    ),
  ).toString();
}

function getLinkButtonClasses(
  variant: "primary" | "secondary" | "ghost" = "secondary",
  size: "sm" | "md" = "md",
) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-medium transition-all",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    size === "sm" ? "h-8 px-3 text-sm rounded-md" : "h-10 px-4 text-sm rounded-lg",
    variant === "primary" &&
      "bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500",
    variant === "secondary" &&
      "bg-secondary-100 text-secondary-700 hover:bg-secondary-200 focus-visible:ring-secondary-500",
    variant === "ghost" &&
      "text-secondary-600 bg-transparent hover:bg-secondary-100 hover:text-secondary-900 focus-visible:ring-secondary-500",
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
    reportType?: string;
    page?: string;
  };
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("user_id, school_id, roles ( name )")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (userError || !user?.school_id) {
    redirect("/login");
  }

  const roleName = getRoleName(user.roles as RoleRelation) as RoleName;
  const schoolId = user.school_id;
  const userId = user.user_id;
  const isParent = roleName === "parent";
  const isStudent = roleName === "student";
  const canViewReports = hasPermission(roleName, "reports", "view");
  const canGenerateReports = hasPermission(roleName, "reports", "create");
  const canExportReports = hasPermission(roleName, "reports", "export");

  if (!canViewReports) {
    redirect("/dashboard");
  }

  const { data: activeAcademicYear } = await supabase
    .from("academic_years")
    .select("academic_year_id, year, is_active")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  if (!activeAcademicYear) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">
          No Active Academic Year Configured
        </h1>
        <p className="text-gray-600">
          Please contact your school administrator to set up the academic year.
        </p>
      </div>
    );
  }

  const { data: terms } = await supabase
    .from("terms")
    .select("term_id, name, is_active")
    .eq("school_id", schoolId)
    .eq("academic_year_id", activeAcademicYear.academic_year_id)
    .order("start_date", { ascending: true });

  const { data: classes } = await supabase
    .from("classes")
    .select("class_id, name, stream")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  let studentOptions: Array<{
    student_id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
  }> = [];

  if (isParent) {
    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select(
        `
        student_id,
        students (
          student_id,
          first_name,
          last_name,
          admission_number
        )
      `,
      )
      .eq("guardian_user_id", userId);

    studentOptions = (guardianLinks ?? [])
      .map((row: any) => firstRelation(row.students))
      .filter(Boolean);
  } else if (isStudent) {
    const { data: studentRecord } = await supabase
      .from("students")
      .select("student_id, first_name, last_name, admission_number")
      .eq("user_id", userId)
      .eq("school_id", schoolId)
      .maybeSingle();

    studentOptions = studentRecord ? [studentRecord] : [];
  } else {
    const { data: schoolStudents } = await supabase
      .from("students")
      .select("student_id, first_name, last_name, admission_number")
      .eq("school_id", schoolId)
      .order("first_name", { ascending: true });

    studentOptions = schoolStudents ?? [];
  }

  const activeTerm = (terms ?? []).find((term) => term.is_active);
  const selectedTermId = searchParams.term || activeTerm?.term_id || "";
  const selectedClassId = searchParams.class || "";
  const selectedStudentId = searchParams.student || "";
  const selectedStatus = searchParams.status || "";
  const selectedReportType = searchParams.reportType || "";
  const currentPage = Number(searchParams.page) || 1;
  const pageSize = 12;
  const offset = (currentPage - 1) * pageSize;

  const applyFilters = (query: any) => {
    query = query
      .eq("school_id", schoolId)
      .eq("academic_year_id", activeAcademicYear.academic_year_id);

    if (selectedTermId) {
      query = query.eq("term_id", selectedTermId);
    }
    if (selectedClassId) {
      query = query.eq("class_id", selectedClassId);
    }
    if (selectedStudentId) {
      query = query.eq("student_id", selectedStudentId);
    }
    if (selectedStatus) {
      query = query.eq("is_published", selectedStatus === "published");
    }
    if (selectedReportType) {
      query = query.eq("report_type", selectedReportType);
    }

    if (isParent) {
      const childIds = studentOptions.map((student) => student.student_id);
      query = query.in("student_id", childIds.length > 0 ? childIds : ["__none__"]);
    } else if (isStudent) {
      query = query.eq(
        "student_id",
        studentOptions[0]?.student_id ?? "__none__",
      );
    }

    return query;
  };

  let reportQuery = supabase
    .from("report_cards")
    .select(
      `
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
      students ( first_name, last_name, admission_number ),
      classes ( name, stream ),
      terms ( name )
    `,
      { count: "exact" },
    )
    .order("generated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);
  reportQuery = applyFilters(reportQuery);

  let statsQuery = supabase
    .from("report_cards")
    .select("is_published, overall_average, overall_level");
  statsQuery = applyFilters(statsQuery);

  const [{ data: reportCardsRaw, count, error: reportError }, { data: statsRows }] =
    await Promise.all([reportQuery, statsQuery]);

  if (reportError) {
    console.error("Error fetching report cards:", reportError);
    return <p>Error loading report cards.</p>;
  }

  const reportCards = (reportCardsRaw as ReportRow[] | null) ?? [];
  const totalReports = count || 0;
  const publishedReports =
    statsRows?.filter((row: any) => row.is_published).length ?? 0;
  const pendingReports = totalReports - publishedReports;
  const averagePerformanceRows =
    statsRows?.filter((row: any) => row.overall_average !== null) ?? [];
  const averagePerformance =
    averagePerformanceRows.length > 0
      ? averagePerformanceRows.reduce(
          (sum: number, row: any) => sum + Number(row.overall_average ?? 0),
          0,
        ) / averagePerformanceRows.length
      : null;

  const totalPages = count ? Math.ceil(count / pageSize) : 0;
  const currentFilters: Record<string, string> = {
    ...(selectedTermId ? { term: selectedTermId } : {}),
    ...(selectedClassId ? { class: selectedClassId } : {}),
    ...(selectedStudentId ? { student: selectedStudentId } : {}),
    ...(selectedStatus ? { status: selectedStatus } : {}),
    ...(selectedReportType ? { reportType: selectedReportType } : {}),
  };
  const exportQuery = buildReportsQueryString(currentFilters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Cards"
        description="Review, print, and download generated report cards."
        icon={<FileText className="h-6 w-6" />}
      >
        <div className="flex flex-wrap items-center gap-2">
          {canExportReports ? (
            <a
              href={`/api/reports/export${exportQuery ? `?${exportQuery}` : ""}`}
              className={getLinkButtonClasses("secondary", "md")}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          ) : null}
          {canGenerateReports ? (
            <Link
              href="/reports/generate"
              className={getLinkButtonClasses("primary", "md")}
            >
              <Plus className="h-4 w-4" />
              Generate Reports
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Reports</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {totalReports}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Published</p>
            <p className="mt-1 text-3xl font-bold text-green-600">
              {publishedReports}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Draft</p>
            <p className="mt-1 text-3xl font-bold text-amber-600">
              {pendingReports}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Average Performance</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {averagePerformance !== null
                ? averagePerformance.toFixed(2)
                : "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="block">
              <span className="mb-1 block text-sm text-gray-700">Term</span>
              <Select name="term" defaultValue={selectedTermId}>
                <option value="">All Terms</option>
                {(terms ?? []).map((term) => (
                  <option key={term.term_id} value={term.term_id}>
                    {term.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-gray-700">Class</span>
              <Select name="class" defaultValue={selectedClassId}>
                <option value="">All Classes</option>
                {(classes ?? []).map((classItem) => (
                  <option key={classItem.class_id} value={classItem.class_id}>
                    {classItem.name}
                    {classItem.stream ? ` ${classItem.stream}` : ""}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-gray-700">Student</span>
              <Select name="student" defaultValue={selectedStudentId}>
                <option value="">All Students</option>
                {studentOptions.map((student) => (
                  <option key={student.student_id} value={student.student_id}>
                    {student.first_name} {student.last_name} ·{" "}
                    {student.admission_number}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-gray-700">Status</span>
              <Select name="status" defaultValue={selectedStatus}>
                <option value="">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </Select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-gray-700">Report Type</span>
              <Select name="reportType" defaultValue={selectedReportType}>
                <option value="">All Types</option>
                <option value="term">Term</option>
                <option value="yearly">Yearly</option>
              </Select>
            </label>

            <div className="flex items-end gap-2 xl:col-span-5">
              <Button type="submit" variant="secondary">
                Apply Filters
              </Button>
              <Link
                href="/reports"
                className={getLinkButtonClasses("ghost", "md")}
              >
                Reset
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Report Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Average</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportCards.length > 0 ? (
                reportCards.map((report) => {
                  const student = firstRelation(report.students);
                  const classItem = firstRelation(report.classes);
                  const term = firstRelation(report.terms);
                  const studentName = `${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim();

                  return (
                    <TableRow key={report.report_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                            {getInitials(studentName || "N A")}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {studentName || "Student"}
                            </p>
                            <p className="text-sm text-gray-500">
                              {student?.admission_number ?? "No admission number"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {classItem?.name}
                        {classItem?.stream ? ` ${classItem.stream}` : ""}
                      </TableCell>
                      <TableCell>{term?.name ?? "N/A"}</TableCell>
                      <TableCell className="capitalize">
                        {report.report_type}
                      </TableCell>
                      <TableCell>
                        {report.overall_average !== null
                          ? Number(report.overall_average).toFixed(2)
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getLevelBadgeVariant(report.overall_level)}>
                          {titleCaseLevel(report.overall_level)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(report.is_published)}>
                          {report.is_published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(report.generated_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/reports/${report.report_id}`}
                            className={getLinkButtonClasses("ghost", "sm")}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Link>
                          <a
                            href={`/api/reports/${report.report_id}/pdf?format=html`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={getLinkButtonClasses("ghost", "sm")}
                          >
                            <Printer className="mr-1 h-4 w-4" />
                            Print
                          </a>
                          <a
                            href={`/api/reports/${report.report_id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={getLinkButtonClasses("ghost", "sm")}
                          >
                            <Download className="mr-1 h-4 w-4" />
                            PDF
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-gray-500">
                    No report cards found for the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
          <CardFooter className="flex items-center justify-between">
            <Link
              href={`/reports?${buildReportsQueryString({
                ...currentFilters,
                page: String(Math.max(1, currentPage - 1)),
              })}`}
              className={getLinkButtonClasses("secondary", "md")}
            >
              Previous
            </Link>
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <Link
              href={`/reports?${buildReportsQueryString({
                ...currentFilters,
                page: String(Math.min(totalPages, currentPage + 1)),
              })}`}
              className={getLinkButtonClasses("secondary", "md")}
            >
              Next
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
