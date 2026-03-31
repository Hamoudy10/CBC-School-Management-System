// app/(dashboard)/staff/components/StaffStatsCards.tsx
// ============================================================
// Staff Statistics Cards — Server Component
// Displays summary stats: total, active, on leave, pending leaves
// ============================================================

import { Users, UserCheck, Clock, CalendarOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ============================================================
// Stats Card Component
// ============================================================
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'red';
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-3xl font-bold text-gray-900 dark:text-white">
          {value.toLocaleString()}
        </span>
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {subtitle}
          </p>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// Main Component — Fetches Stats from Database
// ============================================================
export async function StaffStatsCards({ schoolId }: { schoolId: string }) {
  if (!schoolId) {return null;}
  const supabase = await createSupabaseServerClient();

  // Fetch all stats in parallel
  const [totalResult, activeResult, onLeaveResult, pendingLeavesResult] =
    await Promise.all([
      // Total staff
      supabase
        .from('staff')
        .select('staff_id', { count: 'exact', head: true })
        .eq('school_id', schoolId),

      // Active staff
      supabase
        .from('staff')
        .select('staff_id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'active'),

      // Staff currently on approved leave
      supabase
        .from('staff_leaves')
        .select('staff_id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'approved')
        .lte('start_date', new Date().toISOString().split('T')[0])
        .gte('end_date', new Date().toISOString().split('T')[0]),

      // Pending leave requests
      supabase
        .from('staff_leaves')
        .select('leave_id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'pending'),
    ]);

  const stats = {
    total: totalResult.count || 0,
    active: activeResult.count || 0,
    onLeave: onLeaveResult.count || 0,
    pendingLeaves: pendingLeavesResult.count || 0,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Staff"
        value={stats.total}
        icon={<Users className="h-6 w-6" />}
        color="blue"
        subtitle="All registered staff members"
      />
      <StatCard
        title="Active Staff"
        value={stats.active}
        icon={<UserCheck className="h-6 w-6" />}
        color="green"
        subtitle="Currently active"
      />
      <StatCard
        title="On Leave"
        value={stats.onLeave}
        icon={<CalendarOff className="h-6 w-6" />}
        color="yellow"
        subtitle="Currently on approved leave"
      />
      <StatCard
        title="Pending Leaves"
        value={stats.pendingLeaves}
        icon={<Clock className="h-6 w-6" />}
        color="red"
        subtitle="Awaiting approval"
      />
    </div>
  );
}
