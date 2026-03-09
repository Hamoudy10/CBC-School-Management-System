'use client';

import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface RemarksModalProps {
  open: boolean;
  studentName?: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function RemarksModal({
  open,
  studentName,
  value,
  onChange,
  onClose,
  onSave,
}: RemarksModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHeader>
        <ModalTitle>Remarks for {studentName}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <textarea
            placeholder="Enter remarks about the student's performance..."
            rows={4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onSave}>
          Save Remarks
        </Button>
      </ModalFooter>
    </Modal>
  );
}
