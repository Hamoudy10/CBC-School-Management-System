'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';

interface Assignment {
  id: string;
  learningAreaName: string;
  className: string;
  termName: string;
  academicYear: string;
  isActive: boolean;
}

export function StaffAssignmentsList({ staffId }: { staffId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAssignments() {
      try {
        const res = await fetch(`/api/staff/${staffId}/assignments`);
        const result = await res.json();
        if (result.success) {
          setAssignments(result.data ?? []);
        } else {
          setError(result.error ?? 'Failed to load assignments');
        }
      } catch {
        setError('Failed to load assignments');
      } finally {
        setLoading(false);
      }
    }
    fetchAssignments();
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

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-secondary-400">
        <BookOpen className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">No subject assignments found</p>
        <p className="text-xs mt-1">Use the button above to assign subjects</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {assignments.map((a) => (
        <Card key={a.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-secondary-900">
                  {a.learningAreaName}
                </span>
                <Badge
                  color={a.isActive ? 'green' : 'gray'}
                  size="xs"
                >
                  {a.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-xs text-secondary-500">
                {a.className} &middot; {a.termName} &middot; {a.academicYear}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
