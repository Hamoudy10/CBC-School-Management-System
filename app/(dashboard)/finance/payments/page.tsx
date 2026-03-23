'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

interface PaymentRecord {
  id: string;
  studentId?: string | null;
  studentName?: string | null;
  admissionNumber?: string | null;
  feeName?: string | null;
  amountPaid: number;
  paymentMethod: string;
  receiptNumber?: string | null;
  transactionId?: string | null;
  paymentDate: string;
  recordedByName?: string | null;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: 'All methods' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export default function PaymentsPage() {
  const router = useRouter();
  const { user, loading, checkPermission } = useAuth();
  const { error: toastError } = useToast();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const canRecordPayments = checkPermission('finance', 'create');
  const canViewFinance = checkPermission('finance', 'view');

  const fetchPayments = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
      });

      if (paymentMethod) {
        params.set('paymentMethod', paymentMethod);
      }

      const response = await fetch(`/api/payments?${params.toString()}`, {
        credentials: 'include',
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || json?.message || 'Failed to load payments');
      }

      setPayments(json.data || []);
      setTotalPages(json.meta?.totalPages || 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load payments';
      setError(message);
      toastError('Payments', message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, paymentMethod, toastError]);

  useEffect(() => {
    if (!loading && user && canViewFinance) {
      fetchPayments();
    }
  }, [loading, user, canViewFinance, fetchPayments]);

  const filteredPayments = useMemo(() => {
    if (!searchTerm) {
      return payments;
    }

    const term = searchTerm.toLowerCase();
    return payments.filter((payment) =>
      [payment.studentName, payment.admissionNumber, payment.receiptNumber, payment.transactionId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [payments, searchTerm]);

  if (loading || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading payments...</p>
        </div>
      </div>
    );
  }

  if (!user || !canViewFinance) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payments" />
        <Alert variant="destructive">You do not have access to payments.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment History"
        description="Review recorded fee payments and receipts"
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push('/finance')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchPayments();
            }}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
          {canRecordPayments && (
            <Button variant="primary" size="sm" onClick={() => router.push('/finance/payments/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Payment
            </Button>
          )}
        </div>
      </PageHeader>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <Input
              placeholder="Search by student, admission, receipt, or transaction"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
            <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recorded Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              No payments found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Recorded By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => {
                            if (payment.studentId) {
                              router.push(`/students/${payment.studentId}`);
                            }
                          }}
                        >
                          <p className="font-medium text-gray-900">{payment.studentName || 'Unknown Student'}</p>
                          <p className="text-xs text-gray-500">{payment.admissionNumber || 'No admission number'}</p>
                        </button>
                      </TableCell>
                      <TableCell>{payment.feeName || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="capitalize">
                          {payment.paymentMethod.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {payment.receiptNumber || payment.transactionId || '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(payment.amountPaid)}
                      </TableCell>
                      <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                      <TableCell>{payment.recordedByName || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
