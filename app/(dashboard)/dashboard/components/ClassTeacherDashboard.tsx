'use client';

import React from 'react';
import { UserCheck, ClipboardList, ShieldAlert, MessageSquare, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardStatCard, QuickActions, ActivityFeed } from './shared';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics }

export default function ClassTeacherDashboard({ metrics }: Props) {
  const router = useRouter();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="Class Attendance" value={`${metrics.attendance.todayRate.toFixed(0)}%`} subtitle="Today" icon={<UserCheck className="h-6 w-6" />} color={metrics.attendance.todayRate >= 90 ? 'green' : 'amber'} onClick={() => router.push('/attendance')} />
        <DashboardStatCard title="Pending Reports" value={metrics.assessments.pendingEntry} subtitle="To complete" icon={<ClipboardList className="h-6 w-6" />} color="amber" onClick={() => router.push('/reports')} />
        <DashboardStatCard title="Discipline Notes" value={metrics.discipline.openCases} subtitle="Open cases" icon={<ShieldAlert className="h-6 w-6" />} color="red" onClick={() => router.push('/discipline')} />
        <DashboardStatCard title="Class Size" value={metrics.students.total} subtitle="Enrolled" icon={<BookOpen className="h-6 w-6" />} color="blue" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions role="class_teacher" />
        <ActivityFeed activities={metrics.recentActivity} />
      </div>
    </>
  );
}
