'use client';

import React from 'react';
import { BookOpen, AlertCircle, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardStatCard, QuickActions } from './shared';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics }

export default function LibrarianDashboard({ metrics }: Props) {
  const router = useRouter();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardStatCard title="Books Issued" value="—" subtitle="Library data loading" icon={<BookOpen className="h-6 w-6" />} color="blue" onClick={() => router.push('/library')} />
        <DashboardStatCard title="Overdue Items" value="—" subtitle="Library data loading" icon={<AlertCircle className="h-6 w-6" />} color="red" onClick={() => router.push('/library')} />
        <DashboardStatCard title="Active Students" value={metrics.students.active.toLocaleString()} subtitle="Can borrow" icon={<Users className="h-6 w-6" />} color="green" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions role="librarian" />
      </div>
    </>
  );
}
