"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  PencilLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PaymentReceiptModal } from "@/features/finance/components/PaymentReceiptModal";

interface PaymentRecord {
  id: string;
  studentFeeId?: string | null;
  studentId?: string | null;
  studentName?: string | null;
  admissionNumber?: string | null;
  feeName?: string | null;
  amountPaid: number;
  paymentMethod: string;
  receiptNumber?: string | null;
  transactionId?: string | null;
  paymentDate: string;
  notes?: string | null;
  recordedByName?: string | null;
}

interface PaymentReceiptRecord {
  id: string;
  receiptNumber: string;
  studentName: string;
  studentAdmissionNo: string;
  className: string;
  feeStructureName: string;
  amountPaid: number;
  paymentMethod: string;
  transactionId: string | null;
  paymentDate: string;
  recordedByName: string;
  recordedAt: string;
  balanceAfterPayment: number;
  notes: string | null;
}

interface FinanceExceptionRecord {
  id: string;
  type: "fee_waiver" | "payment_refund" | "payment_adjustment";
  action: string;
  performedAt: string;
  performedBy: string | null;
  performedByName?: string | null;
  reason: string | null;
  amount: number;
  previousAmount?: number | null;
  newAmount?: number | null;
  amountDelta?: number | null;
  studentFeeId: string | null;
  paymentId: string | null;
  studentId: string | null;
  studentName?: string | null;
  studentAdmissionNo?: string | null;
  feeName?: string | null;
  invoiceNumber?: string | null;
  receiptNumber?: string | null;
  transactionId?: string | null;
  changedFields?: string[];
}

