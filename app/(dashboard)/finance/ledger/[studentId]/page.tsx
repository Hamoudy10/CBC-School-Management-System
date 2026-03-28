"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PaymentReceiptModal } from "@/features/finance/components/PaymentReceiptModal";

interface LedgerStudent {
  id: string;
  fullName: string;
  admissionNumber: string;
  className: string;
  status: string;
}

interface LedgerSummary {
  totalDue: number;
  totalPaid: number;
  balance: number;
  status: string;
}

interface LedgerFee {
  id: string;
  invoiceNumber: string | null;
  feeName: string;
  academicYear: string | null;
  termName: string | null;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate: string | null;
  status: string;
}

interface LedgerPayment {
  id: string;
  studentId?: string | null;
  studentName?: string | null;
  studentAdmissionNo?: string | null;
  feeName?: string | null;
  amountPaid: number;
  paymentMethod: string;
  transactionId?: string | null;
  receiptNumber?: string | null;
  paymentDate: string;
  recordedByName?: string | null;
}

interface ReceiptDetails {
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

function FeeStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status || "pending";
  const variant =
    normalizedStatus === "paid"
      ? "success"
      : normalizedStatus === "partial"
        ? "warning"
        : normalizedStatus === "overdue"
          ? "error"
          : normalizedStatus === "waived"
            ? "info"
            : "default";

  return (
    <Badge variant={variant} className="capitalize">
      {normalizedStatus.replace("_", " ")}
    </Badge>
  );
}

