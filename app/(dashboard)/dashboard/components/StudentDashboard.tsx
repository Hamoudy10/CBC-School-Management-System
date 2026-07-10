'use client';

import React from 'react';
import { UserCheck, TrendingUp, ClipboardList } from 'lucide-react';
import { DashboardStatCard, QuickActions, ActivityFeed } from './shared';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics }

export default function StudentDashboard({ metrics }: Props) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardStatCard title="My Attendance" value={`${metrics.attendance.todayRate.toFixed(0)}%`} subtitle="This term" icon={<UserCheck className="h-6 w-6" />} color="green" />
        <DashboardStatCard title="My Performance" value={`${metrics.assessments.averageScore.toFixed(1)} / 4.0`} subtitle="Overall average" icon={<TrendingUp className="h-6 w-6" />} color="purple" />
        <DashboardStatCard title="Assessments" value={metrics.assessments.totalCompleted} subtitle="Completed this term" icon={<ClipboardList className="h-6 w-6" />} color="blue" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions role="student" />
        <ActivityFeed activities={metrics.recentActivity} />
      </div>
    </>
  );
}
