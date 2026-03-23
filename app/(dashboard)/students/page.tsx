// app/(dashboard)/students/page.tsx
'use client';

import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Download,
  Upload,
  Users,
  UserCheck,
  UserMinus,
  GraduationCap,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { useReferenceData } from '@/hooks/useReferenceData';
import { StudentFilters } from './components/StudentFilters';
import { StudentTable } from './components/StudentTable';
import {
  StudentWithDetails,
  StudentFilters as StudentFiltersType,
  StudentQueryParams,
  PaginatedStudents,
  StudentStats,
  EnrollmentStatus,
} from '@/features/students';

const ExportModal = lazy(() => import('./components/ExportModal'));

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ClassOption {
  classId: string;
  name: string;
  gradeId?: string;
  gradeName: string;
}

interface GradeOption {
  gradeId: string;
  name: string;
}

interface ApiResponse<T> {
  data: T;
  success?: boolean;
  message?: string;
}

type SortField = 'firstName' | 'admissionNumber' | 'enrollmentDate' | 'status';
type SortOrder = 'asc' | 'desc';

// â”€â”€â”€ Stat Card Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  subtitle?: string;
  onClick?: () => void;
}

const colorConfig = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-100 text-green-600',
    text: 'text-green-600',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'bg-amber-100 text-amber-600',
    text: 'text-amber-600',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'bg-red-100 text-red-600',
    text: 'text-red-600',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-100 text-purple-600',
    text: 'text-purple-600',
  },
};

