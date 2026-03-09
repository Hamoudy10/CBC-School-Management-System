// app/(dashboard)/finance/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  Banknote,
  Building,
  Smartphone,
  FileText,
  Download,
  Plus,
  Filter,
  RefreshCw,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  BarChart3,
  Calendar,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Tabs, TabsList, TabTrigger, TabContent } from '@/components/ui/Tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────
interface FinanceStats {
  totalExpected: number;
  totalCollected: number;
  totalBalance: number;
  collectionRate: number;
  studentsWithBalance: number;
  studentsFullyPaid: number;
  todayCollections: number;
  weekCollections: number;
  monthCollections: number;
  paymentMethodBreakdown: {
    method: string;
    amount: number;
    count: number;
    percentage: number;
  }[];
  feeTypeBreakdown: {
    feeType: string;
    expected: number;
    collected: number;
    balance: number;
  }[];
  gradeBreakdown: {
    grade: string;
    expected: number;
    collected: number;
    rate: number;
  }[];
  monthlyTrend: {
    month: string;
    collected: number;
    expected: number;
  }[];
}

interface RecentPayment {
  id: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  amount: number;
  paymentMethod: string;
  receiptNumber: string;
  feeName: string;
  paymentDate: string;
  recordedBy: string;
}

interface StudentBalance {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  gradeName: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  lastPaymentDate: string | null;
}

interface FeeStructure {
  id: string;
  name: string;
  description: string;
  amount: number;
  gradeName: string | null;
  termName: string | null;
  isMandatory: boolean;
  isActive: boolean;
  assignedCount: number;
  collectedAmount: number;
  collectionRate: number;
}

// ─── Constants ───────────────────────────────────────────────
const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  mpesa: <Smartphone className="h-4 w-4" />,
  cash: <Banknote className="h-4 w-4" />,
  bank_transfer: <Building className="h-4 w-4" />,
  cheque: <FileText className="h-4 w-4" />,
  other: <CreditCard className="h-4 w-4" />,
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  mpesa: 'bg-green-100 text-green-700',
  cash: 'bg-blue-100 text-blue-700',
  bank_transfer: 'bg-purple-100 text-purple-700',
  cheque: 'bg-amber-100 text-amber-700',
  other: 'bg-gray-100 text-gray-700',
};

// ─── Stat Card Component ─────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'indigo';
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
}

const colorConfig = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', accent: 'text-blue-600' },
  green: { bg: 'bg-green-50', icon: 'bg-green-100 text-green-600', accent: 'text-green-600' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', accent: 'text-amber-600' },
  red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', accent: 'text-red-600' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', accent: 'text-purple-600' },
  indigo: { bg: 'bg-indigo-50', icon: 'bg-indigo-100 text-indigo-600', accent: 'text-indigo-600' },
};

