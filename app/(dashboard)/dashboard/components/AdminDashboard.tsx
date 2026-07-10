'use client';

import React from 'react';
import { GraduationCap, Users, DollarSign, UserCheck, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { DashboardStatCard, AttendanceRing, FeeCollectionBar, QuickActions, ActivityFeed } from './shared';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics; role: string }

export default function AdminDashboard({ metrics, role }: Props) {
  const router = useRouter();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="Total Students" value={metrics.students.total.toLocaleString()} subtitle={`${metrics.students.active} active`} icon={<GraduationCap className="h-6 w-6" />} trend={{ value: metrics.students.newThisTerm, isPositive: metrics.students.newThisTerm > 0 }} color="blue" onClick={() => router.push('/students')} />
        <DashboardStatCard title="Total Staff" value={metrics.staff.total.toLocaleString()} subtitle={`${metrics.staff.teachers} teachers`} icon={<Users className="h-6 w-6" />} color="indigo" onClick={() => router.push('/staff')} />
        <DashboardStatCard title="Collection Rate" value={`${metrics.finance.collectionRate.toFixed(1)}%`} subtitle={formatCurrency(metrics.finance.totalCollected)} icon={<DollarSign className="h-6 w-6" />} trend={{ value: metrics.finance.collectionRate, isPositive: metrics.finance.collectionRate >= 50 }} color="green" onClick={() => router.push('/finance')} />
        <DashboardStatCard title="Today's Attendance" value={`${metrics.attendance.todayRate.toFixed(0)}%`} subtitle={`${metrics.attendance.todayPresent} present`} icon={<UserCheck className="h-6 w-6" />} color={metrics.attendance.todayRate >= 90 ? 'green' : metrics.attendance.todayRate >= 75 ? 'amber' : 'red'} onClick={() => router.push('/attendance')} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <AttendanceRing rate={metrics.attendance.todayRate} present={metrics.attendance.todayPresent} absent={metrics.attendance.todayAbsent} late={metrics.attendance.todayLate} />
        <FeeCollectionBar collected={metrics.finance.totalCollected} expected={metrics.finance.totalExpected} rate={metrics.finance.collectionRate} />
        <QuickActions role={role} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityFeed activities={metrics.recentActivity} />
        <Card>
          <CardHeader><CardTitle className="text-base">Assessment Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-purple-50 p-4">
                <div><p className="text-sm text-purple-600">Completed</p><p className="text-2xl font-bold text-purple-700">{metrics.assessments.totalCompleted}</p></div>
                <CheckCircle className="h-8 w-8 text-purple-400" />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-amber-50 p-4">
                <div><p className="text-sm text-amber-600">Pending Entry</p><p className="text-2xl font-bold text-amber-700">{metrics.assessments.pendingEntry}</p></div>
                <Clock className="h-8 w-8 text-amber-400" />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
                <div><p className="text-sm text-blue-600">Avg Score</p><p className="text-2xl font-bold text-blue-700">{metrics.assessments.averageScore.toFixed(1)} / 4.0</p></div>
                <TrendingUp className="h-8 w-8 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
