import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
} from '@/components/ui';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import {
  FileText,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import { hasPermission } from '@/lib/auth/permissions';
import type { RoleName } from '@/types/roles';
import ReportGenerationClient from './ReportGenerationClient';

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GenerateReportsPage() {
  const supabase = await createSupabaseServerClient();

  // 1. Verify session
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {redirect('/login');}

  // 2. Fetch user with role
  const { data: user } = await supabase
    .from('users')
    .select('user_id, school_id, roles ( name )')
    .eq('user_id', authUser.id)
    .single();

  if (!user || !(user as any).school_id) {redirect('/login');}

  const roleName =
    ((firstRelation((user as any).roles as any)?.name as RoleName | undefined) ??
      'student');
  const schoolId = (user as any).school_id;

  // 3. Only roles with report-generation permission can access this page
  if (!hasPermission(roleName, 'reports', 'create')) {redirect('/dashboard');}

  // 4. Get active academic year
  const { data: activeYear } = await supabase
    .from('academic_years')
    .select('academic_year_id, year')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .maybeSingle();

  if (!activeYear) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Generate Report Cards"
          description="Bulk generate student report cards"
          icon={<FileText className="h-6 w-6" />}
        >
          <Link href="/reports">
            <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to Reports
            </Button>
          </Link>
        </PageHeader>

        <Alert variant="warning">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">No Active Academic Year</p>
              <p className="text-sm">
                You must set up an active academic year before generating report cards. Please
                configure this in the Settings module.
              </p>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  // 5. Fetch terms for the active academic year
  const { data: terms } = await supabase
    .from('terms')
    .select('term_id, name, is_active, start_date, end_date')
    .eq('school_id', schoolId)
    .eq('academic_year_id', (activeYear as any).academic_year_id)
    .order('start_date', { ascending: true });

  const termsList = terms ?? [];

  if (termsList.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Generate Report Cards"
          description="Bulk generate student report cards"
          icon={<FileText className="h-6 w-6" />}
        >
          <Link href="/reports">
            <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to Reports
            </Button>
          </Link>
        </PageHeader>

        <Alert variant="warning">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">No Terms Configured</p>
              <p className="text-sm">
                The active academic year &quot;{(activeYear as any).year}&quot; has no terms defined. Please
                add terms before generating report cards.
              </p>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  // 6. Fetch all classes
  const { data: classes } = await supabase
    .from('classes')
    .select(`
      class_id,
      name,
      stream,
      grades ( name, level_order )
    `)
    .eq('school_id', schoolId)
    .order('name', { ascending: true });

  const classesList = (classes ?? []).map((cls) => ({
    class_id: (cls as any).class_id as string,
    name: (cls as any).name as string,
    stream: (cls as any).stream as string | null,
    grade_name: (firstRelation((cls as any).grades as any)?.name as string | undefined) ?? '',
    grade_level: String(
      (firstRelation((cls as any).grades as any)?.level_order as string | number | undefined) ?? '',
    ),
  }));

  // 7. Fetch student counts per class for preview
  const { data: studentCounts } = await supabase
    .from('students')
    .select('current_class_id')
    .eq('school_id', schoolId)
    .eq('status', 'active');

  const countsMap: Record<string, number> = {};
  (studentCounts ?? []).forEach((s) => {
    const classId = (s as Record<string, unknown>).current_class_id as string | null;
    if (classId) {
      countsMap[classId] = (countsMap[classId] ?? 0) + 1;
    }
  });

  // 8. Fetch existing report card counts per class+term to show what's already generated
  const activeTerm = (termsList as any[]).find((t) => t.is_active) ?? null;
  const defaultTermId = activeTerm?.term_id ?? (termsList as any[])[0]?.term_id ?? '';

  const { data: existingReports } = await supabase
    .from('report_cards')
    .select('class_id, term_id')
    .eq('school_id', schoolId)
    .eq('academic_year_id', (activeYear as any).academic_year_id);

  const existingMap: Record<string, number> = {};
  (existingReports ?? []).forEach((r) => {
    const key = `${(r as any).class_id}_${(r as any).term_id}`;
    existingMap[key] = (existingMap[key] ?? 0) + 1;
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Generate Report Cards"
        description={`Academic Year: ${(activeYear as any).name}`}
        icon={<FileText className="h-6 w-6" />}
      >
        <Link href="/reports">
          <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Reports
          </Button>
        </Link>
      </PageHeader>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3 text-blue-700">
            <FileText className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">How Report Generation Works</p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-blue-600">
                <li>Select a term and one or more classes to generate reports for</li>
                <li>
                  Reports are generated using assessment data already entered for the selected term
                </li>
                <li>
                  If reports already exist for a class+term combination, you can choose to
                  regenerate them
                </li>
                <li>
                  Generated reports start in &quot;Draft&quot; status — review before publishing
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generation Form */}
      <ReportGenerationClient
        terms={termsList}
        classes={classesList}
        activeTermId={defaultTermId}
        activeYear={{ 
          academic_year_id: (activeYear as any).academic_year_id, 
          year: (activeYear as any).year 
        }}
        schoolId={schoolId}
        roleName={roleName}
        learningAreas={[]}
      />
    </div>
  );
}
