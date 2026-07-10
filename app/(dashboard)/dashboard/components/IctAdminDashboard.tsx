'use client';

import React from 'react';
import { Users, ShieldAlert, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardStatCard, QuickActions } from './shared';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics }

export default function IctAdminDashboard({ metrics }: Props) {
  const router = useRouter();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="Active Users" value={metrics.staff.total.toLocaleString()} subtitle="Staff accounts" icon={<Users className="h-6 w-6" />} color="blue" onClick={() => router.push('/users')} />
        <DashboardStatCard title="Students" value={metrics.students.total.toLocaleString()} subtitle="Registered" icon={<Users className="h-6 w-6" />} color="green" onClick={() => router.push('/students')} />
        <DashboardStatCard title="Audit Events" value="—" subtitle="Audit data loading" icon={<ShieldAlert className="h-6 w-6" />} color="amber" />
        <DashboardStatCard title="System Settings" value="Manage" subtitle="Configuration" icon={<Settings className="h-6 w-6" />} color="purple" onClick={() => router.push('/settings')} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions role="ict_admin" />
      </div>
    </>
  );
}
