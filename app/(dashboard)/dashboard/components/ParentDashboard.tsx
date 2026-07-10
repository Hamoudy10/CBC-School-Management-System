'use client';

import React from 'react';
import { UserCheck, DollarSign, TrendingUp } from 'lucide-react';
import { DashboardStatCard, QuickActions, ActivityFeed } from './shared';
import { formatCurrency } from '@/lib/utils';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics }

export default function ParentDashboard({ metrics }: Props) {
  const outstanding = metrics.finance.totalExpected - metrics.finance.totalCollected;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardStatCard title="Attendance Rate" value={`${metrics.attendance.todayRate.toFixed(0)}%`} subtitle="This term" icon={<UserCheck className="h-6 w-6" />} color="green" />
        <DashboardStatCard title="Fee Balance" value={formatCurrency(outstanding)} subtitle={`${formatCurrency(metrics.finance.totalCollected)} paid`} icon={<DollarSign className="h-6 w-6" />} color={outstanding > 0 ? 'red' : 'green'} />
        <DashboardStatCard title="Avg Performance" value={`${metrics.assessments.averageScore.toFixed(1)} / 4.0`} subtitle="CBC scale" icon={<TrendingUp className="h-6 w-6" />} color="purple" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions role="parent" />
        <ActivityFeed activities={metrics.recentActivity} />
      </div>
    </>
  );
}
