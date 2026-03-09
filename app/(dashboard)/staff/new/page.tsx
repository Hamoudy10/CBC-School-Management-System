// app/(dashboard)/staff/new/page.tsx
// ============================================================
// Create New Staff Member Page
// Form for adding a new staff member to the system
// ============================================================

import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StaffForm } from '../components/StaffForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

// ============================================================
// Metadata
// ============================================================
export const metadata: Metadata = {
  title: 'Add Staff Member | School Management System',
  description: 'Create a new staff member account',
};

// ============================================================
// Data Fetching — Get Roles for Dropdown
// ============================================================
async function getFormData() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createSupabaseServerClient();

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

  return {
    roles: roles || [],
  };
}

// ============================================================
// Main Page Component
// ============================================================
export default async function NewStaffPage() {
  const formData = await getFormData();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href="/staff">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Staff
          </Button>
        </Link>
      </div>

      <PageHeader
        title="Add Staff Member"
        description="Create a new staff account with user credentials and employment details"
        icon={<UserPlus className="h-8 w-8 text-blue-600" />}
      />

      {/* Form Card */}
      <Card className="max-w-4xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Staff Information
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Fill in the details below to create a new staff member. An account will be created automatically.
          </p>
        </div>

        <div className="p-6">
          <StaffForm mode="create" roles={formData.roles} />
        </div>
      </Card>
    </div>
  );
}