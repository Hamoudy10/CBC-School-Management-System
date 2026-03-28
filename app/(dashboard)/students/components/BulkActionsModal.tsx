"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

type BulkActionType = "promote" | "transfer" | "status";
type BulkStatusType =
  | "active"
  | "transferred"
  | "graduated"
  | "withdrawn"
  | "suspended";

interface ClassOption {
  classId: string;
  name: string;
  gradeId?: string;
  gradeName: string;
}

interface BulkActionsModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    action: BulkActionType;
    targetClassId?: string;
    status?: BulkStatusType;
  }) => Promise<void> | void;
  isSubmitting?: boolean;
  selectedCount: number;
  classes: ClassOption[];
}

const BULK_ACTION_OPTIONS: Array<{ value: BulkActionType; label: string }> = [
  { value: "promote", label: "Promote to class" },
  { value: "transfer", label: "Transfer to class" },
  { value: "status", label: "Update student status" },
];

const STATUS_OPTIONS: Array<{ value: BulkStatusType; label: string }> = [
  { value: "active", label: "Active" },
  { value: "transferred", label: "Transferred" },
  { value: "graduated", label: "Graduated" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "suspended", label: "Suspended" },
];

function getActionDescription(action: BulkActionType) {
  if (action === "promote") {
    return "Move the selected students into their next class and record the change in class history using the current academic context.";
  }

  if (action === "transfer") {
    return "Reassign the selected students to another class for operational transfer handling.";
  }

  return "Apply a lifecycle status update to all selected students in one step.";
}

export default function BulkActionsModal({
  open,
  onClose,
  onSubmit,
  isSubmitting = false,
  selectedCount,
  classes,
}: BulkActionsModalProps) {
  const [action, setAction] = useState<BulkActionType>("promote");
  const [targetClassId, setTargetClassId] = useState("");
  const [status, setStatus] = useState<BulkStatusType>("transferred");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAction("promote");
      setTargetClassId("");
      setStatus("transferred");
      setFormError(null);
    }
  }, [open]);

  const classOptions = useMemo(
    () =>
      classes.map((classOption) => ({
        value: classOption.classId,
        label: `${classOption.name}${classOption.gradeName ? ` - ${classOption.gradeName}` : ""}`,
      })),
    [classes],
  );

  const handleSubmit = async () => {
    setFormError(null);

    if ((action === "promote" || action === "transfer") && !targetClassId) {
      setFormError("Choose the destination class before continuing.");
      return;
    }

    if (action === "status" && !status) {
      setFormError("Choose the status to apply.");
      return;
    }

    await onSubmit({
      action,
      ...(targetClassId ? { targetClassId } : {}),
      ...(action === "status" ? { status } : {}),
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader>
        <ModalTitle>Bulk Student Actions</ModalTitle>
        <ModalDescription>
          Apply one lifecycle operation to {selectedCount} selected{" "}
          {selectedCount === 1 ? "student" : "students"}.
        </ModalDescription>
      </ModalHeader>
      <ModalBody className="space-y-4">
        <Alert variant="info">
          {getActionDescription(action)}
        </Alert>

        {formError && <Alert variant="destructive">{formError}</Alert>}

        <Select
          label="Action"
          value={action}
          onChange={(event) => setAction(event.target.value as BulkActionType)}
          disabled={isSubmitting}
        >
          {BULK_ACTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {(action === "promote" || action === "transfer") && (
          <Select
            label="Destination class"
            value={targetClassId}
            onChange={(event) => setTargetClassId(event.target.value)}
            disabled={isSubmitting}
            helperText={
              action === "promote"
                ? "Use this when the selected students should move together into a new class."
                : "Use this for operational class transfers."
            }
          >
            <option value="">Select a class</option>
            {classOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        )}

        {action === "status" && (
          <Select
            label="Student status"
            value={status}
            onChange={(event) => setStatus(event.target.value as BulkStatusType)}
            disabled={isSubmitting}
            helperText="Apply the same lifecycle status to every selected student."
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} loading={isSubmitting}>
          Apply Action
        </Button>
      </ModalFooter>
    </Modal>
  );
}
