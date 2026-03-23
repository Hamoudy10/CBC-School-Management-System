'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  gradeName?: string | null;
  termName?: string | null;
}

interface Assignment {
  id: string;
  studentId: string;
  studentName?: string | null;
  studentAdmissionNo?: string | null;
  invoiceNumber?: string | null;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate?: string | null;
  status: string;
}

export default function FeeAssignmentsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading, checkPermission } = useAuth();
  const { error: toastError } = useToast();

  const [feeStructure, setFeeStructure] = useState<FeeStructure | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const canViewFinance = checkPermission('finance', 'view');

  const loadData = useCallback(async () => {
    if (!params?.id) {
      return;
    }

    setIsLoading(true);

    try {
      const [feeResponse, assignmentsResponse] = await Promise.all([
        fetch(`/api/fees/${params.id}`, { credentials: 'include' }),
        fetch(`/api/student-fees?feeStructureId=${params.id}&pageSize=100`, {
          credentials: 'include',
        }),
      ]);

      const [feeJson, assignmentsJson] = await Promise.all([
        feeResponse.json(),
        assignmentsResponse.json(),
      ]);

      if (!feeResponse.ok) {
        throw new Error(feeJson?.error || 'Failed to load fee structure');
      }

      if (!assignmentsResponse.ok) {
        throw new Error(assignmentsJson?.error || 'Failed to load assignments');
      }

      setFeeStructure(feeJson.data);
      setAssignments(assignmentsJson.data || []);
    } catch (err) {
      toastError('Assignments', err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setIsLoading(false);
    }
  }, [params?.id, toastError]);

  useEffect(() => {
    if (!loading && user && canViewFinance) {
      loadData();
    }
  }, [loading, user, canViewFinance, loadData]);

  const filteredAssignments = useMemo(() => {
    if (!searchTerm) {
      return assignments;
    }

    const term = searchTerm.toLowerCase();
    return assignments.filter((assignment) =>
      [assignment.studentName, assignment.studentAdmissionNo, assignment.invoiceNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [assignments, searchTerm]);

  const summary = useMemo(() => ({
    assigned: assignments.length,
    due: assignments.reduce((sum, assignment) => sum + Number(assignment.amountDue || 0), 0),
    paid: assignments.reduce((sum, assignment) => sum + Number(assignment.amountPaid || 0), 0),
    balance: assignments.reduce((sum, assignment) => sum + Number(assignment.balance || 0), 0),
  }), [assignments]);

  if (loading || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading assignments...</p>
        </div>
      </div>
    );
  }

  if (!user || !canViewFinance) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fee Assignments" />
        <Alert variant="destructive">You do not have access to fee assignments.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={feeStructure ? `${feeStructure.name} Assignments` : 'Fee Assignments'}
        description="Review students assigned to this fee structure"
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push('/finance/fee-structures')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button variant="secondary" size="sm" onClick={loadData}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </PageHeader>

      {feeStructure && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-gray-500">Assigned</p><p className="mt-2 text-2xl font-semibold">{summary.assigned}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-gray-500">Amount Due</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.due)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-gray-500">Collected</p><p className="mt-2 text-2xl font-semibold text-green-600">{formatCurrency(summary.paid)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-gray-500">Balance</p><p className="mt-2 text-2xl font-semibold text-red-600">{formatCurrency(summary.balance)}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search student or invoice number"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAssignments.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">No assignments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => router.push(`/students/${assignment.studentId}`)}
                        >
                          <p className="font-medium text-gray-900">{assignment.studentName || 'Unknown Student'}</p>
                          <p className="text-xs text-gray-500">{assignment.studentAdmissionNo || '-'}</p>
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{assignment.invoiceNumber || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(assignment.amountDue)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(assignment.amountPaid)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(assignment.balance)}</TableCell>
                      <TableCell>
                        <Badge variant={assignment.status === 'paid' ? 'success' : assignment.status === 'partial' ? 'warning' : assignment.status === 'overdue' ? 'error' : 'default'}>
                          {assignment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{assignment.dueDate ? formatDate(assignment.dueDate) : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