function StatCard({ title, value, icon, color, subtitle, onClick }: StatCardProps) {
  const colors = colorConfig[color];

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.02]'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {value.toLocaleString()}
            </p>
            {subtitle && (
              <p className={cn('mt-0.5 text-xs font-medium', colors.text)}>
                {subtitle}
              </p>
            )}
          </div>
          <div className={cn('rounded-xl p-3', colors.icon)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// â”€â”€â”€ Export Modal Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€ Main Page Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function StudentsPage() {
  const router = useRouter();
  const { user, loading, checkPermission } = useAuth();
  const { success, error: toastError, info } = useToast();

  // â”€â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [filters, setFilters] = useState<StudentFiltersType>({});
  const [debouncedFilters, setDebouncedFilters] = useState<StudentFiltersType>(filters);
  const [sortBy, setSortBy] = useState<SortField>('firstName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(1);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const shouldFetch = Boolean(user);
  const emptyStudents = useMemo<PaginatedStudents>(
    () => ({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 0,
    }),
    []
  );
  const studentsQuery = useMemo(() => {
    const params: StudentQueryParams = {
      ...debouncedFilters,
      page,
      limit: 25,
      sortBy,
      sortOrder,
    };

    const queryString = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryString.set(key, String(value));
      }
    });

    return `/api/students?${queryString.toString()}`;
  }, [debouncedFilters, page, sortBy, sortOrder]);

  const {
    data: studentsResponse,
    error: studentsError,
    isValidating: isStudentsValidating,
    mutate: mutateStudents,
  } = useSWR<ApiResponse<PaginatedStudents>>(
    shouldFetch ? studentsQuery : null
  );

  const { data: statsResponse, mutate: mutateStats } = useSWR<
    ApiResponse<StudentStats>
  >(shouldFetch ? '/api/students/stats' : null);
  const {
    classes: referenceClasses,
    levels: referenceLevels,
    isLoading: isReferenceLoading,
  } = useReferenceData({ enabled: shouldFetch });

  const students = studentsResponse?.data ?? emptyStudents;
  const stats = statsResponse?.data ?? null;
  const classes = useMemo<ClassOption[]>(
    () =>
      referenceClasses.map((c) => ({
        classId: c.classId,
        name: c.name,
        gradeId: c.gradeId ?? undefined,
        gradeName: c.gradeName || '',
      })),
    [referenceClasses]
  );
  const grades = useMemo<GradeOption[]>(
    () =>
      referenceLevels.map((g) => ({
        gradeId: g.gradeId,
        name: g.name,
      })),
    [referenceLevels]
  );
  const studentsErrorMessage = studentsError
    ? studentsError instanceof Error
      ? studentsError.message
      : 'Failed to fetch students'
    : null;
  const isStudentsLoading = shouldFetch && !studentsResponse && !studentsError;
  const isStudentsBusy = isStudentsLoading || isStudentsValidating || isReferenceLoading;

  // â”€â”€â”€ Permissions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const canCreate = checkPermission('students', 'create');
  const canEdit = checkPermission('students', 'update');
  const canDelete = checkPermission('students', 'delete');
  const canExport = checkPermission('students', 'export');
  const canImport = checkPermission('students', 'create');
  
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);

    return () => clearTimeout(handle);
  }, [filters]);

  useEffect(() => {
    if (studentsErrorMessage) {
      toastError('Error', studentsErrorMessage);
    }
  }, [studentsErrorMessage, toastError]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([mutateStudents(), mutateStats()]);
      success('Refreshed', 'Student data has been updated.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSelectedIds([]);
  };

  const handleFiltersChange = (newFilters: StudentFiltersType) => {
    setFilters(newFilters);
    setPage(1);
    setSelectedIds([]);
  };

  const handleResetFilters = () => {
    setFilters({});
    setPage(1);
    setSelectedIds([]);
  };

  const handleView = (student: StudentWithDetails) => {
    router.push(`/students/${student.studentId}`);
  };

  const handleEdit = (student: StudentWithDetails) => {
    router.push(`/students/${student.studentId}/edit`);
  };

  const handleDelete = async (student: StudentWithDetails) => {
    try {
      const response = await fetch(`/api/students/${student.studentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete student');
      }

      success('Student Updated', `${student.fullName} has been withdrawn.`);

      await Promise.all([mutateStudents(), mutateStats()]);
    } catch (err) {
      toastError('Error', 'Failed to delete student. Please try again.');
    }
  };

  const handleArchive = async (
    student: StudentWithDetails,
    status: EnrollmentStatus
  ) => {
    try {
      const response = await fetch(`/api/students/${student.studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update student status');
      }

      const statusLabels: Record<string, string> = {
        transferred: 'marked as transferred',
        withdrawn: 'marked as withdrawn',
        graduated: 'marked as graduated',
        suspended: 'suspended',
      };

      success('Status Updated', `${student.fullName} has been ${statusLabels[status] || 'updated'}.`);

      await Promise.all([mutateStudents(), mutateStats()]);
    } catch (err) {
      toastError('Error', 'Failed to update student status. Please try again.');
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    setIsExporting(true);

    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.set(key, String(value));
        }
      });
      params.set('format', format);

      const response = await fetch(`/api/students/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export students');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `students-export-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      success('Export Complete', `Students have been exported to ${format.toUpperCase()}.`);

      setShowExportModal(false);
    } catch (err) {
      toastError('Export Failed', 'Failed to export students. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleStatClick = (status?: EnrollmentStatus) => {
    if (status) {
      setFilters({ ...filters, status });
    } else {
      setFilters({});
    }
    setPage(1);
  };

  const error = studentsErrorMessage;
  const isLoading = isStudentsBusy || isRefreshing;
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading students...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Students" />
        <Alert variant="destructive">
          Your session has expired. Please sign in again.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* â”€â”€ Page Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <PageHeader
        title="Students"
        description="Manage student enrollment, profiles, and academic records"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')}
            />
            Refresh
          </Button>

          {canExport && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowExportModal(true)}
              disabled={students.total === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}

          {canImport && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/students/import')}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          )}

          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/students/new')}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          )}
        </div>
      </PageHeader>

      {/* â”€â”€ Error Alert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {error && (
        <Alert variant="destructive">
          {error}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            className="mt-2"
          >
            Try Again
          </Button>
        </Alert>
      )}

      {/* â”€â”€ Stats Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Students"
            value={stats.total}
            icon={<Users className="h-5 w-5" />}
            color="blue"
            onClick={() => handleStatClick()}
          />
          <StatCard
            title="Active"
            value={stats.active}
            icon={<UserCheck className="h-5 w-5" />}
            color="green"
            subtitle={`${((stats.active / stats.total) * 100 || 0).toFixed(0)}% of total`}
            onClick={() => handleStatClick('active')}
          />
          <StatCard
            title="Graduated"
            value={stats.graduated}
            icon={<GraduationCap className="h-5 w-5" />}
            color="purple"
            onClick={() => handleStatClick('graduated')}
          />
          <StatCard
            title="Transferred"
            value={stats.transferred}
            icon={<UserMinus className="h-5 w-5" />}
            color="amber"
            onClick={() => handleStatClick('transferred')}
          />
          <StatCard
            title="Special Needs"
            value={stats.withSpecialNeeds}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="red"
            subtitle="Require additional support"
            onClick={() =>
              setFilters({ ...filters, hasSpecialNeeds: true })
            }
          />
        </div>
      )}

      {/* â”€â”€ Filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <StudentFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
        classes={classes}
        grades={grades}
        isLoading={isLoading}
      />

      {/* â”€â”€ Bulk Actions Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.length} student{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              Clear Selection
            </Button>
            {canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // Handle bulk action
                  info('Bulk Actions', 'Bulk operations coming soon.');
                }}
              >
                Bulk Actions
              </Button>
            )}
          </div>
        </div>
      )}

      {/* â”€â”€ Student Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <StudentTable
        students={students}
        isLoading={isLoading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPageChange={handlePageChange}
        onView={handleView}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={canDelete ? handleDelete : undefined}
        onArchive={canEdit ? handleArchive : undefined}
        selectedIds={selectedIds}
        onSelectionChange={canEdit ? setSelectedIds : undefined}
        showSelection={canEdit}
      />

      {/* â”€â”€ Export Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showExportModal ? (
        <Suspense fallback={null}>
          <ExportModal
            open={showExportModal}
            onClose={() => setShowExportModal(false)}
            onExport={handleExport}
            isExporting={isExporting}
            totalStudents={students.total}
          />
        </Suspense>
      ) : null}
    </div>
  );
}


