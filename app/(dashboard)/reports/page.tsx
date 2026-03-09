import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatDate, formatCurrency, getInitials, cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Avatar,
  Button,
} from '@/components/ui';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  FileText,
  Download,
  Printer,
  Eye,
  Plus,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import ReportsFilters from './ReportsFilters';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportCard {
  report_card_id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  academic_year_id: string;
  school_id: string;
  overall_score: number | null;
  performance_level: string | null;
  status: string;
  published_at: string | null;
  generated_at: string | null;
  created_at: string;
  analytics_json: Record<string, unknown> | null;
  class_teacher_remarks: string | null;
  principal_remarks: string | null;
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
    name: string;
  } | null;
}

interface PageProps {
  searchParams: {
    term_id?: string;
    class_id?: string;
    status?: string;
    student_search?: string;
    page?: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const PERFORMANCE_LEVEL_CONFIG: Record<
  string,
  { label: string; variant: 'success' | 'primary' | 'warning' | 'error'; icon: typeof TrendingUp }
> = {
  exceeding: { label: 'Exceeding Expectations', variant: 'success', icon: TrendingUp },
  meeting: { label: 'Meeting Expectations', variant: 'primary', icon: CheckCircle },
  approaching: { label: 'Approaching Expectations', variant: 'warning', icon: Clock },
  below: { label: 'Below Expectations', variant: 'error', icon: TrendingDown },
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  published: { label: 'Published', variant: 'success' },
  draft: { label: 'Draft', variant: 'warning' },
  pending: { label: 'Pending', variant: 'default' },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function getPerformanceLevelKey(level: string | null): string {
  if (!level) return 'below';
  const normalized = level.toLowerCase().trim();
  if (normalized.includes('exceed')) return 'exceeding';
  if (normalized.includes('meet')) return 'meeting';
  if (normalized.includes('approach')) return 'approaching';
  return 'below';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportsPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();

  // 1. Verify session
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect('/login');

  // 2. Fetch user with role
  const { data: userData } = await supabase
    .from('users')
    .select('user_id, school_id, roles ( name )')
    .eq('user_id', authUser.id)
    .single();
  const user = userData as any;

  if (!user || !user.school_id) redirect('/login');

  const roleName = (user.roles as Record<string, string>)?.name ?? 'student';
  const schoolId = user.school_id;

  // 3. Role-based access — all roles can view reports, but scope differs
  const isAdmin = ['super_admin', 'school_admin', 'principal', 'deputy_principal'].includes(roleName);
  const isTeacher = ['teacher', 'class_teacher', 'subject_teacher'].includes(roleName);
  const isParent = roleName === 'parent';
  const isStudent = roleName === 'student';

  // 4. Get active academic year
  const { data: activeYearData } = await supabase
    .from('academic_years')
    .select('academic_year_id, name')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .maybeSingle();
  const activeYear = activeYearData as any;

  // 5. Fetch terms for filter dropdown
  let termsQuery = supabase
    .from('terms')
    .select('term_id, name, is_active')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false });

  if (activeYear) {
    termsQuery = termsQuery.eq('academic_year_id', activeYear.academic_year_id);
  }

  const { data: termsData } = await termsQuery;
  const terms = termsData as any[];

  // Determine selected term
  const activeTerm = terms?.find((t) => t.is_active) ?? null;
  const selectedTermId = searchParams.term_id || activeTerm?.term_id || '';

  // 6. Fetch classes for filter dropdown
  const { data: classesData } = await supabase
    .from('classes')
    .select('class_id, name, stream')
    .eq('school_id', schoolId)
    .order('name');
  const classes = classesData as any[];

  // 7. If parent, get linked children IDs
  let childrenIds: string[] = [];
  if (isParent) {
    const { data: guardianLinksData } = await supabase
      .from('student_guardians')
      .select('student_id')
      .eq('guardian_user_id', user.user_id);
    const guardianLinks = guardianLinksData as any[];

    childrenIds = guardianLinks?.map((l) => l.student_id) ?? [];

    if (childrenIds.length === 0) {
      return (
        <div className="space-y-6">
          <PageHeader
            title="Report Cards"
            description="View your children's academic reports"
            icon={<FileText className="h-6 w-6" />}
          />
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No Linked Students</h3>
              <p className="mt-2 text-sm text-gray-500">
                No students are linked to your account. Please contact the school administration.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // 8. If student, get own student record
  let studentId: string | null = null;
  if (isStudent) {
    const { data: studentRecordData } = await supabase
      .from('students')
      .select('student_id')
      .eq('user_id', user.user_id)
      .maybeSingle();
    const studentRecord = studentRecordData as any;

    studentId = studentRecord?.student_id ?? null;

    if (!studentId) {
      return (
        <div className="space-y-6">
          <PageHeader
            title="Report Cards"
            description="View your academic reports"
            icon={<FileText className="h-6 w-6" />}
          />
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No Student Record</h3>
              <p className="mt-2 text-sm text-gray-500">
                Your student profile could not be found. Please contact the school administration.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // 9. Build report cards query
  const currentPage = Math.max(1, parseInt(searchParams.page || '1', 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  let query = supabase
    .from('report_cards')
    .select(
      `
      *,
      students ( first_name, last_name, admission_number, photo_url ),
      classes ( name, stream ),
      terms ( name )
    `,
      { count: 'exact' }
    )
    .eq('school_id', schoolId)
    .order('generated_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  // Apply filters
  if (selectedTermId) {
    query = query.eq('term_id', selectedTermId);
  }

  if (searchParams.class_id) {
    query = query.eq('class_id', searchParams.class_id);
  }

  if (searchParams.status) {
    query = query.eq('status', searchParams.status);
  }

  // Role-based scoping
  if (isParent) {
    query = query.in('student_id', childrenIds);
  } else if (isStudent && studentId) {
    query = query.eq('student_id', studentId);
    query = query.eq('status', 'published'); // Students only see published reports
  } else if (isTeacher) {
    // Teachers see reports for their assigned classes
    const { data: teacherClassesData } = await supabase
      .from('classes')
      .select('class_id')
      .eq('school_id', schoolId)
      .eq('class_teacher_id', user.user_id);
    const teacherClasses = teacherClassesData as any[];

    const teacherClassIds = teacherClasses?.map((c) => c.class_id) ?? [];

    if (teacherClassIds.length > 0) {
      query = query.in('class_id', teacherClassIds);
    } else {
      // Teacher with no assigned classes sees nothing
      query = query.eq('class_id', '00000000-0000-0000-0000-000000000000');
    }
  }

  const { data: reportCards, count, error } = await query;

  if (error) {
    console.error('Failed to fetch report cards:', error.message);
  }

  const reports = (reportCards ?? []) as ReportCard[];
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 10. Compute stats from ALL reports for this term (not just current page)
  let statsQuery = supabase
    .from('report_cards')
    .select('report_card_id, status, performance_level, overall_score')
    .eq('school_id', schoolId);

  if (selectedTermId) {
    statsQuery = statsQuery.eq('term_id', selectedTermId);
  }

  if (isParent) {
    statsQuery = statsQuery.in('student_id', childrenIds);
  } else if (isStudent && studentId) {
    statsQuery = statsQuery.eq('student_id', studentId).eq('status', 'published');
  } else if (isTeacher) {
    const { data: tClassesData } = await supabase
      .from('classes')
      .select('class_id')
      .eq('school_id', schoolId)
      .eq('class_teacher_id', user.user_id);
    const tClasses = tClassesData as any[];

    const tClassIds = tClasses?.map((c) => c.class_id) ?? [];
    if (tClassIds.length > 0) {
      statsQuery = statsQuery.in('class_id', tClassIds);
    } else {
      statsQuery = statsQuery.eq('class_id', '00000000-0000-0000-0000-000000000000');
    }
  }

  const { data: allReportsData } = await statsQuery;
  const allReportsList = (allReportsData as any[]) ?? [];

  const totalReports = allReportsList.length;
  const publishedCount = allReportsList.filter((r) => r.status === 'published').length;
  const pendingCount = allReportsList.filter((r) => r.status !== 'published').length;

  const scoresWithValues = allReportsList.filter(
    (r) => r.overall_score !== null && r.overall_score !== undefined
  );
  const averageScore =
    scoresWithValues.length > 0
      ? scoresWithValues.reduce((sum, r) => sum + (r.overall_score ?? 0), 0) / scoresWithValues.length
      : 0;

  // Performance distribution
  const distribution = { exceeding: 0, meeting: 0, approaching: 0, below: 0 };
  allReportsList.forEach((r) => {
    const key = getPerformanceLevelKey(r.performance_level);
    distribution[key as keyof typeof distribution]++;
  });

  // ─── No Active Term Warning ──────────────────────────────────────────────

  const noActiveTerm = !activeYear && !selectedTermId;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Report Cards"
        description={
          isParent
            ? "View your children's academic reports"
            : isStudent
              ? 'View your academic reports'
              : 'Generate and manage student report cards'
        }
        icon={<FileText className="h-6 w-6" />}
      >
        {isAdmin && (
          <Link href="/reports/generate">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
              Generate Reports
            </Button>
          </Link>
        )}
      </PageHeader>

      {/* No Active Academic Year Warning */}
      {noActiveTerm && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">No Active Academic Year</p>
                <p className="text-sm text-amber-500">
                  There is no active academic year configured. Please set up an academic year and term
                  to manage report cards.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Reports</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{totalReports}</p>
              </div>
              <div className="rounded-full bg-blue-50 p-3">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Published</p>
                <p className="mt-1 text-2xl font-bold text-green-600">{publishedCount}</p>
              </div>
              <div className="rounded-full bg-green-50 p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{pendingCount}</p>
              </div>
              <div className="rounded-full bg-amber-50 p-3">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Average Score</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {averageScore > 0 ? averageScore.toFixed(1) : '—'}
                </p>
              </div>
              <div className="rounded-full bg-purple-50 p-3">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Distribution */}
      {totalReports > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(PERFORMANCE_LEVEL_CONFIG).map(([key, config]) => {
            const count = distribution[key as keyof typeof distribution];
            const percentage = totalReports > 0 ? ((count / totalReports) * 100).toFixed(1) : '0';
            const IconComponent = config.icon;

            return (
              <Card key={key}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Badge variant={config.variant}>
                      <IconComponent className="mr-1 h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-gray-900">{count}</span>
                    <span className="text-sm text-gray-500">({percentage}%)</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <ReportsFilters
        terms={terms ?? []}
        classes={classes ?? []}
        selectedTermId={selectedTermId}
        selectedClassId={searchParams.class_id || ''}
        selectedStatus={searchParams.status || ''}
        studentSearch={searchParams.student_search || ''}
        isAdmin={isAdmin}
        isParent={isParent}
        isStudent={isStudent}
      />

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Report Cards
            {totalCount > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({totalCount} {totalCount === 1 ? 'report' : 'reports'})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No Report Cards Found</h3>
              <p className="mt-2 text-sm text-gray-500">
                {isAdmin
                  ? 'No report cards have been generated yet. Click "Generate Reports" to create them.'
                  : 'No report cards are available for the selected filters.'}
              </p>
              {isAdmin && (
                <div className="mt-6">
                  <Link href="/reports/generate">
                    <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                      Generate Reports
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead className="text-center">Overall Score</TableHead>
                      <TableHead>Performance Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => {
                      const student = report.students;
                      const studentName = student
                        ? `${student.first_name} ${student.last_name}`
                        : 'Unknown';
                      const performanceKey = getPerformanceLevelKey(report.performance_level);
                      const performanceConfig = PERFORMANCE_LEVEL_CONFIG[performanceKey];
                      const statusConfig = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.pending;
                      const className = report.classes
                        ? report.classes.stream
                          ? `${report.classes.name} ${report.classes.stream}`
                          : report.classes.name
                        : '—';

                      return (
                        <TableRow key={report.report_card_id}>
                          {/* Student */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={student?.photo_url ?? undefined}
                                name={studentName}
                                size="sm"
                              />
                              <div>
                                <p className="font-medium text-gray-900">{studentName}</p>
                                <p className="text-xs text-gray-500">
                                  {student?.admission_number ?? '—'}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Class */}
                          <TableCell>
                            <span className="text-sm text-gray-700">{className}</span>
                          </TableCell>

                          {/* Term */}
                          <TableCell>
                            <span className="text-sm text-gray-700">
                              {report.terms?.name ?? '—'}
                            </span>
                          </TableCell>

                          {/* Overall Score */}
                          <TableCell className="text-center">
                            <span
                              className={cn(
                                'text-sm font-semibold',
                                report.overall_score !== null ? 'text-gray-900' : 'text-gray-400'
                              )}
                            >
                              {report.overall_score !== null
                                ? report.overall_score.toFixed(1)
                                : '—'}
                            </span>
                          </TableCell>

                          {/* Performance Level */}
                          <TableCell>
                            {report.performance_level ? (
                              <Badge variant={performanceConfig.variant}>
                                {performanceConfig.label}
                              </Badge>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                          </TableCell>

                          {/* Generated Date */}
                          <TableCell>
                            <span className="text-sm text-gray-500">
                              {report.generated_at ? formatDate(report.generated_at) : '—'}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/reports/${report.report_card_id}`}>
                                <Button variant="ghost" size="sm" title="View Report">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              {report.status === 'published' && (
                                <>
                                  <Link
                                    href={`/api/reports/${report.report_card_id}/pdf`}
                                    target="_blank"
                                  >
                                    <Button variant="ghost" size="sm" title="Download PDF">
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                  <Link
                                    href={`/api/reports/${report.report_card_id}/pdf?print=true`}
                                    target="_blank"
                                  >
                                    <Button variant="ghost" size="sm" title="Print">
                                      <Printer className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-gray-500">
                    Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)} of {totalCount}{' '}
                    reports
                  </p>
                  <div className="flex items-center gap-2">
                    {currentPage > 1 && (
                      <Link
                        href={{
                          pathname: '/reports',
                          query: {
                            ...searchParams,
                            page: String(currentPage - 1),
                          },
                        }}
                      >
                        <Button variant="secondary" size="sm">
                          Previous
                        </Button>
                      </Link>
                    )}

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        // Show first, last, current, and neighbors
                        return (
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - currentPage) <= 1
                        );
                      })
                      .map((p, idx, arr) => {
                        const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                        return (
                          <span key={p} className="flex items-center gap-1">
                            {showEllipsis && (
                              <span className="px-1 text-sm text-gray-400">…</span>
                            )}
                            <Link
                              href={{
                                pathname: '/reports',
                                query: {
                                  ...searchParams,
                                  page: String(p),
                                },
                              }}
                            >
                              <Button
                                variant={p === currentPage ? 'primary' : 'ghost'}
                                size="sm"
                              >
                                {p}
                              </Button>
                            </Link>
                          </span>
                        );
                      })}

                    {currentPage < totalPages && (
                      <Link
                        href={{
                          pathname: '/reports',
                          query: {
                            ...searchParams,
                            page: String(currentPage + 1),
                          },
                        }}
                      >
                        <Button variant="secondary" size="sm">
                          Next
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
