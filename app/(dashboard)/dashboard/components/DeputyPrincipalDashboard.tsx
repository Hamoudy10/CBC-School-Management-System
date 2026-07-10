'use client';

import React from 'react';
import { UserCheck, ShieldAlert, Calendar, Users, ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardStatCard, AttendanceRing, QuickActions, ActivityFeed } from './shared';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics }

export default function DeputyPrincipalDashboard({ metrics }: Props) {
  const router = useRouter();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="Today's Attendance" value={`${metrics.attendance.todayRate.toFixed(0)}%`} subtitle={`${metrics.attendance.todayPresent} present`} icon={<UserCheck className="h-6 w-6" />} color={metrics.attendance.todayRate >= 90 ? 'green' : metrics.attendance.todayRate >= 75 ? 'amber' : 'red'} onClick={() => router.push('/attendance')} />
        <DashboardStatCard title="Open Discipline Cases" value={metrics.discipline.openCases} subtitle={`${metrics.discipline.thisMonth} new this month`} icon={<ShieldAlert className="h-6 w-6" />} color="red" onClick={() => router.push('/discipline')} />
        <DashboardStatCard title="Assessment Pending" value={metrics.assessments.pendingEntry} subtitle="Awaiting entry" icon={<ClipboardList className="h-6 w-6" />} color="amber" onClick={() => router.push('/assessments')} />
        <DashboardStatCard title="Total Students" value={metrics.students.total.toLocaleString()} subtitle={`${metrics.students.active} active`} icon={<Users className="h-6 w-6" />} color="blue" onClick={() => router.push('/students')} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <AttendanceRing rate={metrics.attendance.todayRate} present={metrics.attendance.todayPresent} absent={metrics.attendance.todayAbsent} late={metrics.attendance.todayLate} />
        <QuickActions role="deputy_principal" />
        <ActivityFeed activities={metrics.recentActivity} />
      </div>
    </>
  );
}
