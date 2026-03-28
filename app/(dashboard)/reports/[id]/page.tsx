import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui";
import { ArrowLeft, Download, FileText, Printer } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReportCardById } from "@/features/assessments";
import { hasPermission } from "@/lib/auth/permissions";
import { cn, formatDate } from "@/lib/utils";
import type { RoleName } from "@/types/roles";
import { ReportCardOperations } from "../components/ReportCardOperations";

function titleCaseLevel(level: string | null | undefined) {
  if (!level) {
    return "Not Assessed";
  }

  return level.replace(/_/g, " ");
}

function getLinkButtonClasses(
  variant: "secondary" | "ghost" = "secondary",
  size: "sm" | "md" = "md",
) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-medium transition-all",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    size === "sm" ? "h-8 px-3 text-sm rounded-md" : "h-10 px-4 text-sm rounded-lg",
    variant === "secondary" &&
      "bg-secondary-100 text-secondary-700 hover:bg-secondary-200 focus-visible:ring-secondary-500",
    variant === "ghost" &&
      "text-secondary-600 bg-transparent hover:bg-secondary-100 hover:text-secondary-900 focus-visible:ring-secondary-500",
  );
}

export default async function ReportDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data: user } = await supabase
    .from("users")
    .select("user_id, school_id, roles ( name )")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (!user?.school_id) {
    redirect("/login");
  }

  const rawRole = Array.isArray(user.roles)
    ? (user.roles[0] as { name?: string } | undefined)?.name
    : (user.roles as { name?: string } | null)?.name;
  const role: RoleName = (rawRole as RoleName | undefined) ?? "student";
  const reportCard = await getReportCardById(params.id, {
    id: user.user_id,
    email: authUser.email ?? "",
    firstName: "",
    lastName: "",
    role,
    schoolId: user.school_id,
    status: "active",
    emailVerified: true,
  });

  if (!reportCard) {
    notFound();
  }

  if (role === "parent") {
    if (!reportCard.isPublished) {
      notFound();
    }

    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_user_id", user.user_id);

    const childIds = (guardianLinks ?? []).map((link: any) => link.student_id);
    if (!childIds.includes(reportCard.studentId)) {
      notFound();
    }
  }

  if (role === "student") {
    if (!reportCard.isPublished) {
      notFound();
    }

    const { data: studentRecord } = await supabase
      .from("students")
      .select("student_id")
      .eq("user_id", user.user_id)
      .maybeSingle();

    if (studentRecord?.student_id !== reportCard.studentId) {
      notFound();
    }
  }

  const analytics = reportCard.analyticsJson as any;
  const learningAreas = analytics?.learningAreas ?? [];
  const attendance = analytics?.attendance;
  const canManageRemarks = hasPermission(role, "reports", "update");
  const canPublishReport = hasPermission(role, "reports", "publish");

  return (
    <div className="space-y-6">
      <PageHeader
        title={reportCard.studentName ?? "Report Card"}
        description={`${reportCard.termName ?? "Term"} - ${reportCard.academicYear ?? "Academic Year"}`}
        icon={<FileText className="h-6 w-6" />}
      >
        <div className="flex items-center gap-2">
          <Link href="/reports" className={getLinkButtonClasses("secondary", "md")}>
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Link>
          <a
            href={`/api/reports/${params.id}/pdf?format=html`}
            target="_blank"
            rel="noopener noreferrer"
            className={getLinkButtonClasses("ghost", "md")}
          >
            <Printer className="h-4 w-4" />
            Print Preview
          </a>
          <a
            href={`/api/reports/${params.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={getLinkButtonClasses("ghost", "md")}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <ReportCardOperations
            reportId={reportCard.reportId}
            isPublished={reportCard.isPublished}
            canManageRemarks={canManageRemarks}
            canPublish={canPublishReport}
            classTeacherRemarks={reportCard.classTeacherRemarks}
            principalRemarks={reportCard.principalRemarks}
          />
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Average Score</p>
            <p className="text-2xl font-semibold">
              {reportCard.overallAverage?.toFixed(2) ?? "N/A"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Performance</p>
            <Badge variant="default">{titleCaseLevel(reportCard.overallLevel)}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Status</p>
            <Badge variant={reportCard.isPublished ? "success" : "warning"}>
              {reportCard.isPublished ? "Published" : "Draft"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Generated</p>
            <p className="text-sm font-medium">{formatDate(reportCard.generatedAt)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Student:</span> {reportCard.studentName ?? "N/A"}
          </p>
          <p>
            <span className="font-medium">Admission No:</span>{" "}
            {reportCard.studentAdmissionNo ?? "N/A"}
          </p>
          <p>
            <span className="font-medium">Class:</span> {reportCard.className ?? "N/A"}
          </p>
          <p>
            <span className="font-medium">Type:</span> {reportCard.reportType}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <a
            href={`/api/reports/${params.id}/pdf?format=html`}
            target="_blank"
            rel="noopener noreferrer"
            className={getLinkButtonClasses("ghost", "sm")}
          >
            <Printer className="h-4 w-4" />
            Open Print Preview
            </a>
            <a
            href={`/api/reports/${params.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={getLinkButtonClasses("ghost", "sm")}
          >
            <Download className="h-4 w-4" />
            Open PDF
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Learning Areas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {learningAreas.length > 0 ? (
            learningAreas.map((area: any) => (
              <div
                key={area.learningAreaId ?? area.learning_area_id ?? area.learningAreaName}
                className="rounded-lg border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {area.learningAreaName ?? area.name ?? "Learning Area"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {area.competencyCount ?? area.total_competencies ?? 0} competencies
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {typeof area.averageScore === "number"
                        ? area.averageScore.toFixed(2)
                        : typeof area.average_score === "number"
                          ? area.average_score.toFixed(2)
                          : "N/A"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {titleCaseLevel(area.level ?? area.performance_level)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No learning-area analytics are stored yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Remarks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium">Class Teacher</p>
            <p className="text-gray-600">{reportCard.classTeacherRemarks ?? "No remarks yet."}</p>
          </div>
          <div>
            <p className="font-medium">Principal</p>
            <p className="text-gray-600">{reportCard.principalRemarks ?? "No remarks yet."}</p>
          </div>
        </CardContent>
      </Card>

      {attendance ? (
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4 text-sm">
            <div>
              <p className="text-gray-500">Present</p>
              <p className="font-medium">{attendance.presentDays ?? attendance.present_days ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Absent</p>
              <p className="font-medium">{attendance.absentDays ?? attendance.absent_days ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Late</p>
              <p className="font-medium">{attendance.lateDays ?? attendance.late_days ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Rate</p>
              <p className="font-medium">
                {attendance.attendancePercentage ?? attendance.attendance_rate ?? 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
