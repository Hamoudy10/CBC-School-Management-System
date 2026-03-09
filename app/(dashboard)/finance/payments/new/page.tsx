// app/(dashboard)/finance/payments/new/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Plus,
  Save,
  Search,
  User,
  DollarSign,
  CreditCard,
  Smartphone,
  Banknote,
  Building,
  FileText,
  CheckCircle,
  AlertCircle,
  Receipt,
  Calendar,
  Hash,
  MessageSquare,
  Loader2,
  X,
  ChevronRight,
  Printer,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

// ─── Validation Schema ───────────────────────────────────────
const paymentSchema = z.object({
  studentFeeId: z.string().min(1, 'Please select a fee to pay'),
  amountPaid: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Enter a valid amount' })
    .positive('Amount must be greater than 0'),
  paymentMethod: z.enum(['mpesa', 'cash', 'bank_transfer', 'cheque', 'other'], {
    required_error: 'Please select a payment method',
  }),
  transactionId: z.string().optional(),
  paymentDate: z.string().min(1, 'Payment date is required'),
  notes: z.string().max(500).optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

// ─── Types ───────────────────────────────────────────────────
interface StudentSearchResult {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  className: string;
  gradeName: string;
  photoUrl: string | null;
}

interface StudentFee {
  id: string;
  feeStructureId: string;
  feeName: string;
  feeDescription: string | null;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate: string | null;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  termName: string | null;
}

interface PaymentReceipt {
  receiptNumber: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  feeName: string;
  amountPaid: number;
  paymentMethod: string;
  transactionId: string | null;
  paymentDate: string;
  balance: number;
  recordedBy: string;
  recordedAt: string;
}

// ─── Constants ───────────────────────────────────────────────
const PAYMENT_METHODS = [
  { value: 'mpesa', label: 'M-Pesa', icon: Smartphone, color: 'bg-green-100 text-green-700' },
  { value: 'cash', label: 'Cash', icon: Banknote, color: 'bg-blue-100 text-blue-700' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Building, color: 'bg-purple-100 text-purple-700' },
  { value: 'cheque', label: 'Cheque', icon: FileText, color: 'bg-amber-100 text-amber-700' },
  { value: 'other', label: 'Other', icon: CreditCard, color: 'bg-gray-100 text-gray-700' },
];

// ─── Student Search Component ────────────────────────────────
interface StudentSearchProps {
  onSelect: (student: StudentSearchResult) => void;
  selectedStudent: StudentSearchResult | null;
  onClear: () => void;
}

function StudentSearch({ onSelect, selectedStudent, onClear }: StudentSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchStudents = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/students?search=${encodeURIComponent(term)}&status=active&limit=10`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const json = await response.json();
        setResults(
          (json.data?.data || []).map((s: any) => ({
            studentId: s.studentId,
            fullName: s.fullName,
            admissionNumber: s.admissionNumber,
            className: s.currentClass?.name || 'N/A',
            gradeName: s.currentClass?.gradeName || '',
            photoUrl: s.photoUrl,
          }))
        );
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchStudents(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchStudents]);

  if (selectedStudent) {
    return (
      <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-200 text-blue-700">
              {selectedStudent.photoUrl ? (
                <img
                  src={selectedStudent.photoUrl}
                  alt={selectedStudent.fullName}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <User className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {selectedStudent.fullName}
              </p>
              <p className="text-sm text-gray-600">
                {selectedStudent.admissionNumber} • {selectedStudent.className}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4" />
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search by student name or admission number..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="pl-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>

      {showResults && searchTerm.length >= 2 && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowResults(false)}
          />
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {results.length > 0 ? (
              results.map((student) => (
                <button
                  key={student.studentId}
                  onClick={() => {
                    onSelect(student);
                    setShowResults(false);
                    setSearchTerm('');
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                    {student.photoUrl ? (
                      <img
                        src={student.photoUrl}
                        alt={student.fullName}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {student.fullName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {student.admissionNumber} • {student.className}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              ))
            ) : (
              <div className="px-4 py-6 text-center">
                <User className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">
                  No students found matching &ldquo;{searchTerm}&rdquo;
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Fee Selection Component ─────────────────────────────────
interface FeeSelectionProps {
  studentId: string;
  selectedFeeId: string | null;
  onSelect: (fee: StudentFee) => void;
  selectedFee: StudentFee | null;
}

function FeeSelection({ studentId, selectedFeeId, onSelect, selectedFee }: FeeSelectionProps) {
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFees = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/student-fees?studentId=${studentId}&hasBalance=true`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const json = await response.json();
          setFees(
            (json.data || []).map((f: any) => ({
              id: f.id,
              feeStructureId: f.fee_structure_id || f.feeStructureId,
              feeName: f.fee_structure?.name || f.feeName || 'Fee',
              feeDescription: f.fee_structure?.description || f.feeDescription,
              amountDue: Number(f.amount_due || f.amountDue),
              amountPaid: Number(f.amount_paid || f.amountPaid),
              balance: Number(f.balance),
              dueDate: f.due_date || f.dueDate,
              status: f.status,
              termName: f.term?.name || f.termName,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch fees:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (studentId) {
      fetchFees();
    }
  }, [studentId]);

  const getStatusBadge = (status: StudentFee['status']) => {
    const config = {
      paid: { label: 'Paid', variant: 'success' as const },
      partial: { label: 'Partial', variant: 'warning' as const },
      pending: { label: 'Pending', variant: 'default' as const },
      overdue: { label: 'Overdue', variant: 'error' as const },
    };
    const { label, variant } = config[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
        <span className="ml-2 text-sm text-gray-500">Loading fees...</span>
      </div>
    );
  }

  if (fees.length === 0) {
    return (
      <Alert variant="info" title="No Outstanding Fees">
        This student has no outstanding fees to pay.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">
        Select Fee to Pay *
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {fees.map((fee) => (
          <button
            key={fee.id}
            type="button"
            onClick={() => onSelect(fee)}
            className={cn(
              'flex flex-col rounded-lg border-2 p-4 text-left transition-all',
              selectedFeeId === fee.id
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {fee.feeName}
                </p>
                {fee.termName && (
                  <p className="text-xs text-gray-500">{fee.termName}</p>
                )}
              </div>
              {getStatusBadge(fee.status)}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-500">Due</p>
                <p className="text-sm font-medium text-gray-700">
                  {formatCurrency(fee.amountDue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Paid</p>
                <p className="text-sm font-medium text-green-600">
                  {formatCurrency(fee.amountPaid)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Balance</p>
                <p className="text-sm font-bold text-red-600">
                  {formatCurrency(fee.balance)}
                </p>
              </div>
            </div>

            {fee.dueDate && (
              <p className="mt-2 text-xs text-gray-500">
                Due: {formatDate(fee.dueDate)}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Payment Method Selector ─────────────────────────────────
interface PaymentMethodSelectorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function PaymentMethodSelector({ value, onChange, error }: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">
        Payment Method *
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon;
          const isSelected = value === method.value;

          return (
            <button
              key={method.value}
              type="button"
              onClick={() => onChange(method.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  isSelected ? 'bg-blue-100 text-blue-600' : method.color
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  isSelected ? 'text-blue-700' : 'text-gray-700'
                )}
              >
                {method.label}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

// ─── Receipt Modal ───────────────────────────────────────────
interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  receipt: PaymentReceipt | null;
}

function ReceiptModal({ open, onClose, receipt }: ReceiptModalProps) {
  const handlePrint = () => {
    window.print();
  };

  if (!receipt) return null;

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader>
        <ModalTitle>Payment Receipt</ModalTitle>
      </ModalHeader>
      <ModalBody>
        {/* Receipt Content */}
        <div
          id="receipt-content"
          className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-6"
        >
          {/* Header */}
          <div className="border-b border-gray-200 pb-4 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="mt-2 text-xl font-bold text-gray-900">
              Payment Successful
            </h3>
            <p className="text-sm text-gray-500">
              Receipt #{receipt.receiptNumber}
            </p>
          </div>

          {/* Details */}
          <div className="mt-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Student</span>
              <span className="font-medium text-gray-900">
                {receipt.studentName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Admission No.</span>
              <span className="font-medium text-gray-900">
                {receipt.admissionNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Class</span>
              <span className="font-medium text-gray-900">
                {receipt.className}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fee Type</span>
              <span className="font-medium text-gray-900">
                {receipt.feeName}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Method</span>
                <span className="font-medium capitalize text-gray-900">
                  {receipt.paymentMethod.replace('_', ' ')}
                </span>
              </div>
              {receipt.transactionId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Transaction ID</span>
                  <span className="font-mono text-sm font-medium text-gray-900">
                    {receipt.transactionId}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Date</span>
                <span className="font-medium text-gray-900">
                  {formatDate(receipt.paymentDate)}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between text-lg">
                <span className="font-semibold text-gray-900">Amount Paid</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(receipt.amountPaid)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Remaining Balance</span>
                <span
                  className={cn(
                    'font-medium',
                    receipt.balance > 0 ? 'text-red-600' : 'text-green-600'
                  )}
                >
                  {formatCurrency(receipt.balance)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 border-t border-gray-200 pt-4 text-center text-xs text-gray-500">
            <p>Recorded by: {receipt.recordedBy}</p>
            <p>{formatDate(receipt.recordedAt)}</p>
          </div>
        </div>

      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

// ─── Main Page Component ─────────────────────────────────────
export default function NewPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, checkPermission } = useAuth();
  const { success, error: toastError } = useToast();

  // Get pre-selected student from URL
  const preSelectedStudentId = searchParams.get('studentId');

  // ─── State ─────────────────────────────────────────────────
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // ─── Form Setup ────────────────────────────────────────────
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      studentFeeId: '',
      amountPaid: 0,
      paymentMethod: 'mpesa',
      transactionId: '',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: '',
    },
    mode: 'onChange',
  });

  const watchPaymentMethod = watch('paymentMethod');
  const watchAmount = watch('amountPaid');

  // ─── Permissions ───────────────────────────────────────────
  const canRecordPayments = checkPermission('finance', 'create');

  useEffect(() => {
    if (user && !canRecordPayments) {
      toastError('Access Denied', 'You do not have permission to record payments.');
      router.push('/finance');
    }
  }, [user, canRecordPayments, router]);

  // ─── Pre-load student if ID provided ───────────────────────
  useEffect(() => {
    const loadStudent = async () => {
      if (preSelectedStudentId) {
        try {
          const response = await fetch(`/api/students/${preSelectedStudentId}`, {
            credentials: 'include',
          });

          if (response.ok) {
            const json = await response.json();
            const student = json.data;
            setSelectedStudent({
              studentId: student.studentId,
              fullName: student.fullName,
              admissionNumber: student.admissionNumber,
              className: student.currentClass?.name || 'N/A',
              gradeName: student.currentClass?.gradeName || '',
              photoUrl: student.photoUrl,
            });
          }
        } catch (err) {
          console.error('Failed to load student:', err);
        }
      }
    };

    loadStudent();
  }, [preSelectedStudentId]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleStudentSelect = (student: StudentSearchResult) => {
    setSelectedStudent(student);
    setSelectedFee(null);
    setValue('studentFeeId', '');
  };

  const handleStudentClear = () => {
    setSelectedStudent(null);
    setSelectedFee(null);
    setValue('studentFeeId', '');
  };

  const handleFeeSelect = (fee: StudentFee) => {
    setSelectedFee(fee);
    setValue('studentFeeId', fee.id);
    // Pre-fill with full balance by default
    setValue('amountPaid', fee.balance);
  };

  const handleQuickAmount = (amount: number) => {
    setValue('amountPaid', amount);
  };

  const onSubmit = async (data: PaymentFormData) => {
    if (!selectedStudent || !selectedFee) {
      toastError('Error', 'Please select a student and fee.');
      return;
    }

    if (data.amountPaid > selectedFee.balance) {
      toastError('Error', 'Amount cannot exceed the outstanding balance.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          studentFeeId: data.studentFeeId,
          amountPaid: data.amountPaid,
          paymentMethod: data.paymentMethod,
          transactionId: data.transactionId || null,
          paymentDate: data.paymentDate,
          notes: data.notes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to record payment');
      }

      const result = await response.json();

      // Create receipt
      setReceipt({
        receiptNumber: result.data.receiptNumber,
        studentName: selectedStudent.fullName,
        admissionNumber: selectedStudent.admissionNumber,
        className: selectedStudent.className,
        feeName: selectedFee.feeName,
        amountPaid: data.amountPaid,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId || null,
        paymentDate: data.paymentDate,
        balance: selectedFee.balance - data.amountPaid,
        recordedBy: user ? `${user.firstName} ${user.lastName}` : 'System',
        recordedAt: new Date().toISOString(),
      });

      setShowReceipt(true);

      success('Payment Recorded', `Payment of ${formatCurrency(data.amountPaid)} has been recorded successfully.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toastError('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiptClose = () => {
    setShowReceipt(false);
    setReceipt(null);
    // Reset form for new payment
    setSelectedStudent(null);
    setSelectedFee(null);
    reset();
  };

  const handleRecordAnother = () => {
    setShowReceipt(false);
    setReceipt(null);
    setSelectedFee(null);
    reset({
      studentFeeId: '',
      amountPaid: 0,
      paymentMethod: 'mpesa',
      transactionId: '',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    // Keep the same student selected for quick entry
  };

  // ─── Render ────────────────────────────────────────────────
  if (!user || !canRecordPayments) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <PageHeader
        title="Record Payment"
        description="Record a fee payment for a student"
      >
        <Button variant="secondary" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </PageHeader>

      {/* ── Form ────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Step 1: Select Student */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                1
              </div>
              Select Student
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StudentSearch
              onSelect={handleStudentSelect}
              selectedStudent={selectedStudent}
              onClear={handleStudentClear}
            />
          </CardContent>
        </Card>

        {/* Step 2: Select Fee */}
        {selectedStudent && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                  2
                </div>
                Select Fee
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Controller
                name="studentFeeId"
                control={control}
                render={({ field }) => (
                  <FeeSelection
                    studentId={selectedStudent.studentId}
                    selectedFeeId={field.value}
                    onSelect={handleFeeSelect}
                    selectedFee={selectedFee}
                  />
                )}
              />
              {errors.studentFeeId && (
                <p className="mt-2 text-sm text-red-500">
                  {errors.studentFeeId.message}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Payment Details */}
        {selectedFee && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                  3
                </div>
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Payment Method */}
              <Controller
                name="paymentMethod"
                control={control}
                render={({ field }) => (
                  <PaymentMethodSelector
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.paymentMethod?.message}
                  />
                )}
              />

              {/* Amount */}
              <div className="space-y-3">
                <Controller
                  name="amountPaid"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Amount *"
                      type="number"
                      min={0}
                      max={selectedFee.balance}
                      step={0.01}
                      placeholder="Enter amount"
                      error={errors.amountPaid?.message}
                      leftIcon={<DollarSign className="h-4 w-4" />}
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  )}
                />

                {/* Quick Amount Buttons */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-gray-500">Quick select:</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickAmount(selectedFee.balance)}
                    className={cn(
                      watchAmount === selectedFee.balance &&
                        'bg-blue-100 text-blue-700'
                    )}
                  >
                    Full Balance ({formatCurrency(selectedFee.balance)})
                  </Button>
                  {selectedFee.balance > 1000 && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleQuickAmount(Math.round(selectedFee.balance / 2))
                        }
                      >
                        Half ({formatCurrency(Math.round(selectedFee.balance / 2))})
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickAmount(1000)}
                      >
                        {formatCurrency(1000)}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickAmount(5000)}
                      >
                        {formatCurrency(5000)}
                      </Button>
                    </>
                  )}
                </div>

                {/* Balance Info */}
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Outstanding Balance</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(selectedFee.balance)}
                    </span>
                  </div>
                  {watchAmount > 0 && (
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-gray-500">After Payment</span>
                      <span
                        className={cn(
                          'font-medium',
                          selectedFee.balance - watchAmount <= 0
                            ? 'text-green-600'
                            : 'text-amber-600'
                        )}
                      >
                        {formatCurrency(Math.max(0, selectedFee.balance - watchAmount))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction ID (for M-Pesa, Bank Transfer) */}
              {(watchPaymentMethod === 'mpesa' ||
                watchPaymentMethod === 'bank_transfer') && (
                <Controller
                  name="transactionId"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label={
                        watchPaymentMethod === 'mpesa'
                          ? 'M-Pesa Transaction Code'
                          : 'Bank Reference Number'
                      }
                      placeholder={
                        watchPaymentMethod === 'mpesa'
                          ? 'e.g., QHK7L2M9XP'
                          : 'e.g., TRF123456789'
                      }
                      leftIcon={<Hash className="h-4 w-4" />}
                      {...field}
                    />
                  )}
                />
              )}

              {/* Payment Date */}
              <Controller
                name="paymentDate"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Payment Date *"
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    error={errors.paymentDate?.message}
                    leftIcon={<Calendar className="h-4 w-4" />}
                    {...field}
                  />
                )}
              />

              {/* Notes */}
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Notes (Optional)
                    </label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <textarea
                        placeholder="Any additional notes about this payment..."
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        {...field}
                      />
                    </div>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        {selectedFee && (
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !isValid || watchAmount <= 0}
              loading={isSubmitting}
            >
              <Receipt className="mr-2 h-4 w-4" />
              Record Payment ({formatCurrency(watchAmount || 0)})
            </Button>
          </div>
        )}
      </form>

      {/* ── Receipt Modal ───────────────────────────────────── */}
      <ReceiptModal
        open={showReceipt}
        onClose={handleReceiptClose}
        receipt={receipt}
      />

      {/* ── Quick Actions After Success ─────────────────────── */}
      {showReceipt && receipt && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform">
          <div className="flex items-center gap-2 rounded-lg bg-white p-3 shadow-lg ring-1 ring-gray-200">
            <Button variant="secondary" size="sm" onClick={handleRecordAnother}>
              <Plus className="mr-2 h-4 w-4" />
              Record Another for {selectedStudent?.fullName?.split(' ')[0]}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/finance')}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
