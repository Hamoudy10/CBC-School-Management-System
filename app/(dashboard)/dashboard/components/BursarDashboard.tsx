'use client';

import React from 'react';
import { DollarSign, Banknote, TrendingUp, Clock } from 'lucide-react';
import { DashboardStatCard, QuickActions } from './shared';
import { formatCurrency } from '@/lib/utils';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics }

export default function BursarDashboard({ metrics }: Props) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="Today's Collections" value={formatCurrency(metrics.finance.totalCollected)} subtitle="Collected so far" icon={<Banknote className="h-6 w-6" />} color="green" />
        <DashboardStatCard title="Collection Rate" value={`${metrics.finance.collectionRate.toFixed(1)}%`} subtitle="This term" icon={<TrendingUp className="h-6 w-6" />} color={metrics.finance.collectionRate >= 80 ? 'green' : 'amber'} />
        <DashboardStatCard title="Outstanding Balance" value={formatCurrency(metrics.finance.totalExpected - metrics.finance.totalCollected)} subtitle="Total unpaid" icon={<DollarSign className="h-6 w-6" />} color="red" />
        <DashboardStatCard title="Pending Confirmations" value={metrics.finance.pendingPayments} subtitle="Awaiting approval" icon={<Clock className="h-6 w-6" />} color="amber" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions role="bursar" />
      </div>
    </>
  );
}
