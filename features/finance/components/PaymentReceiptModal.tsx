"use client";

import { CheckCircle, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface PaymentReceiptModalData {
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

interface PaymentReceiptModalProps {
  open: boolean;
  onClose: () => void;
  receipt: PaymentReceiptModalData | null;
}

function buildPrintableHtml(markup: string, receiptNumber: string) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt ${receiptNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          .receipt { max-width: 720px; margin: 0 auto; border: 1px solid #d1d5db; border-radius: 16px; padding: 24px; }
          .header { text-align: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 16px; }
          .status { color: #15803d; font-weight: bold; font-size: 18px; margin-bottom: 8px; }
          .row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .row:last-child { border-bottom: 0; }
          .label { color: #6b7280; }
          .value { font-weight: 600; text-align: right; }
          .amount { font-size: 24px; font-weight: 700; color: #047857; }
          .balance { font-size: 18px; font-weight: 700; }
          .notes { margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 12px; }
        </style>
      </head>
      <body>
        ${markup}
      </body>
    </html>
  `;
}

export function PaymentReceiptModal({
  open,
  onClose,
  receipt,
}: PaymentReceiptModalProps) {
  const handlePrint = () => {
    if (!receipt) {
      return;
    }

    const printable = document.getElementById(`receipt-${receipt.id}`);
    if (!printable) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintableHtml(printable.outerHTML, receipt.receiptNumber),
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  if (!receipt) {
    return null;
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader>
        <ModalTitle>Payment Receipt</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <div
          id={`receipt-${receipt.id}`}
          className="rounded-xl border border-gray-200 bg-white p-6"
        >
          <div className="border-b border-gray-200 pb-4 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-3 text-lg font-semibold text-gray-900">
              Receipt #{receipt.receiptNumber}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Recorded on {formatDate(receipt.paymentDate)}
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500">Student</span>
                <span className="text-right text-sm font-medium text-gray-900">
                  {receipt.studentName}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500">Admission No.</span>
                <span className="text-right text-sm font-medium text-gray-900">
                  {receipt.studentAdmissionNo || "-"}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500">Class</span>
                <span className="text-right text-sm font-medium text-gray-900">
                  {receipt.className}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500">Fee</span>
                <span className="text-right text-sm font-medium text-gray-900">
                  {receipt.feeStructureName}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500">Method</span>
                <span className="text-right text-sm font-medium capitalize text-gray-900">
                  {receipt.paymentMethod.replace("_", " ")}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500">Amount Paid</span>
                <span className="text-right text-lg font-bold text-green-700">
                  {formatCurrency(receipt.amountPaid)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500">
                  Balance After Payment
                </span>
                <span className="text-right text-base font-semibold text-gray-900">
                  {formatCurrency(receipt.balanceAfterPayment)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500">Transaction</span>
                <span className="text-right text-sm font-medium text-gray-900">
                  {receipt.transactionId || "-"}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500">Recorded By</span>
                <span className="text-right text-sm font-medium text-gray-900">
                  {receipt.recordedByName}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500">Recorded At</span>
                <span className="text-right text-sm font-medium text-gray-900">
                  {formatDate(receipt.recordedAt)}
                </span>
              </div>
            </div>
          </div>

          {receipt.notes && (
            <div className="mt-5 rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Notes
              </p>
              <p className="mt-2 text-sm text-gray-700">{receipt.notes}</p>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
          Close
        </Button>
        <Button variant="primary" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          Print Receipt
        </Button>
      </ModalFooter>
    </Modal>
  );
}