interface FinanceExceptionSummary {
  totalCount: number;
  waiverCount: number;
  refundCount: number;
  adjustmentCount: number;
  waivedAmount: number;
  refundedAmount: number;
  adjustedAmountDelta: number;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "All methods" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const EXCEPTION_TYPE_OPTIONS = [
  { value: "", label: "All exceptions" },
  { value: "fee_waiver", label: "Waivers" },
  { value: "payment_refund", label: "Refunds" },
  { value: "payment_adjustment", label: "Adjustments" },
];

const EMPTY_EXCEPTION_SUMMARY: FinanceExceptionSummary = {
  totalCount: 0,
  waiverCount: 0,
  refundCount: 0,
  adjustmentCount: 0,
  waivedAmount: 0,
  refundedAmount: 0,
  adjustedAmountDelta: 0,
};

function FinanceExceptionTypeBadge({
  type,
}: {
  type: FinanceExceptionRecord["type"];
}) {
  const variant =
    type === "fee_waiver"
      ? "info"
      : type === "payment_refund"
        ? "error"
        : "warning";

  return (
    <Badge variant={variant as any} className="capitalize">
      {type.replaceAll("_", " ")}
    </Badge>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getExceptionReference(exception: FinanceExceptionRecord) {
  return (
    exception.receiptNumber ||
    exception.invoiceNumber ||
    exception.transactionId ||
    "-"
  );
}

function getExceptionReason(exception: FinanceExceptionRecord) {
  if (exception.reason) {
    return exception.reason;
  }

  if (exception.changedFields && exception.changedFields.length > 0) {
    return `Updated: ${exception.changedFields.join(", ").replaceAll("_", " ")}`;
  }

  return "Recorded in audit trail";
}

function isMoneyChangingAdjustment(
  payment: PaymentRecord | null,
  amountValue: string,
) {
  if (!payment) {
    return false;
  }

  const nextAmount = Number(amountValue);
  if (!Number.isFinite(nextAmount)) {
    return false;
  }

  return nextAmount !== Number(payment.amountPaid || 0);
}

export default function PaymentsPage() {
  const router = useRouter();
  const { user, loading, checkPermission } = useAuth();
  const { success, error: toastError } = useToast();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedReceipt, setSelectedReceipt] =
    useState<PaymentReceiptRecord | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(
    null,
  );
  const [adjustForm, setAdjustForm] = useState({
    amountPaid: "",
    paymentMethod: "cash",
    transactionId: "",
    paymentDate: "",
    notes: "",
  });
  const [refundReason, setRefundReason] = useState("");
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isAdjustingPayment, setIsAdjustingPayment] = useState(false);
  const [isRefundingPayment, setIsRefundingPayment] = useState(false);
  const [exceptions, setExceptions] = useState<FinanceExceptionRecord[]>([]);
  const [exceptionSummary, setExceptionSummary] =
    useState<FinanceExceptionSummary>(EMPTY_EXCEPTION_SUMMARY);
  const [isExceptionsLoading, setIsExceptionsLoading] = useState(true);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [exceptionSearchTerm, setExceptionSearchTerm] = useState("");
  const [exceptionType, setExceptionType] = useState("");
  const [exceptionPage, setExceptionPage] = useState(1);
  const [exceptionTotalPages, setExceptionTotalPages] = useState(1);

  const canRecordPayments = checkPermission("finance", "create");
  const canViewFinance = checkPermission("finance", "view");
  const canAdjustPayments = checkPermission("finance", "update");
  const canApproveFinance = checkPermission("finance", "approve");
  const canEditPaymentRecord = canAdjustPayments || canApproveFinance;

  const fetchPayments = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });

      if (paymentMethod) {
        params.set("paymentMethod", paymentMethod);
      }

      const response = await fetch(`/api/payments?${params.toString()}`, {
        credentials: "include",
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error || json?.message || "Failed to load payments",
        );
      }

      setPayments(json.data || []);
      setTotalPages(json.meta?.totalPages || 1);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load payments";
      setError(message);
      toastError("Payments", message);
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

  const fetchExceptions = useCallback(async () => {
    setExceptionError(null);
    setIsExceptionsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(exceptionPage),
        pageSize: "20",
      });

      if (exceptionType) {
        params.set("type", exceptionType);
      }

      const response = await fetch(
        `/api/finance/exceptions?${params.toString()}`,
        {
          credentials: "include",
        },
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error || json?.message || "Failed to load finance exceptions",
        );
      }

      setExceptions(json.data?.items || []);
      setExceptionSummary(json.data?.summary || EMPTY_EXCEPTION_SUMMARY);
      setExceptionTotalPages(json.meta?.totalPages || 1);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load finance exceptions";
      setExceptionError(message);
      toastError("Finance exceptions", message);
    } finally {
      setIsExceptionsLoading(false);
    }
  }, [exceptionPage, exceptionType, toastError]);

  useEffect(() => {
    if (!loading && user && canViewFinance) {
      fetchExceptions();
    }
  }, [loading, user, canViewFinance, fetchExceptions]);

  const filteredPayments = useMemo(() => {
    if (!searchTerm) {
      return payments;
    }

    const term = searchTerm.toLowerCase();
    return payments.filter((payment) =>
      [
        payment.studentName,
        payment.admissionNumber,
        payment.receiptNumber,
        payment.transactionId,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [payments, searchTerm]);

  const filteredExceptions = useMemo(() => {
    if (!exceptionSearchTerm) {
      return exceptions;
    }

    const term = exceptionSearchTerm.toLowerCase();
    return exceptions.filter((exception) =>
      [
        exception.studentName,
        exception.studentAdmissionNo,
        exception.feeName,
        exception.receiptNumber,
        exception.transactionId,
        exception.invoiceNumber,
        exception.reason,
        exception.performedByName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [exceptionSearchTerm, exceptions]);

  const handleOpenReceipt = useCallback(
    async (paymentId: string) => {
      setIsReceiptLoading(true);
      try {
        const response = await fetch(`/api/payments/${paymentId}`, {
          credentials: "include",
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(
            json?.error || json?.message || "Failed to load receipt",
          );
        }

        setSelectedReceipt(json.data || null);
        setIsReceiptOpen(true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load receipt";
        toastError("Receipt", message);
      } finally {
        setIsReceiptLoading(false);
      }
    },
    [toastError],
  );

  const openAdjustModal = useCallback((payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setAdjustForm({
      amountPaid: String(payment.amountPaid ?? ""),
      paymentMethod: payment.paymentMethod || "cash",
      transactionId: payment.transactionId || "",
      paymentDate: payment.paymentDate || "",
      notes: payment.notes || "",
    });
    setIsAdjustModalOpen(true);
  }, []);

  const closeAdjustModal = useCallback(() => {
    setSelectedPayment(null);
    setIsAdjustModalOpen(false);
    setIsAdjustingPayment(false);
  }, []);

  const openRefundModal = useCallback((payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setRefundReason("");
    setIsRefundModalOpen(true);
  }, []);

  const closeRefundModal = useCallback(() => {
    setSelectedPayment(null);
    setRefundReason("");
    setIsRefundModalOpen(false);
    setIsRefundingPayment(false);
  }, []);

  const handleAdjustPayment = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!selectedPayment) {
        return;
      }

      const nextAmount = Number(adjustForm.amountPaid);
      if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
        toastError("Adjustment", "Enter a valid payment amount.");
        return;
      }

      setIsAdjustingPayment(true);

      try {
        const response = await fetch(`/api/payments/${selectedPayment.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            amountPaid: nextAmount,
            paymentMethod: adjustForm.paymentMethod,
            transactionId: adjustForm.transactionId.trim() || undefined,
            paymentDate: adjustForm.paymentDate,
            notes: adjustForm.notes.trim() || undefined,
          }),
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(
            json?.error || json?.message || "Failed to adjust payment",
          );
        }

        success("Payment adjusted", "The payment record was updated.");
        closeAdjustModal();
        await Promise.all([fetchPayments(), fetchExceptions()]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to adjust payment";
        toastError("Adjustment", message);
        setIsAdjustingPayment(false);
      }
    },
    [
      adjustForm,
      closeAdjustModal,
      fetchPayments,
      selectedPayment,
      success,
      toastError,
    ],
  );

  const handleRefundPayment = useCallback(async () => {
    if (!selectedPayment) {
      return;
    }

    const trimmedReason = refundReason.trim();
    if (!trimmedReason) {
      toastError("Refund", "Provide a reason before processing a refund.");
      return;
    }

    setIsRefundingPayment(true);

    try {
      const response = await fetch(`/api/payments/${selectedPayment.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: trimmedReason }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error || json?.message || "Failed to refund payment",
        );
      }

      success("Payment refunded", "The payment was reversed successfully.");
      closeRefundModal();
      await Promise.all([fetchPayments(), fetchExceptions()]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to refund payment";
      toastError("Refund", message);
      setIsRefundingPayment(false);
    }
  }, [
    closeRefundModal,
    fetchExceptions,
    fetchPayments,
    refundReason,
    selectedPayment,
    success,
    toastError,
  ]);

  if (loading || isLoading || isExceptionsLoading) {
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/finance")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              Promise.all([fetchPayments(), fetchExceptions()]);
            }}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>
          {canRecordPayments && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/finance/payments/new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Payment
            </Button>
          )}
        </div>
      </PageHeader>

      {error && <Alert variant="destructive">{error}</Alert>}
      {exceptionError && <Alert variant="destructive">{exceptionError}</Alert>}

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <Input
              placeholder="Search by student, admission, receipt, or transaction"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
            <Select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Approved Waivers</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {exceptionSummary.waiverCount}
            </p>
            <p className="mt-1 text-sm text-primary-600">
              {formatCurrency(exceptionSummary.waivedAmount)} waived
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Refunded Payments</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {exceptionSummary.refundCount}
            </p>
            <p className="mt-1 text-sm text-red-600">
              {formatCurrency(exceptionSummary.refundedAmount)} refunded
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Logged Adjustments</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {exceptionSummary.adjustmentCount}
            </p>
            <p className="mt-1 text-sm text-amber-600">
              {formatCurrency(exceptionSummary.adjustedAmountDelta)} net change
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recorded Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {!canApproveFinance && canAdjustPayments && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You can update payment references and notes, but amount changes and refunds require approval permission.
            </div>
          )}
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
                    <TableHead className="text-right">Actions</TableHead>
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
                          <p className="font-medium text-gray-900">
                            {payment.studentName || "Unknown Student"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {payment.admissionNumber || "No admission number"}
                          </p>
                        </button>
                      </TableCell>
                      <TableCell>{payment.feeName || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="capitalize">
                          {payment.paymentMethod.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {payment.receiptNumber || payment.transactionId || "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(payment.amountPaid)}
                      </TableCell>
                      <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                      <TableCell>{payment.recordedByName || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isReceiptLoading}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenReceipt(payment.id);
                            }}
                          >
                            Reprint
                          </Button>
                          {canEditPaymentRecord && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openAdjustModal(payment)}
                            >
                              <PencilLine className="h-4 w-4" />
                              {canApproveFinance ? "Adjust" : "Edit Details"}
                            </Button>
                          )}
                          {canApproveFinance && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openRefundModal(payment)}
                            >
                              <RotateCcw className="h-4 w-4" />
                              Refund
                            </Button>
                          )}
                        </div>
                      </TableCell>
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
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finance Exception Register</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-4 md:grid-cols-[2fr_1fr]">
            <Input
              placeholder="Search by student, fee, receipt, reason, or approver"
              value={exceptionSearchTerm}
              onChange={(event) => setExceptionSearchTerm(event.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
            <Select
              value={exceptionType}
              onChange={(event) => {
                setExceptionType(event.target.value);
                setExceptionPage(1);
              }}
            >
              {EXCEPTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {filteredExceptions.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              No finance exceptions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reason / Notes</TableHead>
                    <TableHead>Approved By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExceptions.map((exception) => (
                    <TableRow key={exception.id}>
                      <TableCell>
                        <p className="font-medium text-gray-900">
                          {formatDate(exception.performedAt)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTime(exception.performedAt)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <FinanceExceptionTypeBadge type={exception.type} />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => {
                            if (exception.studentId) {
                              router.push(`/students/${exception.studentId}`);
                            }
                          }}
                        >
                          <p className="font-medium text-gray-900">
                            {exception.studentName || "Unknown Student"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {exception.studentAdmissionNo || "No admission number"}
                          </p>
                        </button>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-gray-900">
                          {exception.feeName || "Fee item"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {exception.invoiceNumber || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-600">
                        {getExceptionReference(exception)}
                      </TableCell>
                      <TableCell className="text-right">
                        {exception.type === "payment_adjustment" ? (
                          <div>
                            <p className="font-semibold text-amber-700">
                              {formatCurrency(exception.previousAmount || 0)} to{" "}
                              {formatCurrency(exception.newAmount || 0)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Delta {formatCurrency(exception.amountDelta || 0)}
                            </p>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              "font-semibold",
                              exception.type === "payment_refund"
                                ? "text-red-600"
                                : "text-primary-700",
                            )}
                          >
                            {formatCurrency(exception.amount)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-sm text-sm text-gray-600">
                        {getExceptionReason(exception)}
                      </TableCell>
                      <TableCell>{exception.performedByName || "System"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {exceptionPage} of {exceptionTotalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setExceptionPage((current) => Math.max(1, current - 1))
                }
                disabled={exceptionPage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setExceptionPage((current) =>
                    Math.min(exceptionTotalPages, current + 1),
                  )
                }
                disabled={exceptionPage >= exceptionTotalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PaymentReceiptModal
        open={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setSelectedReceipt(null);
        }}
        receipt={selectedReceipt}
      />

      <Modal open={isAdjustModalOpen} onClose={closeAdjustModal} size="sm">
        <ModalHeader>
          <ModalTitle>
            {canApproveFinance ? "Adjust Payment" : "Edit Payment Details"}
          </ModalTitle>
          <ModalDescription>
            {canApproveFinance
              ? "Update a recorded payment and recalculate the linked student fee balance."
              : "Update non-financial payment details. Amount changes require approval permission."}
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={handleAdjustPayment}>
          <ModalBody className="space-y-4">
            {selectedPayment && (
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                <p className="font-medium text-gray-900">
                  {selectedPayment.studentName || "Unknown Student"}
                </p>
                <p className="mt-1">
                  {selectedPayment.feeName || "Fee payment"} •{" "}
                  {selectedPayment.receiptNumber ||
                    selectedPayment.transactionId ||
                    "No reference"}
                </p>
              </div>
            )}

            <Input
              label="Amount"
              type="number"
              min="0.01"
              step="0.01"
              value={adjustForm.amountPaid}
              onChange={(event) =>
                setAdjustForm((prev) => ({
                  ...prev,
                  amountPaid: event.target.value,
                }))
              }
              disabled={isAdjustingPayment || !canApproveFinance}
              helperText={
                canApproveFinance
                  ? undefined
                  : "Amount changes require finance approval permission."
              }
            />

            {!canApproveFinance &&
              selectedPayment &&
              isMoneyChangingAdjustment(selectedPayment, adjustForm.amountPaid) && (
                <Alert variant="warning">
                  Amount changes are not available in your current role.
                </Alert>
              )}

            <Select
              label="Payment Method"
              value={adjustForm.paymentMethod}
              onChange={(event) =>
                setAdjustForm((prev) => ({
                  ...prev,
                  paymentMethod: event.target.value,
                }))
              }
              disabled={isAdjustingPayment}
            >
              {PAYMENT_METHOD_OPTIONS.filter((option) => option.value).map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ),
              )}
            </Select>

            <Input
              label="Transaction ID"
              value={adjustForm.transactionId}
              onChange={(event) =>
                setAdjustForm((prev) => ({
                  ...prev,
                  transactionId: event.target.value,
                }))
              }
              disabled={isAdjustingPayment}
            />

            <Input
              label="Payment Date"
              type="date"
              value={adjustForm.paymentDate}
              onChange={(event) =>
                setAdjustForm((prev) => ({
                  ...prev,
                  paymentDate: event.target.value,
                }))
              }
              disabled={isAdjustingPayment}
            />

            <div>
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <textarea
                rows={3}
                value={adjustForm.notes}
                onChange={(event) =>
                  setAdjustForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                disabled={isAdjustingPayment}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={closeAdjustModal}
              disabled={isAdjustingPayment}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isAdjustingPayment}>
              {canApproveFinance ? "Save Adjustment" : "Save Details"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal open={isRefundModalOpen} onClose={closeRefundModal} size="sm">
        <ModalHeader>
          <ModalTitle>Refund Payment</ModalTitle>
          <ModalDescription>
            Reverse this payment and restore the corresponding outstanding fee
            balance. Refunds for payments you recorded yourself require a different approver.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-4">
          {selectedPayment && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              <p className="font-medium text-red-900">
                {selectedPayment.studentName || "Unknown Student"}
              </p>
              <p className="mt-1">
                Refunding {formatCurrency(selectedPayment.amountPaid)} from{" "}
                {selectedPayment.feeName || "Fee payment"}.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700">
              Refund reason
            </label>
            <textarea
              rows={4}
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              disabled={isRefundingPayment}
              placeholder="Explain why this payment is being refunded or reversed."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={closeRefundModal}
            disabled={isRefundingPayment}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleRefundPayment}
            loading={isRefundingPayment}
          >
            Confirm Refund
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
