'use client';

import React from 'react';
import { BookOpen, ClipboardList, TrendingUp, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardStatCard, QuickActions, ActivityFeed } from './shared';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics }

export default function SubjectTeacherDashboard({ metrics }: Props) {
  const router = useRouter();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="My Subjects" value={metrics.assessments.totalCompleted} subtitle="Assigned" icon={<BookOpen className="h-6 w-6" />} color="blue" />
        <DashboardStatCard title="Pending Marks" value={metrics.assessments.pendingEntry} subtitle="To enter" icon={<ClipboardList className="h-6 w-6" />} color="amber" onClick={() => router.push('/assessments')} />
        <DashboardStatCard title="Subject Performance" value={`${metrics.assessments.averageScore.toFixed(1)} / 4.0`} subtitle="Average score" icon={<TrendingUp className="h-6 w-6" />} color="purple" />
        <DashboardStatCard title="Upcoming Assessments" value="—" subtitle="Scheduled" icon={<Calendar className="h-6 w-6" />} color="green" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions role="subject_teacher" />
        <ActivityFeed activities={metrics.recentActivity} />
      </div>
    </>
  );
}
