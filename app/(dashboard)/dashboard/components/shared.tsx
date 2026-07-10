'use client';

import React from 'react';
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardActivityItem, DashboardMetrics } from '@/types/dashboard';

type ActivityItem = DashboardActivityItem;

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'indigo' | 'cyan';
  onClick?: () => void;
}

const colorMap: Record<string, { bg: string; icon: string; trend: string }> = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', trend: 'text-blue-600' },
  green: { bg: 'bg-green-50', icon: 'bg-green-100 text-green-600', trend: 'text-green-600' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', trend: 'text-amber-600' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', trend: 'text-purple-600' },
  red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', trend: 'text-red-600' },
  indigo: { bg: 'bg-indigo-50', icon: 'bg-indigo-100 text-indigo-600', trend: 'text-indigo-600' },
  cyan: { bg: 'bg-cyan-50', icon: 'bg-cyan-100 text-cyan-600', trend: 'text-cyan-600' },
};

export function DashboardStatCard({ title, value, subtitle, icon, trend, color, onClick }: StatCardProps) {
  const colors = colorMap[color];
  return (
    <Card className={cn('relative overflow-hidden transition-all duration-200 hover:shadow-md', onClick && 'cursor-pointer hover:scale-[1.02]')} onClick={onClick}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                {trend.isPositive ? <ArrowUpRight className="h-4 w-4 text-green-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                <span className={cn('text-sm font-medium', trend.isPositive ? 'text-green-600' : 'text-red-600')}>{trend.value}%</span>
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

export function AttendanceRing({ rate, present, absent, late }: { rate: number; present: number; absent: number; late: number }) {
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (rate / 100) * circumference;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Today&apos;s Attendance</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative">
            <svg width="100" height="100" className="-rotate-90">
              <circle cx="50" cy="50" r="40" stroke="#e5e7eb" strokeWidth="8" fill="none" />
              <circle cx="50" cy="50" r="40" stroke={rate >= 90 ? '#10b981' : rate >= 75 ? '#f59e0b' : '#ef4444'} strokeWidth="8" fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-gray-900">{rate.toFixed(0)}%</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-green-500" /><span className="text-sm text-gray-600">Present</span></div>
              <span className="text-sm font-semibold text-gray-900">{present}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-red-500" /><span className="text-sm text-gray-600">Absent</span></div>
              <span className="text-sm font-semibold text-gray-900">{absent}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-amber-500" /><span className="text-sm text-gray-600">Late</span></div>
              <span className="text-sm font-semibold text-gray-900">{late}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FeeCollectionBar({ collected, expected, rate }: { collected: number; expected: number; rate: number }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Fee Collection</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div><p className="text-sm text-gray-500">Collected</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(collected)}</p></div>
            <div className="text-right"><p className="text-sm text-gray-500">Expected</p><p className="text-lg font-semibold text-gray-600">{formatCurrency(expected)}</p></div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Collection Rate</span><span className="font-semibold text-gray-900">{rate.toFixed(1)}%</span></div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div className={cn('h-full rounded-full transition-all duration-1000 ease-out', rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="rounded-lg bg-green-50 p-3 text-center"><p className="text-xs text-green-600">Paid</p><p className="text-sm font-bold text-green-700">{formatCurrency(collected)}</p></div>
            <div className="rounded-lg bg-red-50 p-3 text-center"><p className="text-xs text-red-600">Outstanding</p><p className="text-sm font-bold text-red-700">{formatCurrency(expected - collected)}</p></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const activityIcons: Record<ActivityItem['type'], React.ReactNode> = {
  payment: <Banknote className="h-4 w-4 text-green-500" />,
  attendance: <UserCheck className="h-4 w-4 text-blue-500" />,
  assessment: <ClipboardList className="h-4 w-4 text-purple-500" />,
  enrollment: <GraduationCap className="h-4 w-4 text-indigo-500" />,
  discipline: <AlertCircle className="h-4 w-4 text-red-500" />,
};

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400"><Bell className="h-8 w-8 mb-2" /><p className="text-sm">No recent activity</p></div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50">
                <div className="mt-0.5 rounded-full bg-gray-100 p-2">{activityIcons[activity.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                  <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                </div>
                <time className="text-xs text-gray-400 whitespace-nowrap">{activity.timestamp}</time>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickAction { label: string; href: string; icon: React.ReactNode; color: string; roles: string[] }

const quickActions: QuickAction[] = [
  { label: 'Record Attendance', href: '/attendance', icon: <UserCheck className="h-5 w-5" />, color: 'bg-blue-500 hover:bg-blue-600', roles: ['teacher', 'class_teacher', 'school_admin', 'principal'] },
  { label: 'Enter Scores', href: '/assessments', icon: <ClipboardList className="h-5 w-5" />, color: 'bg-purple-500 hover:bg-purple-600', roles: ['teacher', 'class_teacher', 'subject_teacher', 'school_admin'] },
  { label: 'Record Payment', href: '/finance/payments', icon: <Banknote className="h-5 w-5" />, color: 'bg-green-500 hover:bg-green-600', roles: ['finance_officer', 'bursar', 'school_admin'] },
  { label: 'Add Student', href: '/students/new', icon: <GraduationCap className="h-5 w-5" />, color: 'bg-indigo-500 hover:bg-indigo-600', roles: ['school_admin', 'principal', 'deputy_principal'] },
  { label: 'View Reports', href: '/reports', icon: <BarChart3 className="h-5 w-5" />, color: 'bg-amber-500 hover:bg-amber-600', roles: ['school_admin', 'principal', 'deputy_principal', 'teacher', 'class_teacher', 'parent'] },
  { label: 'View Timetable', href: '/timetable', icon: <Calendar className="h-5 w-5" />, color: 'bg-cyan-500 hover:bg-cyan-600', roles: ['teacher', 'class_teacher', 'subject_teacher', 'student', 'parent'] },
  { label: 'Issue Book', href: '/library', icon: <BookOpen className="h-5 w-5" />, color: 'bg-emerald-500 hover:bg-emerald-600', roles: ['librarian'] },
  { label: 'Manage Users', href: '/users', icon: <Users className="h-5 w-5" />, color: 'bg-slate-500 hover:bg-slate-600', roles: ['super_admin', 'school_admin', 'ict_admin'] },
];

export function QuickActions({ role }: { role: string }) {
  const router = useRouter();
  const filtered = quickActions.filter((a) => a.roles.includes(role));
  if (filtered.length === 0) {return null;}
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((action) => (
            <button key={action.label} onClick={() => router.push(action.href)} className={cn('flex flex-col items-center gap-2 rounded-xl p-4 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg', action.color)}>
              {action.icon}
              <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
