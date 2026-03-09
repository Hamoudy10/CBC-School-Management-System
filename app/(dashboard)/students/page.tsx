// app/(dashboard)/students/page.tsx
'use client';

import React, { Suspense, lazy, useState, useEffect, useCallback, useMemo } from 'react';
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
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
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

// ─── Types ───────────────────────────────────────────────────
interface ClassOption {
  classId: string;
  name: string;
  gradeName: string;
}

interface GradeOption {
  gradeId: string;
  name: string;
}

type SortField = 'firstName' | 'admissionNumber' | 'enrollmentDate' | 'status';
type SortOrder = 'asc' | 'desc';

// ─── Stat Card Component ─────────────────────────────────────
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

// ─── Export Modal Component ──────────────────────────────────
// ─── Main Page Component ─────────────────────────────────────
export default function StudentsPage() {
  const router = useRouter();
  const { user, checkPermission } = useAuth();
  const { success, error: toastError, info } = useToast();

  // ─── State ─────────────────────────────────────────────────
  const [students, setStudents] = useState<PaginatedStudents>({
    data: [],
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
  });
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);

  const [filters, setFilters] = useState<StudentFiltersType>({});
  const [sortBy, setSortBy] = useState<SortField>('firstName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ─── Permissions ───────────────────────────────────────────
  const canCreate = checkPermission('students', 'create');
  const canEdit = checkPermission('students', 'update');
  const canDelete = checkPermission('students', 'delete');
  const canExport = checkPermission('students', 'export');
  const canImport = checkPermission('students', 'create');

  // ─── Fetch Students ────────────────────────────────────────
  const fetchStudents = useCallback(async () => {
    try {
      const params: StudentQueryParams = {
        ...filters,
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

      const response = await fetch(`/api/students?${queryString.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch students');
      }

      const json = await response.json();
      setStudents(json.data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      toastError('Error', message);
    }
  }, [filters, page, sortBy, sortOrder]);

  // ─── Fetch Stats ───────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/students/stats', {
        credentials: 'include',
      });

      if (response.ok) {
        const json = await response.json();
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // ─── Fetch Classes & Grades ────────────────────────────────
  const fetchClassesAndGrades = useCallback(async () => {
    try {
      // Fetch classes
      const classesResponse = await fetch('/api/settings/classes', {
        credentials: 'include',
      });

      if (classesResponse.ok) {
        const json = await classesResponse.json();
        setClasses(
          (json.data || []).map((c: any) => ({
            classId: c.class_id || c.classId,
            name: c.name,
            gradeName: c.grade?.name || c.gradeName || '',
          }))
        );
      }

      // Fetch grades
      const gradesResponse = await fetch('/api/settings/classes/levels', {
        credentials: 'include',
      });

      if (gradesResponse.ok) {
        const json = await gradesResponse.json();
        setGrades(
          (json.data || []).map((g: any) => ({
            gradeId: g.grade_id || g.gradeId || g.id,
            name: g.name,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch classes/grades:', err);
    }
  }, []);

  // ─── Initial Load ──────────────────────────────────────────
  useEffect(() => {
    const loadReferenceData = async () => {
      await Promise.all([fetchStats(), fetchClassesAndGrades()]);
    };

    loadReferenceData();
  }, [fetchStats, fetchClassesAndGrades]);

  // ─── Refetch on filter/sort/page change ────────────────────
  useEffect(() => {
    const loadStudents = async () => {
      setIsLoading(true);
      await fetchStudents();
      setIsLoading(false);
    };

    loadStudents();
  }, [fetchStudents]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStudents(), fetchStats()]);
    setIsRefreshing(false);
    success('Refreshed', 'Student data has been updated.');
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

      success('Student Deleted', `${student.fullName} has been removed.`);

      fetchStudents();
      fetchStats();
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

      fetchStudents();
      fetchStats();
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

  // ─── Render ────────────────────────────────────────────────
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
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

      {/* ── Error Alert ─────────────────────────────────────── */}
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

      {/* ── Stats Cards ─────────────────────────────────────── */}
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

      {/* ── Filters ─────────────────────────────────────────── */}
      <StudentFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
        classes={classes}
        grades={grades}
        isLoading={isLoading || isRefreshing}
      />

      {/* ── Bulk Actions Bar ────────────────────────────────── */}
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

      {/* ── Student Table ───────────────────────────────────── */}
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

      {/* ── Export Modal ────────────────────────────────────── */}
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
