'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Loader2, UserX } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';

export default function DeactivateStaffPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { loading, user, checkPermission } = useAuth();
  const staffId = params.id as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffName, setStaffName] = useState<string>('this staff member');
  const [pageError, setPageError] = useState<string | null>(null);

  const canDeactivate = checkPermission('teachers', 'delete');

  useEffect(() => {
    if (loading || !user || !canDeactivate || !staffId) {
      return;
    }

    let active = true;
    const loadStaff = async () => {
      try {
        const response = await fetch(`/api/staff/${staffId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load staff member');
        }

        const result = await response.json();
        const data = result?.data;
        if (!active || !data) {
          return;
        }

        setStaffName(
          [data.firstName, data.lastName].filter(Boolean).join(' ') || 'this staff member',
        );
      } catch (err) {
        if (!active) {
          return;
        }

        setPageError(err instanceof Error ? err.message : 'Failed to load staff member');
      }
    };

    loadStaff();
    return () => {
      active = false;
    };
  }, [loading, user, canDeactivate, staffId]);

  const handleDeactivate = async () => {
    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/staff/${staffId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'Failed to deactivate staff member');
      }

      success('Staff deactivated', `${staffName} has been deactivated.`);
      router.push('/staff');
      router.refresh();
    } catch (err) {
      toastError(
        'Deactivation failed',
        err instanceof Error ? err.message : 'Failed to deactivate staff member',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!user || !canDeactivate) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deactivate Staff" />
        <Alert variant="destructive">
          You do not have permission to deactivate staff members.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deactivate Staff"
        description="Deactivate a staff account and remove active teaching assignments."
      >
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </PageHeader>

      <Card className="max-w-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-red-100 p-3 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Confirm deactivation</h2>
            <p className="text-sm text-gray-600">
              This will deactivate <span className="font-medium">{staffName}</span>, keep the
              record in the system, and deactivate active subject assignments.
            </p>
            <p className="text-sm text-gray-600">
              The staff member will no longer appear as active for operational workflows.
            </p>
            {pageError ? (
              <Alert variant="destructive">{pageError}</Alert>
            ) : null}
            <div className="flex items-center gap-3 pt-2">
              <Button variant="secondary" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeactivate} loading={isSubmitting}>
                <UserX className="h-4 w-4" />
                Deactivate Staff
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
