'use client';

import React from 'react';
import { TrendingUp, UserCheck, ClipboardList, ShieldAlert, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardStatCard, AttendanceRing, QuickActions, ActivityFeed } from './shared';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics }

export default function PrincipalDashboard({ metrics }: Props) {
  const router = useRouter();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="Academic Performance" value={`${metrics.assessments.averageScore.toFixed(1)} / 4.0`} subtitle="School average" icon={<TrendingUp className="h-6 w-6" />} trend={{ value: metrics.assessments.averageScore * 25, isPositive: metrics.assessments.averageScore >= 2.5 }} color="purple" />
        <DashboardStatCard title="Attendance Rate" value={`${metrics.attendance.todayRate.toFixed(0)}%`} subtitle={`${metrics.attendance.todayPresent} present today`} icon={<UserCheck className="h-6 w-6" />} color={metrics.attendance.todayRate >= 90 ? 'green' : metrics.attendance.todayRate >= 75 ? 'amber' : 'red'} onClick={() => router.push('/attendance')} />
        <DashboardStatCard title="Assessment Completion" value={metrics.assessments.totalCompleted} subtitle="Completed this term" icon={<ClipboardList className="h-6 w-6" />} color="blue" onClick={() => router.push('/assessments')} />
        <DashboardStatCard title="Discipline Cases" value={metrics.discipline.openCases} subtitle={`${metrics.discipline.thisMonth} this month`} icon={<ShieldAlert className="h-6 w-6" />} color="red" onClick={() => router.push('/discipline')} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <AttendanceRing rate={metrics.attendance.todayRate} present={metrics.attendance.todayPresent} absent={metrics.attendance.todayAbsent} late={metrics.attendance.todayLate} />
        <div className="lg:col-span-1">
          <QuickActions role="principal" />
        </div>
        <ActivityFeed activities={metrics.recentActivity} />
      </div>
    </>
  );
}
