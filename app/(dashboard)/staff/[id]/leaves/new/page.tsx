// app/(dashboard)/staff/[id]/leaves/new/page.tsx
// ============================================================
// Create Leave Request Page
// Form for submitting a new leave request for a staff member
// ============================================================

import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CalendarPlus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { LeaveRequestForm } from './components/LeaveRequestForm';
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
    title: `Request Leave for ${data.fullName} | School Management System`,
    description: `Submit a leave request for ${data.fullName}`,
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
    .eq('school_id', user.schoolId)
    .single();

  if (error || !data) return null;

  const userData = data.users as any;
  const profile = userData?.user_profiles?.[0];

  return {
    staffId: data.staff_id,
    userId: data.user_id,
    position: data.position as StaffPosition,
    status: data.status,
    firstName: userData?.first_name,
    lastName: userData?.last_name,
    fullName: `${userData?.first_name} ${userData?.last_name}`,
    email: userData?.email,
    photoUrl: profile?.photo_url,
    isSelf: data.user_id === user.id,
    currentUser: user,
  };
}

async function getExistingLeaves(staffId: string, schoolId: string) {
  const supabase = await createSupabaseServerClient();

  // Get approved and pending leaves for the current year
  const currentYear = new Date().getFullYear();
  const { data } = await supabase
    .from('staff_leaves')
    .select('leave_id, leave_type, start_date, end_date, status')
    .eq('staff_id', staffId)
    .eq('school_id', schoolId)
    .in('status', ['approved', 'pending'])
    .gte('start_date', `${currentYear}-01-01`)
    .order('start_date', { ascending: true });

  return data || [];
}

// ============================================================
// Page Props
// ============================================================
interface NewLeavePageProps {
  params: { id: string };
}

// ============================================================
// Main Page Component
// ============================================================
export default async function NewLeavePage({ params }: NewLeavePageProps) {
  const staffData = await getStaffData(params.id);

  if (!staffData) {
    notFound();
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
            <CalendarPlus className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Cannot Request Leave
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Leave requests can only be submitted for active staff members.
            This staff member's status is currently "{staffData.status}".
          </p>
        </Card>
      </div>
    );
  }

  const existingLeaves = await getExistingLeaves(
    staffData.staffId,
    staffData.currentUser.schoolId!
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href={`/staff/${staffData.staffId}?tab=leaves`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leaves
          </Button>
        </Link>
      </div>

      <PageHeader
        title="Request Leave"
        description={
          staffData.isSelf
            ? 'Submit a new leave request for yourself'
            : `Submit a leave request on behalf of ${staffData.fullName}`
        }
        icon={<CalendarPlus className="h-8 w-8 text-blue-600" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Leave Request Details
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Fill in the leave type, dates, and reason for your request.
              </p>
            </div>

            <div className="p-6">
              <LeaveRequestForm
                staffId={staffData.staffId}
                existingLeaves={existingLeaves}
              />
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Staff Info Card */}
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              Requesting For
            </h3>

            <div className="flex items-center gap-3">
              <Avatar
                src={staffData.photoUrl}
                alt={staffData.fullName}
                fallback={`${staffData.firstName?.[0] || ''}${staffData.lastName?.[0] || ''}`}
                size="lg"
              />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {staffData.fullName}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {STAFF_POSITION_LABELS[staffData.position]}
                </p>
                {staffData.isSelf && (
                  <Badge color="blue" size="sm" className="mt-1">
                    Your Account
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Existing Leaves Card */}
          {existingLeaves.length > 0 && (
            <Card className="p-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                Scheduled Leaves ({new Date().getFullYear()})
              </h3>

              <div className="space-y-3">
                {existingLeaves.slice(0, 5).map((leave: any) => {
                  const startDate = new Date(leave.start_date);
                  const endDate = new Date(leave.end_date);
                  const isPending = leave.status === 'pending';

                  return (
                    <div
                      key={leave.leave_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {startDate.toLocaleDateString('en-KE', {
                            month: 'short',
                            day: 'numeric',
                          })}
                          {' - '}
                          {endDate.toLocaleDateString('en-KE', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">
                          {leave.leave_type.replace('_', ' ')}
                        </p>
                      </div>
                      <Badge
                        color={isPending ? 'yellow' : 'green'}
                        size="sm"
                      >
                        {isPending ? 'Pending' : 'Approved'}
                      </Badge>
                    </div>
                  );
                })}

                {existingLeaves.length > 5 && (
                  <Link
                    href={`/staff/${staffData.staffId}?tab=leaves`}
                    className="block text-center text-sm text-blue-600 dark:text-blue-400 hover:underline pt-2"
                  >
                    View all {existingLeaves.length} leaves
                  </Link>
                )}
              </div>
            </Card>
          )}

          {/* Leave Policy Card */}
          <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-3">
              Leave Policy
            </h3>

            <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Annual leave: 21 working days per year
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Sick leave: Up to 30 days with medical certificate
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Maternity leave: 90 days
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Paternity leave: 14 days
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Submit requests at least 7 days in advance
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}