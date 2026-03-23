// app/(dashboard)/students/components/StudentTable.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Edit,
  MoreHorizontal,
  Trash2,
  UserMinus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GraduationCap,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { cn, formatCurrency } from '@/lib/utils';
import {
  StudentWithDetails,
  PaginatedStudents,
  EnrollmentStatus,
  getStatusColor,
} from '@/features/students';

// ─── Types ───────────────────────────────────────────────────
type SortField = 'firstName' | 'admissionNumber' | 'enrollmentDate' | 'status';
type SortOrder = 'asc' | 'desc';

interface StudentTableProps {
  students: PaginatedStudents;
  isLoading?: boolean;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  onSort?: (field: SortField) => void;
  onPageChange?: (page: number) => void;
  onView?: (student: StudentWithDetails) => void;
  onEdit?: (student: StudentWithDetails) => void;
  onDelete?: (student: StudentWithDetails) => void;
  onArchive?: (student: StudentWithDetails, status: EnrollmentStatus) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  showSelection?: boolean;
}

// ─── Status Badge Component ──────────────────────────────────
function StatusBadge({ status }: { status: EnrollmentStatus }) {
  const config: Record<
    EnrollmentStatus,
    { label: string; variant: 'success' | 'warning' | 'error' | 'default' | 'info' }
  > = {
    active: { label: 'Active', variant: 'success' },
    transferred: { label: 'Transferred', variant: 'info' },
    graduated: { label: 'Graduated', variant: 'default' },
    withdrawn: { label: 'Withdrawn', variant: 'warning' },
    suspended: { label: 'Suspended', variant: 'error' },
  };

  const { label, variant } = config[status] ?? { label: status, variant: 'default' };

  return <Badge variant={variant}>{label}</Badge>;
}

// ─── Fee Status Indicator ────────────────────────────────────
function FeeStatusIndicator({ balance }: { balance: number }) {
  if (balance <= 0) {
    return (
      <div className="flex items-center gap-1 text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Paid</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-red-600">
      <AlertCircle className="h-4 w-4" />
      <span className="text-sm font-medium">{formatCurrency(balance)}</span>
    </div>
  );
}

// ─── Attendance Indicator ────────────────────────────────────
function AttendanceIndicator({ rate }: { rate: number | null }) {
  if (rate === null) {
    return <span className="text-sm text-gray-400">N/A</span>;
  }

  const color =
    rate >= 90
      ? 'text-green-600'
      : rate >= 75
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <div className={cn('flex items-center gap-1', color)}>
      <Clock className="h-4 w-4" />
      <span className="text-sm font-medium">{rate.toFixed(0)}%</span>
    </div>
  );
}

// ─── Action Dropdown ─────────────────────────────────────────
interface ActionDropdownProps {
  student: StudentWithDetails;
  onView: () => void;
  onEdit: () => void;
  onArchive: (status: EnrollmentStatus) => void;
  onDelete: () => void;
}

