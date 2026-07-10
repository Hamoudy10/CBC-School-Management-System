'use client';

import React from 'react';
import { BookOpen, UserCheck, ClipboardList, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardStatCard, QuickActions, ActivityFeed } from './shared';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics }

export default function TeacherDashboard({ metrics }: Props) {
  const router = useRouter();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="My Classes" value={metrics.assessments.totalCompleted} subtitle="Assigned this term" icon={<BookOpen className="h-6 w-6" />} color="blue" />
        <DashboardStatCard title="Today's Attendance" value={`${metrics.attendance.todayRate.toFixed(0)}%`} subtitle={`${metrics.attendance.todayPresent} present`} icon={<UserCheck className="h-6 w-6" />} color="green" onClick={() => router.push('/attendance')} />
        <DashboardStatCard title="Pending Scores" value={metrics.assessments.pendingEntry} subtitle="Competencies to assess" icon={<ClipboardList className="h-6 w-6" />} color="amber" onClick={() => router.push('/assessments')} />
        <DashboardStatCard title="Discipline Cases" value={metrics.discipline.openCases} subtitle={`${metrics.discipline.thisMonth} this month`} icon={<AlertCircle className="h-6 w-6" />} color="red" onClick={() => router.push('/discipline')} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions role="teacher" />
        <ActivityFeed activities={metrics.recentActivity} />
      </div>
    </>
  );
}
