// app/(dashboard)/staff/[id]/page.tsx
// ============================================================
// Staff Detail Page — View Single Staff Member
// Displays full profile, leaves, assignments, and actions
// ============================================================

import { Suspense } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Briefcase,
  User,
  Shield,
  Clock,
  BookOpen,
  AlertTriangle,
  MoreVertical,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { CardSkeleton } from '@/components/ui/Skeletons';
import { StaffLeavesList } from './components/StaffLeavesList';
import { StaffAssignmentsList } from './components/StaffAssignmentsList';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import {
  STAFF_POSITION_LABELS,
  STAFF_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  type StaffPosition,
  type StaffStatus,
  type ContractType,
} from '@/features/staff';

// ============================================================
// Metadata
// ============================================================
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const staff = await getStaffData(params.id);

  if (!staff) {
    return {
      title: 'Staff Not Found | School Management System',
    };
  }

  const fullName = `${staff.firstName} ${staff.lastName}`;

  return {
    title: `${fullName} | Staff | School Management System`,
    description: `View profile and details for ${fullName}`,
  };
}

// ============================================================
// Data Fetching
// ============================================================
async function getStaffData(staffId: string) {
  const user = await getCurrentUser();
  if (!user) {return null;}

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
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
      created_at,
      updated_at,
      users!inner (
        email,
        first_name,
        last_name,
        middle_name,
        phone,
        gender,
        status,
        last_login_at,
        roles!inner (
          name
        ),
        user_profiles (
          photo_url,
          date_of_birth,
          national_id,
          address,
          emergency_contact_name,
          emergency_contact_phone,
          blood_group,
          medical_conditions
        )
      )
    `
    )
    .eq('staff_id', staffId)
    .eq('school_id', user.schoolId)
    .single();

  if (error || !data) {return null;}

  const userData = data.users as any;
  const profile = userData?.user_profiles?.[0] || {};

  return {
    staffId: data.staff_id,
    schoolId: data.school_id,
    userId: data.user_id,
    tscNumber: data.tsc_number,
    position: data.position as StaffPosition,
    employmentDate: data.employment_date,
    contractType: data.contract_type as ContractType | null,
    qualification: data.qualification,
    status: data.status as StaffStatus,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    email: userData?.email,
    firstName: userData?.first_name,
    lastName: userData?.last_name,
    middleName: userData?.middle_name,
    phone: userData?.phone,
    gender: userData?.gender,
    userStatus: userData?.status,
    lastLoginAt: userData?.last_login_at,
    roleName: userData?.roles?.name,
    photoUrl: profile.photo_url,
    dateOfBirth: profile.date_of_birth,
    nationalId: profile.national_id,
    address: profile.address,
    emergencyContactName: profile.emergency_contact_name,
    emergencyContactPhone: profile.emergency_contact_phone,
    bloodGroup: profile.blood_group,
    medicalConditions: profile.medical_conditions,
  };
}

async function getStaffStats(staffId: string, schoolId: string) {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().split('T')[0];

  const [leavesResult, assignmentsResult, pendingLeavesResult] = await Promise.all([
    // Total leaves taken this year
    supabase
      .from('staff_leaves')
      .select('leave_id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('status', 'approved')
      .gte('start_date', `${new Date().getFullYear()}-01-01`),

    // Active subject assignments
    supabase
      .from('teacher_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', staffId)
      .eq('is_active', true),

    // Pending leave requests
    supabase
      .from('staff_leaves')
      .select('leave_id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('status', 'pending'),
  ]);

  return {
    leavesThisYear: leavesResult.count || 0,
    activeAssignments: assignmentsResult.count || 0,
    pendingLeaves: pendingLeavesResult.count || 0,
  };
}

// ============================================================
// Status Colors
// ============================================================
const statusColors: Record<StaffStatus, 'green' | 'gray' | 'yellow' | 'red'> = {
  active: 'green',
  inactive: 'gray',
  suspended: 'yellow',
  archived: 'red',
};

// ============================================================
// Page Props
// ============================================================
interface StaffDetailPageProps {
  params: { id: string };
  searchParams: { tab?: string };
}

// ============================================================
// Main Page Component
// ============================================================
export default async function StaffDetailPage({
  params,
  searchParams,
}: StaffDetailPageProps) {
  const staff = await getStaffData(params.id);

  if (!staff) {
    notFound();
  }

  const currentUser = await getCurrentUser();
  const canViewStaff = currentUser
    ? hasPermission(currentUser.role, 'teachers', 'view')
    : false;
  const canManageStaff = currentUser
    ? hasPermission(currentUser.role, 'teachers', 'create') ||
      hasPermission(currentUser.role, 'teachers', 'update') ||
      hasPermission(currentUser.role, 'teachers', 'delete')
    : false;

  const stats = await getStaffStats(staff.staffId, staff.schoolId);
  const fullName = `${staff.firstName} ${staff.lastName}`;
  const requestedTab = searchParams.tab || 'overview';
  const availableTabs = [
    { key: 'overview', allowed: canViewStaff },
    { key: 'leaves', allowed: canManageStaff },
    { key: 'assignments', allowed: canManageStaff },
  ].filter((tab) => tab.allowed);
  const activeTab =
    availableTabs.find((tab) => tab.key === requestedTab)?.key
    ?? availableTabs[0]?.key
    ?? 'overview';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/staff">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Staff
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/staff/${staff.staffId}/edit`}>
            <Button variant="outline" size="md">
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </Link>

          <Dropdown
            trigger={
              <Button variant="outline" size="md">
                <MoreVertical className="h-4 w-4" />
              </Button>
            }
          >
            <DropdownItem href={`/staff/${staff.staffId}/leaves/new`}>
              Request Leave
            </DropdownItem>
            <DropdownItem href={`/staff/${staff.staffId}/assignments/new`}>
              Assign Subject
            </DropdownItem>
            <DropdownItem
              href={`/staff/${staff.staffId}/deactivate`}
              variant="danger"
            >
              Deactivate Staff
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      {/* Profile Header Card */}
      <Card className="overflow-hidden">
        {/* Cover / Gradient Background */}
        <div className="h-32 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600" />

        <div className="px-6 pb-6">
          {/* Avatar + Basic Info */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            <Avatar
              src={staff.photoUrl}
              alt={fullName}
              fallback={`${staff.firstName?.[0] || ''}${staff.lastName?.[0] || ''}`}
              size="xl"
              className="ring-4 ring-white dark:ring-gray-900 h-24 w-24"
            />

            <div className="flex-1 sm:mb-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {fullName}
                </h1>
                <Badge color={statusColors[staff.status]}>
                  {STAFF_STATUS_LABELS[staff.status]}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {STAFF_POSITION_LABELS[staff.position]}
                </span>
                {staff.tscNumber && (
                  <span className="flex items-center gap-1 font-mono">
                    <Award className="h-4 w-4" />
                    TSC: {staff.tscNumber}
                  </span>
                )}
                {staff.roleName && (
                  <span className="flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    {staff.roleName
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <QuickStat
              icon={<Calendar className="h-5 w-5" />}
              label="Employment Date"
              value={
                staff.employmentDate
                  ? new Date(staff.employmentDate).toLocaleDateString('en-KE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
            <QuickStat
              icon={<BookOpen className="h-5 w-5" />}
              label="Active Subjects"
              value={stats.activeAssignments.toString()}
            />
            <QuickStat
              icon={<Clock className="h-5 w-5" />}
              label="Leaves This Year"
              value={stats.leavesThisYear.toString()}
            />
            <QuickStat
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Pending Requests"
              value={stats.pendingLeaves.toString()}
              highlight={stats.pendingLeaves > 0}
            />
          </div>
        </div>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue={activeTab}>
        <TabsList>
          {availableTabs.some((tab) => tab.key === 'overview') && (
            <TabsTrigger value="overview" href={`/staff/${staff.staffId}?tab=overview`}>
              Overview
            </TabsTrigger>
          )}
          {availableTabs.some((tab) => tab.key === 'leaves') && (
            <TabsTrigger value="leaves" href={`/staff/${staff.staffId}?tab=leaves`}>
              Leaves
              {stats.pendingLeaves > 0 && (
                <Badge color="red" size="sm" className="ml-2">
                  {stats.pendingLeaves}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {availableTabs.some((tab) => tab.key === 'assignments') && (
            <TabsTrigger value="assignments" href={`/staff/${staff.staffId}?tab=assignments`}>
              Assignments
              <Badge color="blue" size="sm" className="ml-2">
                {stats.activeAssignments}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        {availableTabs.some((tab) => tab.key === 'overview') && (
          <TabsContent value="overview" active={activeTab === 'overview'}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact Information */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Contact Information
              </h3>

              <dl className="space-y-4">
                <InfoRow
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  value={staff.email}
                  href={`mailto:${staff.email}`}
                />
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Phone"
                  value={staff.phone || '—'}
                  href={staff.phone ? `tel:${staff.phone}` : undefined}
                />
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Address"
                  value={staff.address || '—'}
                />
              </dl>
            </Card>

            {/* Personal Information */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Personal Information
              </h3>

              <dl className="space-y-4">
                <InfoRow
                  label="Full Name"
                  value={
                    [staff.firstName, staff.middleName, staff.lastName]
                      .filter(Boolean)
                      .join(' ') || '—'
                  }
                />
                <InfoRow
                  label="Gender"
                  value={
                    staff.gender
                      ? staff.gender.charAt(0).toUpperCase() + staff.gender.slice(1)
                      : '—'
                  }
                />
                <InfoRow
                  label="Date of Birth"
                  value={
                    staff.dateOfBirth
                      ? new Date(staff.dateOfBirth).toLocaleDateString('en-KE', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '—'
                  }
                />
                <InfoRow label="National ID" value={staff.nationalId || '—'} />
                <InfoRow label="Blood Group" value={staff.bloodGroup || '—'} />
              </dl>
            </Card>

            {/* Employment Details */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                Employment Details
              </h3>

              <dl className="space-y-4">
                <InfoRow
                  label="Position"
                  value={STAFF_POSITION_LABELS[staff.position]}
                />
                <InfoRow
                  label="Contract Type"
                  value={
                    staff.contractType
                      ? CONTRACT_TYPE_LABELS[staff.contractType]
                      : '—'
                  }
                />
                <InfoRow label="TSC Number" value={staff.tscNumber || '—'} />
                <InfoRow
                  label="Qualification"
                  value={staff.qualification || '—'}
                />
                <InfoRow
                  label="Employment Date"
                  value={
                    staff.employmentDate
                      ? new Date(staff.employmentDate).toLocaleDateString('en-KE', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '—'
                  }
                />
              </dl>
            </Card>

            {/* Emergency Contact */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Emergency Contact
              </h3>

              <dl className="space-y-4">
                <InfoRow
                  label="Contact Name"
                  value={staff.emergencyContactName || '—'}
                />
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Contact Phone"
                  value={staff.emergencyContactPhone || '—'}
                  href={
                    staff.emergencyContactPhone
                      ? `tel:${staff.emergencyContactPhone}`
                      : undefined
                  }
                />
              </dl>

              {staff.medicalConditions && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Medical Conditions
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {staff.medicalConditions}
                  </dd>
                </div>
              )}
            </Card>

            {/* Account Information */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Account Information
              </h3>

              <dl className="space-y-4">
                <InfoRow
                  label="System Role"
                  value={
                    staff.roleName
                      ?.replace(/_/g, ' ')
                      .replace(/\b\w/g, (l: string) => l.toUpperCase()) || '—'
                  }
                />
                <InfoRow
                  label="Account Status"
                  value={
                    <Badge
                      color={staff.userStatus === 'active' ? 'green' : 'gray'}
                      size="sm"
                    >
                      {staff.userStatus}
                    </Badge>
                  }
                />
                <InfoRow
                  label="Last Login"
                  value={
                    staff.lastLoginAt
                      ? new Date(staff.lastLoginAt).toLocaleString('en-KE')
                      : 'Never'
                  }
                />
                <InfoRow
                  label="Profile Created"
                  value={new Date(staff.createdAt).toLocaleDateString('en-KE', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                />
              </dl>
            </Card>
          </div>
          </TabsContent>
        )}

        {/* Leaves Tab */}
        {availableTabs.some((tab) => tab.key === 'leaves') && (
          <TabsContent value="leaves" active={activeTab === 'leaves'}>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Leave Requests
              </h3>
              <Link href={`/staff/${staff.staffId}/leaves/new`}>
                <Button variant="primary" size="sm">
                  Request Leave
                </Button>
              </Link>
            </div>

            <Suspense fallback={<CardSkeleton />}>
              <StaffLeavesList staffId={staff.staffId} />
            </Suspense>
          </Card>
          </TabsContent>
        )}

        {/* Assignments Tab */}
        {availableTabs.some((tab) => tab.key === 'assignments') && (
          <TabsContent value="assignments" active={activeTab === 'assignments'}>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Subject Assignments
              </h3>
              <Link href={`/staff/${staff.staffId}/assignments/new`}>
                <Button variant="primary" size="sm">
                  Assign Subject
                </Button>
              </Link>
            </div>

            <Suspense fallback={<CardSkeleton />}>
              <StaffAssignmentsList staffId={staff.staffId} />
            </Suspense>
          </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ============================================================
// Quick Stat Component
// ============================================================
interface QuickStatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

function QuickStat({ icon, label, value, highlight }: QuickStatProps) {
  return (
    <div className="text-center sm:text-left">
      <div
        className={`
          inline-flex items-center justify-center sm:justify-start gap-2
          ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'}
        `}
      >
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={`
          mt-1 text-xl font-semibold
          ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}
        `}
      >
        {value}
      </p>
    </div>
  );
}

// ============================================================
// Info Row Component
// ============================================================
interface InfoRowProps {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  href?: string;
}

function InfoRow({ icon, label, value, href }: InfoRowProps) {
  const valueContent = href ? (
    <a
      href={href}
      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
    >
      {icon}
      {value}
    </a>
  ) : (
    <span className="flex items-center gap-1">
      {icon}
      {value}
    </span>
  );

  return (
    <div>
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-white">{valueContent}</dd>
    </div>
  );
}
