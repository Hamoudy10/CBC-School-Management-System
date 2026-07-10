'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { getRoleDisplayName, getGreeting } from '@/lib/auth/roleUiConfig';
import { createEmptyDashboardMetrics, type DashboardMetrics } from '@/types/dashboard';

import AdminDashboard from './components/AdminDashboard';
import PrincipalDashboard from './components/PrincipalDashboard';
import DeputyPrincipalDashboard from './components/DeputyPrincipalDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import ClassTeacherDashboard from './components/ClassTeacherDashboard';
import SubjectTeacherDashboard from './components/SubjectTeacherDashboard';
import FinanceDashboard from './components/FinanceDashboard';
import BursarDashboard from './components/BursarDashboard';
import ParentDashboard from './components/ParentDashboard';
import StudentDashboard from './components/StudentDashboard';
import LibrarianDashboard from './components/LibrarianDashboard';
import IctAdminDashboard from './components/IctAdminDashboard';

interface DashboardPageClientProps {
  initialMetrics?: DashboardMetrics;
  initialLoadFailed?: boolean;
}

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetch('/api/analytics/school', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) {return createEmptyDashboardMetrics();}
  const json = await res.json();
  return normalizeDashboardMetrics(json.data);
}

function getEmptyMetrics(): DashboardMetrics {
  return createEmptyDashboardMetrics();
}

function normalizeDashboardMetrics(data: unknown): DashboardMetrics {
  const empty = getEmptyMetrics();
  if (!data || typeof data !== 'object') {return empty;}
  const candidate = data as Partial<DashboardMetrics> & { totalStudents?: number; totalAssessments?: number; schoolAverage?: number };
  const hasNested = typeof candidate.students === 'object' && candidate.students !== null && typeof candidate.staff === 'object' && candidate.staff !== null;
  if (hasNested) {
    return {
      students: { ...empty.students, ...candidate.students },
      staff: { ...empty.staff, ...candidate.staff },
      finance: { ...empty.finance, ...candidate.finance },
      attendance: { ...empty.attendance, ...candidate.attendance },
      assessments: { ...empty.assessments, ...candidate.assessments },
      discipline: { ...empty.discipline, ...candidate.discipline },
      recentActivity: Array.isArray(candidate.recentActivity) ? candidate.recentActivity : [],
    };
  }
  return {
    ...empty,
    students: { ...empty.students, total: typeof candidate.totalStudents === 'number' ? candidate.totalStudents : empty.students.total },
    assessments: { ...empty.assessments, totalCompleted: typeof candidate.totalAssessments === 'number' ? candidate.totalAssessments : empty.assessments.totalCompleted, averageScore: typeof candidate.schoolAverage === 'number' ? candidate.schoolAverage : empty.assessments.averageScore },
  };
}

function getDashboardComponent(role: string, metrics: DashboardMetrics): React.ReactNode {
  switch (role) {
    case 'super_admin':
    case 'school_admin':
      return <AdminDashboard metrics={metrics} role={role} />;
    case 'principal':
      return <PrincipalDashboard metrics={metrics} />;
    case 'deputy_principal':
      return <DeputyPrincipalDashboard metrics={metrics} />;
    case 'teacher':
      return <TeacherDashboard metrics={metrics} />;
    case 'class_teacher':
      return <ClassTeacherDashboard metrics={metrics} />;
    case 'subject_teacher':
      return <SubjectTeacherDashboard metrics={metrics} />;
    case 'finance_officer':
      return <FinanceDashboard metrics={metrics} />;
    case 'bursar':
      return <BursarDashboard metrics={metrics} />;
    case 'parent':
      return <ParentDashboard metrics={metrics} />;
    case 'student':
      return <StudentDashboard metrics={metrics} />;
    case 'librarian':
      return <LibrarianDashboard metrics={metrics} />;
    case 'ict_admin':
      return <IctAdminDashboard metrics={metrics} />;
    default:
      return <AdminDashboard metrics={metrics} role={role} />;
  }
}

export default function DashboardPageClient({ initialMetrics, initialLoadFailed = false }: DashboardPageClientProps) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics ?? getEmptyMetrics());
  const [isLoading, setIsLoading] = useState(!initialMetrics);
  const [error, setError] = useState<string | null>(initialLoadFailed ? 'Failed to load dashboard data. Please try again.' : null);

  const loadMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      setError('Failed to load dashboard data. Please try again.');
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialMetrics) {loadMetrics();}
  }, [initialMetrics, loadMetrics]);

  if (!user) {return null;}

  const role = user.role;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {getGreeting()}, {user.firstName} 👋
        </h1>
        <p className="text-sm text-gray-500">
          <Badge variant="default" className="mr-2">{getRoleDisplayName(role)}</Badge>
          {role === 'parent' && 'Stay connected with your child\'s learning journey'}
          {role === 'student' && 'Keep up the great work!'}
          {(role === 'super_admin' || role === 'school_admin') && 'Manage your school\'s operations at a glance'}
          {role === 'principal' && 'Academic leadership overview'}
          {role === 'deputy_principal' && 'Daily operations overview'}
          {(role === 'teacher' || role === 'class_teacher' || role === 'subject_teacher') && 'Your teaching workspace'}
          {(role === 'finance_officer' || role === 'bursar') && 'Financial operations overview'}
          {role === 'librarian' && 'Library operations overview'}
          {role === 'ict_admin' && 'System administration overview'}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div className="flex-1"><p className="text-sm font-medium text-red-800">{error}</p></div>
          <Button variant="secondary" size="sm" onClick={loadMetrics}>Retry</Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="flex justify-between"><div className="h-4 w-24 rounded bg-gray-200" /><div className="h-10 w-10 rounded-xl bg-gray-200" /></div>
                  <div className="h-8 w-16 rounded bg-gray-200" />
                  <div className="h-3 w-32 rounded bg-gray-200" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        getDashboardComponent(role, metrics)
      )}
    </div>
  );
}
