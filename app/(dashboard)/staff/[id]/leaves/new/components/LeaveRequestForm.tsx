'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';

const leaveTypes = [
  { value: 'sick', label: 'Sick Leave' },
  { value: 'annual', label: 'Annual Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
  { value: 'compassionate', label: 'Compassionate Leave' },
] as const;

const formSchema = z.object({
  leaveType: z.enum(['sick', 'annual', 'maternity', 'paternity', 'compassionate'], {
    required_error: 'Select a leave type',
  }),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().max(1000).optional(),
}).refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});

type FormData = z.infer<typeof formSchema>;

export function LeaveRequestForm({
  staffId,
}: {
  staffId: string;
  existingLeaves?: unknown[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const res = await fetch(`/api/staff/${staffId}/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/staff/${staffId}`);
          router.refresh();
        }, 1500);
      } else {
        setError(result.error ?? 'Failed to submit leave request');
      }
    } catch {
      setError('Failed to submit leave request');
    }
  }

  if (success) {
    return (
      <Alert variant="success">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Leave request submitted successfully. Redirecting...
        </AlertDescription>
      </Alert>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Leave Type */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1.5">
          Leave Type <span className="text-error-500">*</span>
        </label>
        <select
          {...register('leaveType')}
          className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">Select leave type...</option>
          {leaveTypes.map((lt) => (
            <option key={lt.value} value={lt.value}>{lt.label}</option>
          ))}
        </select>
        {errors.leaveType && (
          <p className="mt-1 text-xs text-error-500">{errors.leaveType.message}</p>
        )}
      </div>

      {/* Start Date */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1.5">
          Start Date <span className="text-error-500">*</span>
        </label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
          <input
            type="date"
            {...register('startDate')}
            min={today}
            className="block w-full rounded-lg border border-secondary-300 bg-white pl-10 pr-3 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        {errors.startDate && (
          <p className="mt-1 text-xs text-error-500">{errors.startDate.message}</p>
        )}
      </div>

      {/* End Date */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1.5">
          End Date <span className="text-error-500">*</span>
        </label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
          <input
            type="date"
            {...register('endDate')}
            min={today}
            className="block w-full rounded-lg border border-secondary-300 bg-white pl-10 pr-3 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        {errors.endDate && (
          <p className="mt-1 text-xs text-error-500">{errors.endDate.message}</p>
        )}
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1.5">
          Reason
        </label>
        <textarea
          {...register('reason')}
          rows={3}
          placeholder="Optional reason for leave request..."
          className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 placeholder-secondary-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 resize-none"
        />
        {errors.reason && (
          <p className="mt-1 text-xs text-error-500">{errors.reason.message}</p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
