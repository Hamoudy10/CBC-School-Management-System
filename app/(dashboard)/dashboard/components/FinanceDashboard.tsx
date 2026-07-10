'use client';

import React from 'react';
import { DollarSign, Banknote, AlertCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardStatCard, FeeCollectionBar, QuickActions } from './shared';
import { formatCurrency } from '@/lib/utils';
import type { DashboardMetrics } from '@/types/dashboard';

interface Props { metrics: DashboardMetrics }

export default function FinanceDashboard({ metrics }: Props) {
  const router = useRouter();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="Total Expected" value={formatCurrency(metrics.finance.totalExpected)} subtitle="This term" icon={<DollarSign className="h-6 w-6" />} color="blue" />
        <DashboardStatCard title="Total Collected" value={formatCurrency(metrics.finance.totalCollected)} subtitle={`${metrics.finance.collectionRate.toFixed(1)}% rate`} icon={<Banknote className="h-6 w-6" />} color="green" onClick={() => router.push('/finance')} />
        <DashboardStatCard title="Outstanding" value={formatCurrency(metrics.finance.totalExpected - metrics.finance.totalCollected)} subtitle="Balance remaining" icon={<AlertCircle className="h-6 w-6" />} color="red" />
        <DashboardStatCard title="Pending Payments" value={metrics.finance.pendingPayments} subtitle="Students with balance" icon={<Clock className="h-6 w-6" />} color="amber" onClick={() => router.push('/finance/payments')} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <FeeCollectionBar collected={metrics.finance.totalCollected} expected={metrics.finance.totalExpected} rate={metrics.finance.collectionRate} />
        <QuickActions role="finance_officer" />
      </div>
    </>
  );
}