function ActionDropdown({
  student,
  onView,
  onEdit,
  onArchive,
  onDelete,
}: ActionDropdownProps) {
  const [open, setopen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setopen(!open)}
        className="h-8 w-8 p-0"
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Open menu</span>
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setopen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => {
                onView();
                setopen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <Eye className="h-4 w-4" />
              View Details
            </button>

            <button
              onClick={() => {
                onEdit();
                setopen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <Edit className="h-4 w-4" />
              Edit Student
            </button>

            <div className="my-1 border-t border-gray-100" />

            {student.status === 'active' && (
              <>
                <button
                  onClick={() => {
                    onArchive('transferred');
                    setopen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50"
                >
                  <UserMinus className="h-4 w-4" />
                  Mark Transferred
                </button>

                <button
                  onClick={() => {
                    onArchive('withdrawn');
                    setopen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50"
                >
                  <UserMinus className="h-4 w-4" />
                  Mark Withdrawn
                </button>

                <button
                  onClick={() => {
                    onArchive('graduated');
                    setopen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-purple-600 hover:bg-purple-50"
                >
                  <GraduationCap className="h-4 w-4" />
                  Mark Graduated
                </button>

                <div className="my-1 border-t border-gray-100" />
              </>
            )}

            <button
              onClick={() => {
                onDelete();
                setopen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete Student
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sort Header Component ───────────────────────────────────
interface SortHeaderProps {
  label: string;
  field: SortField;
  currentSort?: SortField;
  currentOrder?: SortOrder;
  onSort?: (field: SortField) => void;
}

function SortHeader({
  label,
  field,
  currentSort,
  currentOrder,
  onSort,
}: SortHeaderProps) {
  const isActive = currentSort === field;

  return (
    <button
      onClick={() => onSort?.(field)}
      className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
    >
      {label}
      {isActive ? (
        currentOrder === 'asc' ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="h-4 w-4 text-gray-400" />
      )}
    </button>
  );
}

// ─── Pagination Component ────────────────────────────────────
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

function Pagination({
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, total);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always show first page
    pages.push(1);

    if (currentPage > 3) {
      pages.push('ellipsis');
    }

    // Show pages around current
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis');
    }

    // Always show last page
    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <p className="text-sm text-gray-600">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{total}</span> students
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
        </Button>

        <div className="hidden items-center gap-1 sm:flex">
          {getPageNumbers().map((page, idx) =>
            page === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 text-gray-400"
              >
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={page === currentPage ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => onPageChange(page)}
                className="min-w-[36px]"
              >
                {page}
              </Button>
            )
          )}
        </div>

        <span className="px-2 text-sm text-gray-600 sm:hidden">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-gray-100 p-4">
        <GraduationCap className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">
        No students found
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Try adjusting your search or filter criteria.
      </p>
    </div>
  );
}

// ─── Loading State ───────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-500">Loading students...</p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export function StudentTable({
  students,
  isLoading = false,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  onArchive,
  selectedIds = [],
  onSelectionChange,
  showSelection = false,
}: StudentTableProps) {
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState<StudentWithDetails | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<{
    student: StudentWithDetails;
    status: EnrollmentStatus;
  } | null>(null);

  const rows = Array.isArray(students?.data)
    ? students.data
    : Array.isArray((students as { students?: StudentWithDetails[] } | null)?.students)
      ? (students as { students?: StudentWithDetails[] }).students ?? []
      : [];

  // Handle selection
  const handleSelectAll = () => {
    if (!onSelectionChange) {return;}

    const allIds = rows.map((s: StudentWithDetails) => s.studentId);
    const allSelected = allIds.every((id: string) => selectedIds.includes(id));

    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !allIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedIds, ...allIds])]);
    }
  };

  const handleSelectOne = (studentId: string) => {
    if (!onSelectionChange) {return;}

    if (selectedIds.includes(studentId)) {
      onSelectionChange(selectedIds.filter((id) => id !== studentId));
    } else {
      onSelectionChange([...selectedIds, studentId]);
    }
  };

  const isAllSelected =
    rows.length > 0 &&
    rows.every((s: StudentWithDetails) => selectedIds.includes(s.studentId));

  const isSomeSelected =
    rows.some((s: StudentWithDetails) => selectedIds.includes(s.studentId)) && !isAllSelected;

  // Handlers
  const handleView = (student: StudentWithDetails) => {
    if (onView) {
      onView(student);
    } else {
      router.push(`/students/${student.studentId}`);
    }
  };

  const handleEdit = (student: StudentWithDetails) => {
    if (onEdit) {
      onEdit(student);
    } else {
      router.push(`/students/${student.studentId}/edit`);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm && onDelete) {
      onDelete(deleteConfirm);
    }
    setDeleteConfirm(null);
  };

  const handleArchiveConfirm = () => {
    if (archiveConfirm && onArchive) {
      onArchive(archiveConfirm.student, archiveConfirm.status);
    }
    setArchiveConfirm(null);
  };

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Empty state
  if (rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {showSelection && (
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) {el.indeterminate = isSomeSelected;}
                      }}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </TableHead>
                )}
                <TableHead className="min-w-[250px]">
                  <SortHeader
                    label="Student"
                    field="firstName"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={onSort}
                  />
                </TableHead>
                <TableHead className="min-w-[140px]">
                  <SortHeader
                    label="Admission No."
                    field="admissionNumber"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={onSort}
                  />
                </TableHead>
                <TableHead className="min-w-[150px]">Class</TableHead>
                <TableHead className="min-w-[100px]">
                  <SortHeader
                    label="Status"
                    field="status"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={onSort}
                  />
                </TableHead>
                <TableHead className="min-w-[120px]">Fee Balance</TableHead>
                <TableHead className="min-w-[100px]">Attendance</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {students.data.map((student: StudentWithDetails) => (
                <TableRow
                  key={student.studentId}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-gray-50',
                    selectedIds.includes(student.studentId) && 'bg-blue-50'
                  )}
                  onClick={() => handleView(student)}
                >
                  {showSelection && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(student.studentId)}
                        onChange={() => handleSelectOne(student.studentId)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </TableCell>
                  )}

                  {/* Student Info */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={student.photoUrl ?? undefined}
                        alt={student.fullName}
                        name={student.fullName}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {student.fullName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {student.hasSpecialNeeds && (
                            <Badge variant="warning" className="text-xs">
                              Special Needs
                            </Badge>
                          )}
                          <span>Age: {student.age}</span>
                          <span className="capitalize">{student.gender}</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Admission Number */}
                  <TableCell>
                    <span className="font-mono text-sm text-gray-600">
                      {student.admissionNumber}
                    </span>
                  </TableCell>

                  {/* Class */}
                  <TableCell>
                    {student.currentClass ? (
                      <div>
                        <p className="font-medium text-gray-900">
                          {student.currentClass.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {student.currentClass.gradeName}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400">Not assigned</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <StatusBadge status={student.status} />
                  </TableCell>

                  {/* Fee Balance */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <FeeStatusIndicator balance={student.feeBalance} />
                  </TableCell>

                  {/* Attendance */}
                  <TableCell>
                    <AttendanceIndicator rate={student.attendanceRate} />
                  </TableCell>

                  {/* Actions */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <ActionDropdown
                        student={student}
                        onView={() => handleView(student)}
                        onEdit={() => handleEdit(student)}
                        onArchive={(status) =>
                          setArchiveConfirm({ student, status })
                        }
                        onDelete={() => setDeleteConfirm(student)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {students.totalPages > 1 && onPageChange && (
        <Pagination
          currentPage={students.page}
          totalPages={students.totalPages}
          total={students.total}
          limit={students.limit}
          onPageChange={onPageChange}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Student"
        description={`Are you sure you want to delete ${deleteConfirm?.fullName}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        open={!!archiveConfirm}
        onClose={() => setArchiveConfirm(null)}
        onConfirm={handleArchiveConfirm}
        title={`Mark as ${archiveConfirm?.status ? archiveConfirm.status.charAt(0).toUpperCase() + archiveConfirm.status.slice(1) : ''}`}
        description={`Are you sure you want to mark ${archiveConfirm?.student.fullName} as ${archiveConfirm?.status}?`}
        confirmLabel="Confirm"
        variant="primary"
      />
    </div>
  );
}

// ─── Default Export ──────────────────────────────────────────
export default StudentTable;
