// app/(dashboard)/staff/[id]/assignments/new/page.tsx
// ============================================================
// Create Subject Assignment Page
// Form for assigning subjects/classes to a teacher
// ============================================================

import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, BookPlus, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { SubjectAssignmentForm } from './components/SubjectAssignmentForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  STAFF_POSITION_LABELS,
  type StaffPosition,
} from '@/features/staff';

// ============================================================
// Metadata
// ============================================================
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const data = await getStaffData(params.id);

  if (!data) {
    return {
      title: 'Staff Not Found | School Management System',
    };
  }

  return {
    title: `Assign Subjects to ${data.fullName} | School Management System`,
    description: `Assign learning areas and classes to ${data.fullName}`,
  };
}

// ============================================================
// Data Fetching
// ============================================================
async function getStaffData(staffId: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('staff')
    .select(
      `
      staff_id,
      school_id,
      user_id,
      position,
      status,
      users!inner (
        first_name,
        last_name,
        email,
        user_profiles (
          photo_url
        )
      )
    `
    )
    .eq('staff_id', staffId)
    .eq('school_id', user.schoolId as string)
    .single();

  if (error || !data) return null;

  const userData = data as any;
  const staffUsers = userData.users;
  const profile = staffUsers?.user_profiles?.[0];

  // Check if this is a teaching position
  const teachingPositions: StaffPosition[] = [
    'principal',
    'deputy_principal',
    'class_teacher',
    'subject_teacher',
  ];
  const isTeachingPosition = teachingPositions.includes(userData.position as StaffPosition);

  return {
    staffId: userData.staff_id,
    schoolId: userData.school_id,
    userId: userData.user_id,
    position: userData.position as StaffPosition,
    status: userData.status,
    firstName: staffUsers?.first_name,
    lastName: staffUsers?.last_name,
    fullName: `${staffUsers?.first_name} ${staffUsers?.last_name}`,
    email: staffUsers?.email,
    photoUrl: profile?.photo_url,
    isTeachingPosition,
    currentUser: user,
  };
}

async function getFormOptions(schoolId: string) {
  const supabase = await createSupabaseServerClient();

  // Fetch all required data in parallel
  const [
    learningAreasResult,
    classesResult,
    academicYearsResult,
    termsResult,
  ] = await Promise.all([
    // Learning areas
    supabase
      .from('learning_areas')
      .select('learning_area_id, name, is_core')
      .eq('school_id', schoolId)
      .order('name'),

    // Classes with grades
    supabase
      .from('classes')
      .select(
        `
        class_id,
        name,
        stream,
        is_active,
        grades!inner (
          grade_id,
          name,
          level_order
        )
      `
      )
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name'),

    // Academic years
    supabase
      .from('academic_years')
      .select('academic_year_id, year, is_active')
      .eq('school_id', schoolId)
      .order('year', { ascending: false }),

    // Terms
    supabase
      .from('terms')
      .select('term_id, name, is_active, academic_year_id')
      .eq('school_id', schoolId)
      .order('name'),
  ]);

  const normalizedClasses = (classesResult.data || []).map((item: any) => ({
    ...item,
    grades: Array.isArray(item.grades) ? item.grades[0] || null : item.grades,
  }));

  return {
    learningAreas: learningAreasResult.data || [],
    classes: normalizedClasses,
    academicYears: academicYearsResult.data || [],
    terms: termsResult.data || [],
  };
}

async function getExistingAssignments(staffId: string, schoolId: string) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('teacher_subjects')
    .select(
      `
      id,
      learning_area_id,
      class_id,
      academic_year_id,
      term_id,
      is_active,
      learning_areas!inner (name),
      classes!inner (name),
      terms!inner (name),
      academic_years!inner (year)
    `
    )
    .eq('teacher_id', staffId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return data || [];
}

// ============================================================
// Page Props
// ============================================================
interface NewAssignmentPageProps {
  params: { id: string };
}

// ============================================================
// Main Page Component
// ============================================================
export default async function NewAssignmentPage({ params }: NewAssignmentPageProps) {
  const staffData = await getStaffData(params.id);

  if (!staffData) {
    notFound();
  }

  // Check if staff can be assigned subjects
  if (!staffData.isTeachingPosition) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/staff/${staffData.staffId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Profile
            </Button>
          </Link>
        </div>

        <Card className="p-8 text-center">
          <div className="text-yellow-600 dark:text-yellow-400 mb-4">
            <AlertTriangle className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Cannot Assign Subjects
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Subject assignments are only available for teaching staff.
            This staff member's position is "{STAFF_POSITION_LABELS[staffData.position]}".
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            To assign subjects, the staff member must have one of these positions:
            Principal, Deputy Principal, Class Teacher, or Subject Teacher.
          </p>
        </Card>
      </div>
    );
  }

  // Check if staff is active
  if (staffData.status !== 'active') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/staff/${staffData.staffId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Profile
            </Button>
          </Link>
        </div>

        <Card className="p-8 text-center">
          <div className="text-yellow-600 dark:text-yellow-400 mb-4">
            <AlertTriangle className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Cannot Assign Subjects
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Subject assignments can only be made for active staff members.
            This staff member's status is currently "{staffData.status}".
          </p>
        </Card>
      </div>
    );
  }

  const [formOptions, existingAssignments] = await Promise.all([
    getFormOptions(staffData.schoolId),
    getExistingAssignments(staffData.staffId, staffData.schoolId),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href={`/staff/${staffData.staffId}?tab=assignments`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assignments
          </Button>
        </Link>
      </div>

      <PageHeader
        title="Assign Subjects"
        description={`Assign learning areas and classes to ${staffData.fullName}`}
        icon={<BookPlus className="h-8 w-8 text-blue-600" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Subject Assignment
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Select the learning area, class, academic year, and term for this assignment.
              </p>
            </div>

            <div className="p-6">
              <SubjectAssignmentForm
                staffId={staffData.staffId}
                learningAreas={formOptions.learningAreas}
                classes={formOptions.classes}
                academicYears={formOptions.academicYears}
                terms={formOptions.terms}
                existingAssignments={existingAssignments}
              />
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Staff Info Card */}
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              Assigning To
            </h3>

            <div className="flex items-center gap-3">
              <Avatar
                src={staffData.photoUrl}
                alt={staffData.fullName}
                name={staffData.fullName}
                size="lg"
              />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {staffData.fullName}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {STAFF_POSITION_LABELS[staffData.position]}
                </p>
              </div>
            </div>
          </Card>

          {/* Current Assignments Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Current Assignments
              </h3>
              <Badge variant="info" size="sm">
                {existingAssignments.length}
              </Badge>
            </div>

            {existingAssignments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No subjects assigned yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {existingAssignments.map((assignment: any) => (
                  <div
                    key={assignment.id}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                      {assignment.learning_areas?.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {assignment.classes?.name} • {assignment.terms?.name}{' '}
                      {assignment.academic_years?.year}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Help Card */}
          <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-3">
              Assignment Tips
            </h3>

            <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Each assignment links a teacher to a specific subject and class
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Assignments are term-specific for accurate scheduling
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                A teacher can be assigned multiple subjects and classes
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Use bulk assignment mode to add multiple subjects at once
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
