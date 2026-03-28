"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Send, Undo2 } from "lucide-react";
import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

interface ReportCardOperationsProps {
  reportId: string;
  isPublished: boolean;
  canManageRemarks: boolean;
  canPublish: boolean;
  classTeacherRemarks: string | null;
  principalRemarks: string | null;
}

export function ReportCardOperations({
  reportId,
  isPublished,
  canManageRemarks,
  canPublish,
  classTeacherRemarks,
  principalRemarks,
}: ReportCardOperationsProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isRemarksOpen, setIsRemarksOpen] = useState(false);
  const [classTeacherValue, setClassTeacherValue] = useState(
    classTeacherRemarks ?? "",
  );
  const [principalValue, setPrincipalValue] = useState(
    principalRemarks ?? "",
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSavingRemarks, startSavingRemarks] = useTransition();
  const [isChangingStatus, startChangingStatus] = useTransition();

  const handleSaveRemarks = () => {
    setActionError(null);

    startSavingRemarks(async () => {
      try {
        const response = await fetch(`/api/reports/report-cards/${reportId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            classTeacherRemarks: classTeacherValue.trim(),
            principalRemarks: principalValue.trim(),
          }),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || "Failed to save report remarks.");
        }

        addToast({
          type: "success",
          title: "Remarks saved",
          description: "The report card remarks were updated successfully.",
        });
        setIsRemarksOpen(false);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save remarks.";
        setActionError(message);
        addToast({
          type: "error",
          title: "Save failed",
          description: message,
        });
      }
    });
  };

  const handleStatusChange = () => {
    setActionError(null);

    startChangingStatus(async () => {
      try {
        const response = await fetch(
          `/api/reports/report-cards/${reportId}/publish`,
          {
            method: isPublished ? "DELETE" : "POST",
            credentials: "include",
          },
        );
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success) {
          throw new Error(
            payload?.error ||
              (isPublished
                ? "Failed to move the report back to draft."
                : "Failed to publish the report."),
          );
        }

        addToast({
          type: "success",
          title: isPublished ? "Report moved to draft" : "Report published",
          description: payload?.data?.message ?? "Report status updated.",
        });
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update report status.";
        setActionError(message);
        addToast({
          type: "error",
          title: "Status update failed",
          description: message,
        });
      }
    });
  };

  if (!canManageRemarks && !canPublish) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canManageRemarks ? (
          <Button
            variant="secondary"
            onClick={() => {
              setActionError(null);
              setClassTeacherValue(classTeacherRemarks ?? "");
              setPrincipalValue(principalRemarks ?? "");
              setIsRemarksOpen(true);
            }}
          >
            <Edit3 className="h-4 w-4" />
            Edit Remarks
          </Button>
        ) : null}

        {canPublish ? (
          <Button
            variant={isPublished ? "secondary" : "primary"}
            onClick={handleStatusChange}
            loading={isChangingStatus}
          >
            {isPublished ? (
              <Undo2 className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isPublished ? "Move To Draft" : "Publish Report"}
          </Button>
        ) : null}
      </div>

      <Modal
        open={isRemarksOpen}
        onClose={() => !isSavingRemarks && setIsRemarksOpen(false)}
        size="lg"
      >
        <ModalHeader>
          <ModalTitle>Edit Report Remarks</ModalTitle>
          <ModalDescription>
            Update the teacher and principal remarks stored on this report
            card.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-4">
          {actionError ? <Alert variant="destructive">{actionError}</Alert> : null}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">
              Class teacher remarks
            </span>
            <textarea
              value={classTeacherValue}
              onChange={(event) => setClassTeacherValue(event.target.value)}
              rows={5}
              maxLength={2000}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Add remarks for the class teacher section"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">
              Principal remarks
            </span>
            <textarea
              value={principalValue}
              onChange={(event) => setPrincipalValue(event.target.value)}
              rows={5}
              maxLength={2000}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Add remarks for the principal section"
            />
          </label>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => setIsRemarksOpen(false)}
            disabled={isSavingRemarks}
          >
            Cancel
          </Button>
          <Button onClick={handleSaveRemarks} loading={isSavingRemarks}>
            Save Remarks
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
