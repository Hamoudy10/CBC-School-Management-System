'use client';

import { useEffect, useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';

interface Leave {
  leaveId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  durationDays: number;
  createdAt: string;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: 'Sick Leave',
  annual: 'Annual Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  compassionate: 'Compassionate Leave',
};

const STATUS_COLORS: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  approved: 'green',
  pending: 'yellow',
  rejected: 'red',
  cancelled: 'gray',
};

export function StaffLeavesList({ staffId }: { staffId: string }) {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaves() {
      try {
        const res = await fetch(`/api/staff/${staffId}/leaves`);
        const result = await res.json();
        if (result.success) {
          setLeaves(result.data ?? []);
        } else {
          setError(result.error ?? 'Failed to load leaves');
        }
      } catch {
        setError('Failed to load leaves');
      } finally {
        setLoading(false);
      }
    }
    fetchLeaves();
  }, [staffId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-secondary-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (leaves.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-secondary-400">
        <Calendar className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">No leave requests found</p>
        <p className="text-xs mt-1">Use the button above to request leave</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leaves.map((leave) => (
        <Card key={leave.leaveId} className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-secondary-900">
                  {LEAVE_TYPE_LABELS[leave.leaveType] ?? leave.leaveType}
                </span>
                <Badge color={STATUS_COLORS[leave.status] ?? 'gray'} size="xs">
                  {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                </Badge>
              </div>
              <p className="text-xs text-secondary-500">
                {new Date(leave.startDate).toLocaleDateString()} &mdash;{' '}
                {new Date(leave.endDate).toLocaleDateString()} ({leave.durationDays} day{leave.durationDays !== 1 ? 's' : ''})
              </p>
              {leave.reason && (
                <p className="text-xs text-secondary-400 mt-1">{leave.reason}</p>
              )}
            </div>
            <span className="text-2xs text-secondary-400 whitespace-nowrap">
              {new Date(leave.createdAt).toLocaleDateString()}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
