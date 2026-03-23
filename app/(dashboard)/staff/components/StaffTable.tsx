// app/(dashboard)/staff/components/StaffTable.tsx
// ============================================================
// Staff Table — Server Component
// Displays paginated staff list with actions
// ============================================================

import Link from 'next/link';
import {
  Eye,
  Edit,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  STAFF_POSITION_LABELS,
  STAFF_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  type StaffPosition,
  type StaffStatus,
  type ContractType,
} from '@/features/staff';

// ============================================================
// Types
// ============================================================
interface StaffTableProps {
  filters: {
    search: string;
    position: string;
    status: string;
    contractType: string;
    page: number;
    pageSize: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
}

// ============================================================
// Status Badge Colors
// ============================================================
const statusColors: Record<StaffStatus, 'green' | 'gray' | 'yellow' | 'red'> = {
  active: 'green',
  inactive: 'gray',
  suspended: 'yellow',
  archived: 'red',
};

// ============================================================
// Main Component
// ============================================================
export async function StaffTable({ filters }: StaffTableProps) {
  const user = await getCurrentUser();
  if (!user) {return null;}

  const supabase = await createSupabaseServerClient();
  const { page, pageSize, sortBy, sortOrder, search, position, status, contractType } = filters;
  const offset = (page - 1) * pageSize;

  // Build query
  let query = supabase
    .from('staff')
    .select(
      `
      staff_id,
      user_id,
      tsc_number,
      position,
      employment_date,
      contract_type,
      status,
      created_at,
      users!inner (
        email,
        first_name,
        last_name,
        phone,
        gender,
        user_profiles (
          photo_url
        )
      )
    `,
      { count: 'exact' }
    )
    .eq('school_id', user.schoolId);

  // Apply filters
  if (search) {
    query = query.or(
      `users.first_name.ilike.%${search}%,users.last_name.ilike.%${search}%,users.email.ilike.%${search}%,tsc_number.ilike.%${search}%`
    );
  }
  if (position) {
    query = query.eq('position', position);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (contractType) {
    query = query.eq('contract_type', contractType);
  }

  // Apply sorting
  const userSortFields = ['first_name', 'last_name'];
  if (userSortFields.includes(sortBy)) {
    query = query.order(sortBy, { ascending: sortOrder === 'asc', foreignTable: 'users' });
  } else {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  }

  // Apply pagination
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching staff:', error);
    return (
      <div className="p-8 text-center text-red-600">
        Failed to load staff members. Please try again.
      </div>
    );
  }

  const staff = data || [];
  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  if (staff.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="h-12 w-12" />}
        title="No staff members found"
        description={
          search || position || status || contractType
            ? 'Try adjusting your filters to find what you\'re looking for.'
            : 'Get started by adding your first staff member.'
        }
        action={
          !search && !position && !status && !contractType ? (
            <Link href="/staff/new">
              <Button variant="primary">Add Staff Member</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Staff Member
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Position
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                TSC Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Contract
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {staff.map((member: any) => {
              const userData = member.users;
              const profile = userData?.user_profiles?.[0];
              const fullName = `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim();

              return (
                <tr
                  key={member.staff_id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {/* Staff Member */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={profile?.photo_url}
                        alt={fullName}
                        fallback={`${userData?.first_name?.[0] || ''}${userData?.last_name?.[0] || ''}`}
                        size="md"
                      />
                      <div>
                        <Link
                          href={`/staff/${member.staff_id}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {fullName || 'Unknown'}
                        </Link>
                        {member.employment_date && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Joined {new Date(member.employment_date).toLocaleDateString('en-KE', {
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      {userData?.email && (
                        <a
                          href={`mailto:${userData.email}`}
                          className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[180px]">{userData.email}</span>
                        </a>
                      )}
                      {userData?.phone && (
                        <a
                          href={`tel:${userData.phone}`}
                          className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {userData.phone}
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Position */}
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {STAFF_POSITION_LABELS[member.position as StaffPosition] || member.position}
                    </span>
                  </td>

                  {/* TSC Number */}
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {member.tsc_number || '—'}
                    </span>
                  </td>

                  {/* Contract */}
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {member.contract_type
                        ? CONTRACT_TYPE_LABELS[member.contract_type as ContractType]
                        : '—'}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <Badge color={statusColors[member.status as StaffStatus] || 'gray'}>
                      {STAFF_STATUS_LABELS[member.status as StaffStatus] || member.status}
                    </Badge>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/staff/${member.staff_id}`}>
                        <Button variant="ghost" size="sm" title="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/staff/${member.staff_id}/edit`}>
                        <Button variant="ghost" size="sm" title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Dropdown
                        trigger={
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        }
                      >
                        <DropdownItem href={`/staff/${member.staff_id}?tab=leaves`}>
                          View Leaves
                        </DropdownItem>
                        <DropdownItem href={`/staff/${member.staff_id}?tab=assignments`}>
                          Subject Assignments
                        </DropdownItem>
                        <DropdownItem
                          href={`/staff/${member.staff_id}/deactivate`}
                          variant="danger"
                        >
                          Deactivate
                        </DropdownItem>
                      </Dropdown>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing{' '}
            <span className="font-medium">{offset + 1}</span>
            {' '}to{' '}
            <span className="font-medium">{Math.min(offset + pageSize, total)}</span>
            {' '}of{' '}
            <span className="font-medium">{total}</span>
            {' '}results
          </p>

          <div className="flex items-center gap-2">
            <PaginationLink
              page={page - 1}
              disabled={page <= 1}
              filters={filters}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </PaginationLink>

            {/* Page Numbers */}
            <div className="hidden sm:flex items-center gap-1">
              {generatePageNumbers(page, totalPages).map((pageNum, idx) =>
                pageNum === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                    ...
                  </span>
                ) : (
                  <PaginationLink
                    key={pageNum}
                    page={pageNum as number}
                    active={pageNum === page}
                    filters={filters}
                  >
                    {pageNum}
                  </PaginationLink>
                )
              )}
            </div>

            <PaginationLink
              page={page + 1}
              disabled={page >= totalPages}
              filters={filters}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </PaginationLink>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Pagination Link Component
// ============================================================
interface PaginationLinkProps {
  page: number;
  disabled?: boolean;
  active?: boolean;
  filters: StaffTableProps['filters'];
  children: React.ReactNode;
}

function PaginationLink({
  page,
  disabled,
  active,
  filters,
  children,
}: PaginationLinkProps) {
  const params = new URLSearchParams();
  
  if (filters.search) {params.set('search', filters.search);}
  if (filters.position) {params.set('position', filters.position);}
  if (filters.status) {params.set('status', filters.status);}
  if (filters.contractType) {params.set('contractType', filters.contractType);}
  params.set('page', String(page));
  params.set('pageSize', String(filters.pageSize));
  if (filters.sortBy !== 'created_at') {params.set('sortBy', filters.sortBy);}
  if (filters.sortOrder !== 'desc') {params.set('sortOrder', filters.sortOrder);}

  const href = `/staff?${params.toString()}`;

  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 dark:text-gray-600 cursor-not-allowed">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`
        inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors
        ${
          active
            ? 'bg-blue-600 text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        }
      `}
    >
      {children}
    </Link>
  );
}

// ============================================================
// Generate Page Numbers with Ellipsis
// ============================================================
function generatePageNumbers(
  currentPage: number,
  totalPages: number
): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, '...', totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}
