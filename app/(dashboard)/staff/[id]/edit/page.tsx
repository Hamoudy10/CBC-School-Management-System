// app/(dashboard)/staff/[id]/edit/page.tsx
// ============================================================
// Edit Staff Member Page
// Form for updating an existing staff member's details
// ============================================================

import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Edit } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StaffForm } from '../../components/StaffForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import type { StaffPosition, StaffStatus, ContractType } from '@/features/staff';

// ============================================================
// Metadata
// ============================================================
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const data = await getStaffForEdit(params.id);

  if (!data.staff) {
    return {
      title: 'Staff Not Found | School Management System',
    };
  }

  const fullName = `${data.staff.firstName} ${data.staff.lastName}`;

  return {
    title: `Edit ${fullName} | Staff | School Management System`,
    description: `Update profile and details for ${fullName}`,
  };
}

// ============================================================
// Data Fetching
// ============================================================
async function getStaffForEdit(staffId: string) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect('/login');

  const supabase = await createSupabaseServerClient();

  // Fetch staff data
  const { data: staffDataRaw, error: staffError } = await supabase
    .from('staff')
    .select(
      `
      staff_id,
      school_id,
      user_id,
      tsc_number,
      position,
      employment_date,
      contract_type,
      qualification,
      status,
      users!inner (
        email,
        first_name,
        last_name,
        middle_name,
        phone,
        gender,
        role_id,
        roles!inner (
          role_id,
          name
        )
      )
    `
    )
    .eq('staff_id', staffId)
    .eq('school_id', user.schoolId!)
    .single();

  const staffData: any = staffDataRaw;

  // Fetch staff-eligible roles
  const { data: roles } = await supabase
    .from('roles')
    .select('role_id, name, description')
    .in('name', [
      'principal',
      'deputy_principal',
      'teacher',
      'class_teacher',
      'subject_teacher',
      'finance_officer',
      'bursar',
      'librarian',
      'ict_admin',
    ])
    .order('name');

  if (staffError || !staffData) {
    return { staff: null, roles: roles || [] };
  }

  const userData = staffData.users as any;

  return {
    staff: {
      staffId: staffData.staff_id,
      userId: staffData.user_id,
      email: userData?.email,
      firstName: userData?.first_name,
      lastName: userData?.last_name,
      middleName: userData?.middle_name,
      phone: userData?.phone,
      gender: userData?.gender as 'male' | 'female' | 'other' | null,
      roleId: userData?.role_id,
      roleName: userData?.roles?.name,
      tscNumber: staffData.tsc_number,
      position: staffData.position as StaffPosition,
      employmentDate: staffData.employment_date,
      contractType: staffData.contract_type as ContractType | null,
      qualification: staffData.qualification,
      status: staffData.status as StaffStatus,
    },
    roles: roles || [],
  };
}

// ============================================================
// Page Props
// ============================================================
interface EditStaffPageProps {
  params: { id: string };
}

// ============================================================
// Main Page Component
// ============================================================
export default async function EditStaffPage({ params }: EditStaffPageProps) {
  const { staff, roles } = await getStaffForEdit(params.id);

  if (!staff) {
    notFound();
  }

  const fullName = `${staff.firstName} ${staff.lastName}`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href={`/staff/${staff.staffId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
        </Link>
      </div>

      <PageHeader
        title={`Edit ${fullName}`}
        description="Update staff member details and employment information"
        icon={<Edit className="h-8 w-8 text-blue-600" />}
      />

      {/* Form Card */}
      <Card className="max-w-4xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Staff Information
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Update the staff member's profile, contact information, and employment details.
          </p>
        </div>

        <div className="p-6">
          <StaffForm
            mode="edit"
            staffId={staff.staffId}
            defaultValues={staff}
            roles={roles}
          />
        </div>
      </Card>
    </div>
  );
}