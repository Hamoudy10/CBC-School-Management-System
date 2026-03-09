// app/(dashboard)/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  GraduationCap,
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  BookOpen,
  ClipboardList,
  UserCheck,
  Banknote,
  BarChart3,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn, formatCurrency } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────
interface DashboardMetrics {
  students: {
    total: number;
    active: number;
    newThisTerm: number;
  };
  staff: {
    total: number;
    teachers: number;
    onLeave: number;
  };
  finance: {
    totalExpected: number;
    totalCollected: number;
    collectionRate: number;
    pendingPayments: number;
  };
  attendance: {
    todayPresent: number;
    todayAbsent: number;
    todayLate: number;
    todayRate: number;
  };
  assessments: {
    totalCompleted: number;
    pendingEntry: number;
    averageScore: number;
  };
  discipline: {
    openCases: number;
    thisMonth: number;
  };
  recentActivity: ActivityItem[];
}

interface ActivityItem {
  id: string;
  type: 'payment' | 'attendance' | 'assessment' | 'enrollment' | 'discipline';
  title: string;
  description: string;
  timestamp: string;
  icon: 'payment' | 'attendance' | 'assessment' | 'enrollment' | 'discipline';
}

// ─── Stat Card Component ─────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'indigo';
  onClick?: () => void;
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    trend: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-100 text-green-600',
    trend: 'text-green-600',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'bg-amber-100 text-amber-600',
    trend: 'text-amber-600',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-100 text-purple-600',
    trend: 'text-purple-600',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'bg-red-100 text-red-600',
    trend: 'text-red-600',
  },
  indigo: {
    bg: 'bg-indigo-50',
    icon: 'bg-indigo-100 text-indigo-600',
    trend: 'text-indigo-600',
  },
};

function DashboardStatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color,
  onClick,
}: StatCardProps) {
  const colors = colorMap[color];

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200 hover:shadow-md',
        onClick && 'cursor-pointer hover:scale-[1.02]'
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-500 truncate">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                {trend.isPositive ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={cn(
                    'text-sm font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.value}%
                </span>
                <span className="text-sm text-gray-400">vs last term</span>
              </div>
            )}
          </div>
          <div className={cn('rounded-xl p-3', colors.icon)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Attendance Ring Chart ───────────────────────────────────
function AttendanceRing({
  rate,
  present,
  absent,
  late,
}: {
  rate: number;
  present: number;
  absent: number;
  late: number;
}) {
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (rate / 100) * circumference;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Today&apos;s Attendance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative">
            <svg width="100" height="100" className="-rotate-90">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#e5e7eb"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke={rate >= 90 ? '#10b981' : rate >= 75 ? '#f59e0b' : '#ef4444'}
                strokeWidth="8"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-gray-900">
                {rate.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm text-gray-600">Present</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {present}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-sm text-gray-600">Absent</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {absent}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="text-sm text-gray-600">Late</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {late}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Fee Collection Progress ─────────────────────────────────
function FeeCollectionBar({
  collected,
  expected,
  rate,
}: {
  collected: number;
  expected: number;
  rate: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fee Collection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-gray-500">Collected</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(collected)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Expected</p>
              <p className="text-lg font-semibold text-gray-600">
                {formatCurrency(expected)}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Collection Rate</span>
              <span className="font-semibold text-gray-900">
                {rate.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-1000 ease-out',
                  rate >= 80
                    ? 'bg-green-500'
                    : rate >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                )}
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <p className="text-xs text-green-600">Paid</p>
              <p className="text-sm font-bold text-green-700">
                {formatCurrency(collected)}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <p className="text-xs text-red-600">Outstanding</p>
              <p className="text-sm font-bold text-red-700">
                {formatCurrency(expected - collected)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Activity Feed ───────────────────────────────────────────
const activityIcons: Record<ActivityItem['type'], React.ReactNode> = {
  payment: <Banknote className="h-4 w-4 text-green-500" />,
  attendance: <UserCheck className="h-4 w-4 text-blue-500" />,
  assessment: <ClipboardList className="h-4 w-4 text-purple-500" />,
  enrollment: <GraduationCap className="h-4 w-4 text-indigo-500" />,
  discipline: <AlertCircle className="h-4 w-4 text-red-500" />,
};

function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Bell className="h-8 w-8 mb-2" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
              >
                <div className="mt-0.5 rounded-full bg-gray-100 p-2">
                  {activityIcons[activity.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {activity.description}
                  </p>
                </div>
                <time className="text-xs text-gray-400 whitespace-nowrap">
                  {activity.timestamp}
                </time>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Quick Actions ───────────────────────────────────────────
interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  roles: string[];
}

const quickActions: QuickAction[] = [
  {
    label: 'Record Attendance',
    href: '/attendance',
    icon: <UserCheck className="h-5 w-5" />,
    color: 'bg-blue-500 hover:bg-blue-600',
    roles: ['teacher', 'class_teacher', 'school_admin', 'principal'],
  },
  {
    label: 'Enter Scores',
    href: '/assessments',
    icon: <ClipboardList className="h-5 w-5" />,
    color: 'bg-purple-500 hover:bg-purple-600',
    roles: ['teacher', 'class_teacher', 'subject_teacher', 'school_admin'],
  },
  {
    label: 'Record Payment',
    href: '/finance/payments',
    icon: <Banknote className="h-5 w-5" />,
    color: 'bg-green-500 hover:bg-green-600',
    roles: ['finance_officer', 'bursar', 'school_admin', 'principal'],
  },
  {
    label: 'Add Student',
    href: '/students/new',
    icon: <GraduationCap className="h-5 w-5" />,
    color: 'bg-indigo-500 hover:bg-indigo-600',
    roles: ['school_admin', 'principal', 'deputy_principal'],
  },
  {
    label: 'View Reports',
    href: '/reports',
    icon: <BarChart3 className="h-5 w-5" />,
    color: 'bg-amber-500 hover:bg-amber-600',
    roles: [
      'school_admin',
      'principal',
      'deputy_principal',
      'teacher',
      'class_teacher',
      'parent',
    ],
  },
  {
    label: 'View Timetable',
    href: '/timetable',
    icon: <Calendar className="h-5 w-5" />,
    color: 'bg-cyan-500 hover:bg-cyan-600',
    roles: [
      'teacher',
      'class_teacher',
      'subject_teacher',
      'student',
      'parent',
    ],
  },
];

function QuickActions({ role }: { role: string }) {
  const router = useRouter();
  const filteredActions = quickActions.filter(
    (action) =>
      action.roles.includes(role) || action.roles.includes('super_admin')
  );

  if (filteredActions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filteredActions.map((action) => (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl p-4 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg',
                action.color
              )}
            >
              {action.icon}
              <span className="text-xs font-medium text-center leading-tight">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dashboard Greeting ──────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getRoleDisplayName(role: string): string {
  const map: Record<string, string> = {
    super_admin: 'Super Administrator',
    school_admin: 'School Administrator',
    principal: 'Principal',
    deputy_principal: 'Deputy Principal',
    teacher: 'Teacher',
    class_teacher: 'Class Teacher',
    subject_teacher: 'Subject Teacher',
    finance_officer: 'Finance Officer',
    bursar: 'Bursar',
    parent: 'Parent',
    student: 'Student',
    librarian: 'Librarian',
    ict_admin: 'ICT Administrator',
  };
  return map[role] || 'User';
}

// ─── Data Fetching ───────────────────────────────────────────
async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetch('/api/analytics/school', {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    // Return empty defaults on error
    return getEmptyMetrics();
  }

  const json = await res.json();
  return json.data ?? getEmptyMetrics();
}

function getEmptyMetrics(): DashboardMetrics {
  return {
    students: { total: 0, active: 0, newThisTerm: 0 },
    staff: { total: 0, teachers: 0, onLeave: 0 },
    finance: {
      totalExpected: 0,
      totalCollected: 0,
      collectionRate: 0,
      pendingPayments: 0,
    },
    attendance: {
      todayPresent: 0,
      todayAbsent: 0,
      todayLate: 0,
      todayRate: 0,
    },
    assessments: {
      totalCompleted: 0,
      pendingEntry: 0,
      averageScore: 0,
    },
    discipline: { openCases: 0, thisMonth: 0 },
    recentActivity: [],
  };
}

// ─── Main Dashboard Page ─────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics>(getEmptyMetrics());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    loadMetrics();
  }, [loadMetrics]);

  if (!user) return null;

  const role = user.role;
  const isAdmin = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
  ].includes(role);
  const isTeacher = [
    'teacher',
    'class_teacher',
    'subject_teacher',
  ].includes(role);
  const isFinance = ['finance_officer', 'bursar'].includes(role);
  const isParent = role === 'parent';
  const isStudent = role === 'student';

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {getGreeting()}, {user.firstName} 👋
        </h1>
        <p className="text-sm text-gray-500">
          <Badge variant="default" className="mr-2">
            {getRoleDisplayName(role)}
          </Badge>
          Here&apos;s what&apos;s happening today
        </p>
      </div>

      {/* ── Error State ─────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={loadMetrics}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Loading State ───────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="flex justify-between">
                    <div className="h-4 w-24 rounded bg-gray-200" />
                    <div className="h-10 w-10 rounded-xl bg-gray-200" />
                  </div>
                  <div className="h-8 w-16 rounded bg-gray-200" />
                  <div className="h-3 w-32 rounded bg-gray-200" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* ── Admin / Principal Dashboard ────────────── */}
          {(isAdmin || role === 'super_admin') && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DashboardStatCard
                  title="Total Students"
                  value={metrics.students.total.toLocaleString()}
                  subtitle={`${metrics.students.active} active`}
                  icon={<GraduationCap className="h-6 w-6" />}
                  trend={{
                    value: metrics.students.newThisTerm,
                    isPositive: metrics.students.newThisTerm > 0,
                  }}
                  color="blue"
                  onClick={() => router.push('/students')}
                />
                <DashboardStatCard
                  title="Total Staff"
                  value={metrics.staff.total.toLocaleString()}
                  subtitle={`${metrics.staff.teachers} teachers`}
                  icon={<Users className="h-6 w-6" />}
                  color="indigo"
                  onClick={() => router.push('/staff')}
                />
                <DashboardStatCard
                  title="Collection Rate"
                  value={`${metrics.finance.collectionRate.toFixed(1)}%`}
                  subtitle={formatCurrency(metrics.finance.totalCollected)}
                  icon={<DollarSign className="h-6 w-6" />}
                  trend={{
                    value: metrics.finance.collectionRate,
                    isPositive: metrics.finance.collectionRate >= 50,
                  }}
                  color="green"
                  onClick={() => router.push('/finance')}
                />
                <DashboardStatCard
                  title="Today's Attendance"
                  value={`${metrics.attendance.todayRate.toFixed(0)}%`}
                  subtitle={`${metrics.attendance.todayPresent} present`}
                  icon={<UserCheck className="h-6 w-6" />}
                  color={
                    metrics.attendance.todayRate >= 90
                      ? 'green'
                      : metrics.attendance.todayRate >= 75
                        ? 'amber'
                        : 'red'
                  }
                  onClick={() => router.push('/attendance')}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <AttendanceRing
                  rate={metrics.attendance.todayRate}
                  present={metrics.attendance.todayPresent}
                  absent={metrics.attendance.todayAbsent}
                  late={metrics.attendance.todayLate}
                />
                <FeeCollectionBar
                  collected={metrics.finance.totalCollected}
                  expected={metrics.finance.totalExpected}
                  rate={metrics.finance.collectionRate}
                />
                <QuickActions role={role} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ActivityFeed activities={metrics.recentActivity} />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Assessment Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg bg-purple-50 p-4">
                        <div>
                          <p className="text-sm text-purple-600">Completed</p>
                          <p className="text-2xl font-bold text-purple-700">
                            {metrics.assessments.totalCompleted}
                          </p>
                        </div>
                        <CheckCircle className="h-8 w-8 text-purple-400" />
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-amber-50 p-4">
                        <div>
                          <p className="text-sm text-amber-600">
                            Pending Entry
                          </p>
                          <p className="text-2xl font-bold text-amber-700">
                            {metrics.assessments.pendingEntry}
                          </p>
                        </div>
                        <Clock className="h-8 w-8 text-amber-400" />
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
                        <div>
                          <p className="text-sm text-blue-600">Avg Score</p>
                          <p className="text-2xl font-bold text-blue-700">
                            {metrics.assessments.averageScore.toFixed(1)} / 4.0
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* ── Teacher Dashboard ─────────────────────── */}
          {isTeacher && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DashboardStatCard
                  title="My Classes"
                  value={metrics.assessments.totalCompleted}
                  subtitle="Assigned this term"
                  icon={<BookOpen className="h-6 w-6" />}
                  color="blue"
                />
                <DashboardStatCard
                  title="Today's Attendance"
                  value={`${metrics.attendance.todayRate.toFixed(0)}%`}
                  subtitle={`${metrics.attendance.todayPresent} present`}
                  icon={<UserCheck className="h-6 w-6" />}
                  color="green"
                  onClick={() => router.push('/attendance')}
                />
                <DashboardStatCard
                  title="Pending Scores"
                  value={metrics.assessments.pendingEntry}
                  subtitle="Competencies to assess"
                  icon={<ClipboardList className="h-6 w-6" />}
                  color="amber"
                  onClick={() => router.push('/assessments')}
                />
                <DashboardStatCard
                  title="Discipline Cases"
                  value={metrics.discipline.openCases}
                  subtitle={`${metrics.discipline.thisMonth} this month`}
                  icon={<AlertCircle className="h-6 w-6" />}
                  color="red"
                  onClick={() => router.push('/discipline')}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <QuickActions role={role} />
                <ActivityFeed activities={metrics.recentActivity} />
              </div>
            </>
          )}

          {/* ── Finance Officer Dashboard ─────────────── */}
          {isFinance && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DashboardStatCard
                  title="Total Expected"
                  value={formatCurrency(metrics.finance.totalExpected)}
                  subtitle="This term"
                  icon={<DollarSign className="h-6 w-6" />}
                  color="blue"
                />
                <DashboardStatCard
                  title="Total Collected"
                  value={formatCurrency(metrics.finance.totalCollected)}
                  subtitle={`${metrics.finance.collectionRate.toFixed(1)}% rate`}
                  icon={<Banknote className="h-6 w-6" />}
                  color="green"
                  onClick={() => router.push('/finance')}
                />
                <DashboardStatCard
                  title="Outstanding"
                  value={formatCurrency(
                    metrics.finance.totalExpected -
                      metrics.finance.totalCollected
                  )}
                  subtitle="Balance remaining"
                  icon={<AlertCircle className="h-6 w-6" />}
                  color="red"
                />
                <DashboardStatCard
                  title="Pending Payments"
                  value={metrics.finance.pendingPayments}
                  subtitle="Students with balance"
                  icon={<Clock className="h-6 w-6" />}
                  color="amber"
                  onClick={() => router.push('/finance/payments')}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <FeeCollectionBar
                  collected={metrics.finance.totalCollected}
                  expected={metrics.finance.totalExpected}
                  rate={metrics.finance.collectionRate}
                />
                <QuickActions role={role} />
              </div>
            </>
          )}

          {/* ── Parent Dashboard ──────────────────────── */}
          {isParent && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DashboardStatCard
                  title="Attendance Rate"
                  value={`${metrics.attendance.todayRate.toFixed(0)}%`}
                  subtitle="This term"
                  icon={<UserCheck className="h-6 w-6" />}
                  color="green"
                />
                <DashboardStatCard
                  title="Fee Balance"
                  value={formatCurrency(
                    metrics.finance.totalExpected -
                      metrics.finance.totalCollected
                  )}
                  subtitle={`${formatCurrency(metrics.finance.totalCollected)} paid`}
                  icon={<DollarSign className="h-6 w-6" />}
                  color={
                    metrics.finance.totalExpected -
                      metrics.finance.totalCollected >
                    0
                      ? 'red'
                      : 'green'
                  }
                />
                <DashboardStatCard
                  title="Avg Performance"
                  value={`${metrics.assessments.averageScore.toFixed(1)} / 4.0`}
                  subtitle="CBC scale"
                  icon={<TrendingUp className="h-6 w-6" />}
                  color="purple"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <QuickActions role={role} />
                <ActivityFeed activities={metrics.recentActivity} />
              </div>
            </>
          )}

          {/* ── Student Dashboard ─────────────────────── */}
          {isStudent && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DashboardStatCard
                  title="My Attendance"
                  value={`${metrics.attendance.todayRate.toFixed(0)}%`}
                  subtitle="This term"
                  icon={<UserCheck className="h-6 w-6" />}
                  color="green"
                />
                <DashboardStatCard
                  title="My Performance"
                  value={`${metrics.assessments.averageScore.toFixed(1)} / 4.0`}
                  subtitle="Overall average"
                  icon={<TrendingUp className="h-6 w-6" />}
                  color="purple"
                />
                <DashboardStatCard
                  title="Assessments"
                  value={metrics.assessments.totalCompleted}
                  subtitle="Completed this term"
                  icon={<ClipboardList className="h-6 w-6" />}
                  color="blue"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <QuickActions role={role} />
                <ActivityFeed activities={metrics.recentActivity} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}