function StatCard({ title, value, subtitle, icon, color, trend, onClick }: StatCardProps) {
  const colors = colorConfig[color];

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.02]'
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
            )}
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                {trend.isPositive ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={cn(
                    'text-sm font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.value}%
                </span>
                <span className="text-xs text-gray-400">vs last month</span>
              </div>
            )}
          </div>
          <div className={cn('rounded-xl p-3 flex-shrink-0', colors.icon)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Collection Progress Bar ─────────────────────────────────
function CollectionProgressBar({
  collected,
  expected,
  rate,
}: {
  collected: number;
  expected: number;
  rate: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Collection Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-gray-500">Collected</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(collected)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Expected</p>
              <p className="text-xl font-semibold text-gray-600">
                {formatCurrency(expected)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">Collection Rate</span>
              <span className="font-bold text-gray-900">{rate.toFixed(1)}%</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-1000 ease-out',
                  rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <CheckCircle className="mx-auto h-5 w-5 text-green-500" />
              <p className="mt-1 text-xs text-green-600">Collected</p>
              <p className="text-sm font-bold text-green-700">
                {formatCurrency(collected)}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <AlertCircle className="mx-auto h-5 w-5 text-red-500" />
              <p className="mt-1 text-xs text-red-600">Outstanding</p>
              <p className="text-sm font-bold text-red-700">
                {formatCurrency(expected - collected)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Payment Method Chart ────────────────────────────────────
function PaymentMethodChart({
  data,
}: {
  data: FinanceStats['paymentMethodBreakdown'];
}) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  const methodLabels: Record<string, string> = {
    mpesa: 'M-Pesa',
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    other: 'Other',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment Methods</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item) => (
            <div key={item.method} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      PAYMENT_METHOD_COLORS[item.method] || 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {PAYMENT_METHOD_ICONS[item.method] || <CreditCard className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {methodLabels[item.method] || item.method}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.count} transactions
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(item.amount)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    item.method === 'mpesa' && 'bg-green-500',
                    item.method === 'cash' && 'bg-blue-500',
                    item.method === 'bank_transfer' && 'bg-purple-500',
                    item.method === 'cheque' && 'bg-amber-500',
                    item.method === 'other' && 'bg-gray-500'
                  )}
                  style={{ width: `${(item.amount / total) * 100}%` }}
                />
              </div>
            </div>
          ))}

          {data.length === 0 && (
            <div className="py-8 text-center">
              <PieChart className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No payment data</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Grade Collection Chart ──────────────────────────────────
function GradeCollectionChart({
  data,
}: {
  data: FinanceStats['gradeBreakdown'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Collection by Grade</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.grade} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{item.grade}</span>
                <span
                  className={cn(
                    'font-semibold',
                    item.rate >= 80
                      ? 'text-green-600'
                      : item.rate >= 50
                        ? 'text-amber-600'
                        : 'text-red-600'
                  )}
                >
                  {item.rate.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    item.rate >= 80
                      ? 'bg-green-500'
                      : item.rate >= 50
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  )}
                  style={{ width: `${Math.min(item.rate, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatCurrency(item.collected)}</span>
                <span>{formatCurrency(item.expected)}</span>
              </div>
            </div>
          ))}

          {data.length === 0 && (
            <div className="py-8 text-center">
              <BarChart3 className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No grade data</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Recent Payments Table ───────────────────────────────────
function RecentPaymentsTable({
  payments,
  onViewAll,
}: {
  payments: RecentPayment[];
  onViewAll: () => void;
}) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Payments</CardTitle>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          View All
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/students/${payment.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">
                          {payment.studentName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {payment.admissionNumber} • {payment.className}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {payment.feeName}
                    </TableCell>
                    <TableCell>
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
                          PAYMENT_METHOD_COLORS[payment.paymentMethod] ||
                            'bg-gray-100 text-gray-700'
                        )}
                      >
                        {PAYMENT_METHOD_ICONS[payment.paymentMethod]}
                        <span className="capitalize">
                          {payment.paymentMethod.replace('_', ' ')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-gray-600">
                        {payment.receiptNumber}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDate(payment.paymentDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No Recent Payments
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Payments will appear here once recorded.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Students with Balance Table ─────────────────────────────
function StudentsWithBalanceTable({
  students,
  isLoading,
  searchTerm,
  onSearchChange,
  onViewStudent,
}: {
  students: StudentBalance[];
  isLoading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onViewStudent: (studentId: string) => void;
}) {
  const getStatusBadge = (status: StudentBalance['status']) => {
    const config = {
      paid: { label: 'Paid', variant: 'success' as const },
      partial: { label: 'Partial', variant: 'warning' as const },
      pending: { label: 'Pending', variant: 'default' as const },
      overdue: { label: 'Overdue', variant: 'error' as const },
    };
    const { label, variant } = config[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Students with Balance</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : students.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Total Due</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow
                    key={student.studentId}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => onViewStudent(student.studentId)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">
                          {student.studentName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {student.admissionNumber}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-gray-900">{student.className}</p>
                        <p className="text-xs text-gray-500">
                          {student.gradeName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(student.totalDue)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(student.totalPaid)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold',
                        student.balance > 0 ? 'text-red-600' : 'text-green-600'
                      )}
                    >
                      {formatCurrency(student.balance)}
                    </TableCell>
                    <TableCell>{getStatusBadge(student.status)}</TableCell>
                    <TableCell className="text-gray-500">
                      {student.lastPaymentDate
                        ? formatDate(student.lastPaymentDate)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              {searchTerm ? 'No Results' : 'All Paid Up!'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm
                ? 'No students match your search.'
                : 'All students have cleared their balances.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Fee Structures Table ────────────────────────────────────
function FeeStructuresTable({
  structures,
  onManage,
}: {
  structures: FeeStructure[];
  onManage: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Fee Structures</CardTitle>
        <Button variant="secondary" size="sm" onClick={onManage}>
          Manage
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {structures.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee Name</TableHead>
                  <TableHead>Grade/Term</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Assigned</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-center">Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structures.map((structure) => (
                  <TableRow key={structure.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">
                          {structure.name}
                        </p>
                        {structure.description && (
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">
                            {structure.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{structure.gradeName || 'All Grades'}</p>
                        <p className="text-xs text-gray-500">
                          {structure.termName || 'Full Year'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(structure.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default">{structure.assignedCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(structure.collectedAmount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          structure.collectionRate >= 80
                            ? 'text-green-600'
                            : structure.collectionRate >= 50
                              ? 'text-amber-600'
                              : 'text-red-600'
                        )}
                      >
                        {structure.collectionRate.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={structure.isActive ? 'success' : 'default'}
                      >
                        {structure.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No Fee Structures
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Create fee structures to start collecting payments.
            </p>
            <Button variant="primary" size="sm" className="mt-4" onClick={onManage}>
              <Plus className="mr-2 h-4 w-4" />
              Create Fee Structure
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page Component ─────────────────────────────────────
export default function FinancePage() {
  const router = useRouter();
  const { user, checkPermission } = useAuth();
  const { success, error: toastError } = useToast();

  // ─── State ─────────────────────────────────────────────────
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [studentsWithBalance, setStudentsWithBalance] = useState<StudentBalance[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('overview');
  const [balanceSearchTerm, setBalanceSearchTerm] = useState('');

  // ─── Permissions ───────────────────────────────────────────
  const canViewFinance = checkPermission('finance', 'view');
  const canManageFees = checkPermission('finance', 'create');
  const canRecordPayments = checkPermission('finance', 'create');

  // ─── Fetch Data ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch stats
      const statsResponse = await fetch('/api/finance/stats', {
        credentials: 'include',
      });
      if (statsResponse.ok) {
        const json = await statsResponse.json();
        setStats(json.data);
      }

      // Fetch recent payments
      const paymentsResponse = await fetch('/api/payments?limit=10', {
        credentials: 'include',
      });
      if (paymentsResponse.ok) {
        const json = await paymentsResponse.json();
        setRecentPayments(json.data || []);
      }

      // Fetch students with balance
      const balanceResponse = await fetch('/api/finance/balances?hasBalance=true&limit=50', {
        credentials: 'include',
      });
      if (balanceResponse.ok) {
        const json = await balanceResponse.json();
        setStudentsWithBalance(json.data || []);
      }

      // Fetch fee structures
      const structuresResponse = await fetch('/api/fees?limit=20', {
        credentials: 'include',
      });
      if (structuresResponse.ok) {
        const json = await structuresResponse.json();
        setFeeStructures(json.data || []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
      toastError('Error', message);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchData();
      setIsLoading(false);
    };

    if (canViewFinance) {
      loadData();
    }
  }, [fetchData, canViewFinance]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
    success('Refreshed', 'Finance data has been updated.');
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/finance/export', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      success('Export Complete', 'Finance report has been downloaded.');
    } catch (err) {
      toastError('Export Failed', 'Failed to export finance data.');
    }
  };

  // Filter students by search
  const filteredStudents = balanceSearchTerm
    ? studentsWithBalance.filter(
        (s) =>
          s.studentName.toLowerCase().includes(balanceSearchTerm.toLowerCase()) ||
          s.admissionNumber.toLowerCase().includes(balanceSearchTerm.toLowerCase())
      )
    : studentsWithBalance;

  // ─── Permission Check ──────────────────────────────────────
  if (!user) {
    return null;
  }

  if (!canViewFinance) {
    return (
      <div className="space-y-6">
        <PageHeader title="Finance" />
        <Alert variant="destructive">
          You do not have permission to view finance data.
        </Alert>
      </div>
    );
  }

  // ─── Loading State ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading finance data...</p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <PageHeader
        title="Finance"
        description="Manage fees, payments, and financial reports"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')}
            />
            Refresh
          </Button>

          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>

          {canManageFees && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/finance/fee-structures')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Fee Structures
            </Button>
          )}

          {canRecordPayments && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/finance/payments/new')}
            >
              <Plus className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          )}
        </div>
      </PageHeader>

      {/* ── Error Alert ─────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive">
          {error}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            className="mt-2"
          >
            Try Again
          </Button>
        </Alert>
      )}

      {/* ── Stats Cards ─────────────────────────────────────── */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Expected"
            value={formatCurrency(stats.totalExpected)}
            subtitle="This academic year"
            icon={<DollarSign className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            title="Total Collected"
            value={formatCurrency(stats.totalCollected)}
            subtitle={`${stats.collectionRate.toFixed(1)}% collection rate`}
            icon={<CheckCircle className="h-5 w-5" />}
            color="green"
            trend={{ value: stats.collectionRate, isPositive: stats.collectionRate >= 50 }}
          />
          <StatCard
            title="Outstanding Balance"
            value={formatCurrency(stats.totalBalance)}
            subtitle={`${stats.studentsWithBalance} students`}
            icon={<AlertCircle className="h-5 w-5" />}
            color="red"
            onClick={() => setActiveTab('balances')}
          />
          <StatCard
            title="Today's Collections"
            value={formatCurrency(stats.todayCollections)}
            subtitle={`Week: ${formatCurrency(stats.weekCollections)}`}
            icon={<Calendar className="h-5 w-5" />}
            color="purple"
          />
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabTrigger value="overview">Overview</TabTrigger>
          <TabTrigger value="payments">Payments</TabTrigger>
          <TabTrigger value="balances">
            Balances
            {studentsWithBalance.length > 0 && (
              <Badge variant="error" className="ml-2">
                {studentsWithBalance.length}
              </Badge>
            )}
          </TabTrigger>
          {canManageFees && <TabTrigger value="structures">Fee Structures</TabTrigger>}
        </TabsList>

        {/* ── Overview Tab ────────────────────────────────── */}
        <TabContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {stats && (
              <CollectionProgressBar
                collected={stats.totalCollected}
                expected={stats.totalExpected}
                rate={stats.collectionRate}
              />
            )}
            {stats && <PaymentMethodChart data={stats.paymentMethodBreakdown} />}
            {stats && <GradeCollectionChart data={stats.gradeBreakdown} />}
          </div>

          <RecentPaymentsTable
            payments={recentPayments}
            onViewAll={() => setActiveTab('payments')}
          />
        </TabContent>

        {/* ── Payments Tab ────────────────────────────────── */}
        <TabContent value="payments" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Payment History</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/finance/payments')}
                >
                  View All Payments
                </Button>
                {canRecordPayments && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push('/finance/payments/new')}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Payment
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recentPayments.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Fee Type</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Recorded By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{payment.studentName}</p>
                              <p className="text-xs text-gray-500">
                                {payment.admissionNumber}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{payment.feeName}</TableCell>
                          <TableCell>
                            <div
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
                                PAYMENT_METHOD_COLORS[payment.paymentMethod]
                              )}
                            >
                              {PAYMENT_METHOD_ICONS[payment.paymentMethod]}
                              <span className="capitalize">
                                {payment.paymentMethod.replace('_', ' ')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {payment.receiptNumber}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                          <TableCell className="text-gray-500">
                            {payment.recordedBy}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <CreditCard className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-500">No payments recorded yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabContent>

        {/* ── Balances Tab ────────────────────────────────── */}
        <TabContent value="balances" className="mt-6">
          <StudentsWithBalanceTable
            students={filteredStudents}
            isLoading={false}
            searchTerm={balanceSearchTerm}
            onSearchChange={setBalanceSearchTerm}
            onViewStudent={(id) => router.push(`/students/${id}`)}
          />
        </TabContent>

        {/* ── Fee Structures Tab ──────────────────────────── */}
        {canManageFees && (
          <TabContent value="structures" className="mt-6">
            <FeeStructuresTable
              structures={feeStructures}
              onManage={() => router.push('/finance/fee-structures')}
            />
          </TabContent>
        )}
      </Tabs>
    </div>
  );
}
