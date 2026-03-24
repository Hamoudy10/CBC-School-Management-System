import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export default async function CompliancePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  if (user.role === "parent") {
    const { data: consentRows } = await supabase
      .from("parent_consents")
      .select(
        `
        id,
        consent_type,
        status,
        updated_at,
        date_given,
        date_withdrawn,
        students!parent_consents_student_id_fkey(
          first_name,
          last_name,
          admission_number
        )
      `,
      )
      .eq("guardian_user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(12);

    const consents = consentRows ?? [];
    const pending = consents.filter((row: any) => row.status === "pending").length;
    const granted = consents.filter((row: any) => row.status === "granted").length;
    const withdrawn = consents.filter((row: any) => row.status === "withdrawn").length;

    return (
      <div className="space-y-6">
        <PageHeader
          title="Compliance"
          description="Review and manage consent records for your linked students."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Total Consent Records</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{consents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="mt-2 text-3xl font-semibold text-amber-600">{pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Granted / Withdrawn</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {granted} / {withdrawn}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Consent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {consents.length === 0 ? (
              <p className="text-sm text-gray-500">No consent records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Student
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Consent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {consents.map((row: any) => {
                      const student = Array.isArray(row.students)
                        ? row.students[0]
                        : row.students;

                      return (
                        <tr key={row.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {student
                              ? `${student.first_name} ${student.last_name} (${student.admission_number})`
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.consent_type}</td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant={row.status === "granted" ? "success" : "default"}>
                              {row.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(row.updated_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [totalIncidentsResult, openIncidentsResult, pendingConsentsResult, recentIncidentsResult, recentAuditResult] =
    await Promise.all([
      supabase
        .from("disciplinary_records")
        .select("id", { count: "exact", head: true })
        .eq("school_id", user.schoolId!),
      supabase
        .from("disciplinary_records")
        .select("id", { count: "exact", head: true })
        .eq("school_id", user.schoolId!)
        .neq("status", "resolved"),
      supabase
        .from("parent_consents")
        .select("id", { count: "exact", head: true })
        .eq("school_id", user.schoolId!)
        .eq("status", "pending"),
      supabase
        .from("disciplinary_records")
        .select(
          `
          id,
          incident_type,
          status,
          incident_date,
          students!disciplinary_records_student_id_fkey(first_name, last_name, admission_number)
        `,
        )
        .eq("school_id", user.schoolId!)
        .order("incident_date", { ascending: false })
        .limit(8),
      hasPermission(user.role, "audit_logs", "view")
        ? supabase
            .from("audit_logs")
            .select("id, table_name, action, performed_at")
            .eq("school_id", user.schoolId!)
            .order("performed_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const recentIncidents = recentIncidentsResult.data ?? [];
  const recentAudit = recentAuditResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Monitor discipline, consent activity, and recent audit events."
      >
        <Link href="/discipline">
          <Button size="sm">Open Discipline</Button>
        </Link>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Total Incidents</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {totalIncidentsResult.count ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Open Incidents</p>
            <p className="mt-2 text-3xl font-semibold text-amber-600">
              {openIncidentsResult.count ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Pending Consents</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {pendingConsentsResult.count ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Discipline Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentIncidents.length === 0 ? (
              <p className="text-sm text-gray-500">No discipline records found.</p>
            ) : (
              <div className="space-y-3">
                {recentIncidents.map((row: any) => {
                  const student = Array.isArray(row.students)
                    ? row.students[0]
                    : row.students;

                  return (
                    <div
                      key={row.id}
                      className="rounded-lg border border-gray-200 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">{row.incident_type}</p>
                          <p className="text-sm text-gray-500">
                            {student
                              ? `${student.first_name} ${student.last_name} (${student.admission_number})`
                              : "Unknown student"}
                          </p>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <Badge variant={row.status === "resolved" ? "success" : "default"}>
                            {row.status}
                          </Badge>
                          <p className="mt-1">{formatDate(row.incident_date)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Audit Events</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasPermission(user.role, "audit_logs", "view") ? (
              <p className="text-sm text-gray-500">
                Your role can access compliance operations, but not the audit log.
              </p>
            ) : recentAudit.length === 0 ? (
              <p className="text-sm text-gray-500">No recent audit events found.</p>
            ) : (
              <div className="space-y-3">
                {recentAudit.map((row: any) => (
                  <div
                    key={row.id}
                    className="rounded-lg border border-gray-200 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {row.action} on {row.table_name}
                        </p>
                        <p className="text-sm text-gray-500">{formatDate(row.performed_at)}</p>
                      </div>
                      <Badge variant="default">{row.action}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