export default function StudentLedgerPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading, checkPermission } = useAuth();
  const { success, error: toastError } = useToast();

  const studentId = params.studentId as string;
  const canViewFinance = checkPermission("finance", "view");
  const canCreatePayments = checkPermission("finance", "create");
  const canApproveFinance = checkPermission("finance", "approve");

  const [student, setStudent] = useState<LedgerStudent | null>(null);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [fees, setFees] = useState<LedgerFee[]>([]);
  const [payments, setPayments] = useState<LedgerPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetails | null>(
    null,
  );
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);
  const [feeToWaive, setFeeToWaive] = useState<LedgerFee | null>(null);
  const [waiverReason, setWaiverReason] = useState("");
  const [isWaivingFee, setIsWaivingFee] = useState(false);

  const fetchLedger = useCallback(async () => {
    setError(null);

    try {
      const [studentResponse, summaryResponse, feesResponse, paymentsResponse] =
        await Promise.all([
          fetch(`/api/students/${studentId}`, { credentials: "include" }),
          fetch(`/api/students/${studentId}/fee-summary`, {
            credentials: "include",
          }),
          fetch(`/api/student-fees?studentId=${studentId}&pageSize=100`, {
            credentials: "include",
          }),
          fetch(`/api/payments?studentId=${studentId}&pageSize=100`, {
            credentials: "include",
          }),
        ]);

      if (!studentResponse.ok) {
        const json = await studentResponse.json();
        throw new Error(
          json?.error || json?.message || "Failed to load student",
        );
      }

      if (!summaryResponse.ok) {
        const json = await summaryResponse.json();
        throw new Error(
          json?.error || json?.message || "Failed to load fee summary",
        );
      }

      if (!feesResponse.ok) {
        const json = await feesResponse.json();
        throw new Error(
          json?.error || json?.message || "Failed to load fee ledger",
        );
      }

      if (!paymentsResponse.ok) {
        const json = await paymentsResponse.json();
        throw new Error(
          json?.error || json?.message || "Failed to load payments",
        );
      }

      const studentJson = await studentResponse.json();
      const summaryJson = await summaryResponse.json();
      const feesJson = await feesResponse.json();
      const paymentsJson = await paymentsResponse.json();

      const studentPayload =
        studentJson.data?.student ?? studentJson.data ?? {};
      setStudent({
        id: studentPayload.studentId || studentPayload.id || studentId,
        fullName: studentPayload.fullName || studentPayload.name || "Student",
        admissionNumber: studentPayload.admissionNumber || "",
        className: studentPayload.currentClass?.name || "N/A",
        status: studentPayload.status || "active",
      });

      setSummary(summaryJson.data || null);
      setFees(
        (feesJson.data || []).map((fee: any) => ({
          id: fee.id,
          invoiceNumber: fee.invoiceNumber || fee.invoice_number || null,
          feeName: fee.feeName || fee.feeNameDisplay || "Fee",
          academicYear: fee.academicYear || fee.academic_year?.year || null,
          termName: fee.termName || fee.term?.name || null,
          amountDue: Number(fee.amountDue || fee.amount_due || 0),
          amountPaid: Number(fee.amountPaid || fee.amount_paid || 0),
          balance: Number(fee.balance || 0),
          dueDate: fee.dueDate || fee.due_date || null,
          status: fee.status || "pending",
        })),
      );
      setPayments(
        (paymentsJson.data || []).map((payment: any) => ({
          id: payment.id,
          studentId: payment.studentId ?? payment.student_id ?? null,
          studentName: payment.studentName ?? payment.student_name ?? null,
          studentAdmissionNo:
            payment.studentAdmissionNo ??
            payment.student_admission_no ??
            payment.admissionNumber ??
            payment.admission_number ??
            null,
          feeName: payment.feeName ?? payment.fee_name ?? null,
          amountPaid: Number(payment.amountPaid ?? payment.amount_paid ?? 0),
          paymentMethod:
            payment.paymentMethod ?? payment.payment_method ?? "other",
          transactionId:
            payment.transactionId ?? payment.transaction_id ?? null,
          receiptNumber:
            payment.receiptNumber ?? payment.receipt_number ?? null,
          paymentDate: payment.paymentDate ?? payment.payment_date,
          recordedByName:
            payment.recordedByName ?? payment.recorded_by_name ?? null,
        })),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load ledger";
      setError(message);
      toastError("Ledger", message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [studentId, toastError]);

  useEffect(() => {
    if (!loading && user && canViewFinance) {
      fetchLedger();
    }
  }, [loading, user, canViewFinance, fetchLedger]);

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

  const closeWaiverModal = useCallback(() => {
    setFeeToWaive(null);
    setWaiverReason("");
    setIsWaivingFee(false);
  }, []);

  const handleSubmitWaiver = useCallback(async () => {
    if (!feeToWaive) {
      return;
    }

    const trimmedReason = waiverReason.trim();
    if (!trimmedReason) {
      toastError("Waiver", "Provide a reason before approving a waiver.");
      return;
    }

    setIsWaivingFee(true);

    try {
      const response = await fetch(`/api/student-fees/${feeToWaive.id}/waive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: trimmedReason }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error || json?.message || "Failed to approve fee waiver",
        );
      }

      success(
        "Fee waived",
        `${feeToWaive.feeName} was waived successfully.`,
      );
      closeWaiverModal();
      await fetchLedger();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to approve fee waiver";
      toastError("Waiver", message);
      setIsWaivingFee(false);
    }
  }, [closeWaiverModal, feeToWaive, fetchLedger, success, toastError, waiverReason]);

  if (loading || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading student ledger...</p>
        </div>
      </div>
    );
  }

  if (!user || !canViewFinance) {
    return (
      <div className="space-y-6">
        <PageHeader title="Student Ledger" />
        <Alert variant="destructive">
          You do not have access to student ledger data.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={student ? `${student.fullName} Ledger` : "Student Ledger"}
        description="Review assigned fees, payments, balances, and printable receipts for this student."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchLedger();
            }}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/students/${studentId}?tab=finance`)}
          >
            <FileText className="mr-2 h-4 w-4" />
            Student Profile
          </Button>
          {canCreatePayments && (
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                router.push(`/finance/payments/new?studentId=${studentId}`)
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          )}
        </div>
      </PageHeader>

      {error && <Alert variant="destructive">{error}</Alert>}

      {student && (
        <Card>
          <CardContent className="grid gap-4 p-5 md:grid-cols-4">
            <div>
              <p className="text-sm text-gray-500">Student</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {student.fullName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Admission Number</p>
              <p className="mt-1 font-medium text-gray-900">
                {student.admissionNumber || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Class</p>
              <p className="mt-1 font-medium text-gray-900">
                {student.className}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <div className="mt-2">
                <Badge variant="outline" className="capitalize">
                  {student.status || "active"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Total Due</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {formatCurrency(summary.totalDue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="mt-2 text-2xl font-semibold text-green-600">
                {formatCurrency(summary.totalPaid)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Outstanding Balance</p>
              <p
                className={cn(
                  "mt-2 text-2xl font-semibold",
                  summary.balance > 0 ? "text-red-600" : "text-green-600",
                )}
              >
                {formatCurrency(summary.balance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Ledger Status</p>
              <div className="mt-3">
                <FeeStatusBadge status={summary.status} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Fee Ledger</CardTitle>
          <Badge variant="outline">{fees.length} fee items</Badge>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              No fee assignments found for this student.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fee</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Due Date</TableHead>
                    {canApproveFinance && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell className="font-medium text-gray-900">
                        {fee.feeName}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-600">
                        {fee.invoiceNumber || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {[fee.academicYear, fee.termName]
                          .filter(Boolean)
                          .join(" • ") || "-"}
                      </TableCell>
                      <TableCell>
                        <FeeStatusBadge status={fee.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(fee.amountDue)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(fee.amountPaid)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold",
                          fee.balance > 0 ? "text-red-600" : "text-green-600",
                        )}
                      >
                        {formatCurrency(fee.balance)}
                      </TableCell>
                      <TableCell>
                        {fee.dueDate ? formatDate(fee.dueDate) : "-"}
                      </TableCell>
                      {canApproveFinance && (
                        <TableCell className="text-right">
                          {fee.balance > 0 && fee.status !== "waived" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setFeeToWaive(fee);
                                setWaiverReason("");
                              }}
                            >
                              <ShieldCheck className="h-4 w-4" />
                              Waive Balance
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Payment History</CardTitle>
          <Badge variant="outline">{payments.length} payments</Badge>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Wallet className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm text-gray-500">
                No payments have been recorded for this student yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                      <TableCell className="font-mono text-xs text-gray-600">
                        {payment.receiptNumber || payment.transactionId || "-"}
                      </TableCell>
                      <TableCell>{payment.feeName || "Fee payment"}</TableCell>
                      <TableCell className="capitalize">
                        {payment.paymentMethod.replace("_", " ")}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(payment.amountPaid)}
                      </TableCell>
                      <TableCell>{payment.recordedByName || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isReceiptLoading}
                          onClick={() => handleOpenReceipt(payment.id)}
                        >
                          <Receipt className="h-4 w-4" />
                          Reprint
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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

      <Modal open={!!feeToWaive} onClose={closeWaiverModal} size="sm">
        <ModalHeader>
          <ModalTitle>Approve Fee Waiver</ModalTitle>
          <ModalDescription>
            Clear the outstanding balance for this fee item and record the reason
            for the waiver approval. Waivers for fee assignments you created yourself require a different approver.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-4">
          {feeToWaive && (
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-medium text-gray-900">{feeToWaive.feeName}</p>
              <p className="mt-1">
                Outstanding balance:{" "}
                <span className="font-semibold text-red-600">
                  {formatCurrency(feeToWaive.balance)}
                </span>
              </p>
              {feeToWaive.amountPaid > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Existing payments will be preserved and only the remaining
                  balance will be waived.
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="waiver-reason"
              className="text-sm font-medium text-gray-900"
            >
              Waiver reason
            </label>
            <textarea
              id="waiver-reason"
              rows={4}
              value={waiverReason}
              onChange={(event) => setWaiverReason(event.target.value)}
              disabled={isWaivingFee}
              placeholder="Explain why this fee balance is being waived."
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={closeWaiverModal}
            disabled={isWaivingFee}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmitWaiver}
            loading={isWaivingFee}
          >
            Approve Waiver
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
