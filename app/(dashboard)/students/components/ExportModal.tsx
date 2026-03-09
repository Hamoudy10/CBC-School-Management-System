'use client';

import { FileSpreadsheet } from 'lucide-react';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'excel') => void;
  isExporting: boolean;
  totalStudents: number;
}

export default function ExportModal({
  open,
  onClose,
  onExport,
  isExporting,
  totalStudents,
}: ExportModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader>
        <ModalTitle>Export Students</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Export {totalStudents.toLocaleString()} students to a file. Choose your
            preferred format:
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => onExport('csv')}
              disabled={isExporting}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 p-4 transition-all hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <span className="font-medium text-gray-900">CSV Format</span>
              <span className="text-xs text-gray-500">
                Compatible with all spreadsheets
              </span>
            </button>

            <button
              onClick={() => onExport('excel')}
              disabled={isExporting}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 p-4 transition-all hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-8 w-8 text-blue-600" />
              <span className="font-medium text-gray-900">Excel Format</span>
              <span className="text-xs text-gray-500">.xlsx with formatting</span>
            </button>
          </div>

          {isExporting && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Spinner size="sm" />
              <span className="text-sm text-gray-600">Preparing export...</span>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
