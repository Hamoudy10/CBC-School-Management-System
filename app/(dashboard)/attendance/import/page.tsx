// app/(dashboard)/attendance/import/page.tsx
'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Download,
  Calendar,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  FileSpreadsheet,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';
import { useReferenceData } from '@/hooks/useReferenceData';

// ─── Types ───────────────────────────────────────────────────
interface ValidationError {
  row: number;
  admissionNumber: string;
  error: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  totalRecords: number;
  successfulImports: number;
  failedImports: number;
  errors: ValidationError[];
}

// ─── Main Component ──────────────────────────────────────────
export default function AttendanceBulkImportPage() {
  const router = useRouter();
  const { user, checkPermission } = useAuth();
  const { success, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── State ─────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {
    classes: referenceClasses,
    isLoading: isLoadingClasses,
  } = useReferenceData({ enabled: Boolean(user) });
  const classes = referenceClasses.map((c) => ({
    classId: c.classId,
    name: c.name,
  }));

  // ─── Permissions ───────────────────────────────────────────
  const canImportAttendance = checkPermission('attendance', 'create');


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {return;}

    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(csv|xlsx|xls)$/i)) {
      toastError('Invalid File', 'Please select a CSV or Excel file.');
      return;
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toastError('File Too Large', 'File size must be less than 5MB.');
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setImportResult(null);
  };

  const downloadTemplate = () => {
    const headers = ['Admission Number', 'Status', 'Arrival Time', 'Reason'];
    const sampleData = [
      ['STU-2024-001', 'present', '08:00', ''],
      ['STU-2024-002', 'absent', '', 'Sick'],
      ['STU-2024-003', 'late', '09:30', 'Traffic'],
      ['STU-2024-004', 'excused', '', 'Family event'],
    ];

    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(',')),
      '',
      'INSTRUCTIONS:',
      '1. Status must be one of: present, absent, late, excused',
      '2. Arrival time format: HH:MM (24-hour format)',
      '3. Reason is optional for absent/excused status',
      '4. Keep admission numbers consistent with system',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-import-template-${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    success('Template Downloaded', 'CSV template has been downloaded.');
  };

  const handleImport = async () => {
    if (!file || !selectedClassId || !selectedDate) {
      toastError('Missing Information', 'Please select a file, class, and date.');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('classId', selectedClassId);
      formData.append('date', selectedDate);

      const response = await fetch('/api/attendance/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const result = await response.json();
      
      if (result.success) {
        setImportResult(result.data);
        success(
          'Import Complete',
          `Successfully imported ${result.data.successfulImports} of ${result.data.totalRecords} attendance records.`
        );
        
        // Reset file selection
        setFile(null);
        setFileName('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        toastError('Import Failed', result.message || 'Failed to import attendance.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import attendance';
      toastError('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileName('');
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ─── Render ────────────────────────────────────────────────
  if (!user) {
    return null;
  }

  if (!canImportAttendance) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bulk Import Attendance" />
        <Alert variant="destructive">
          You do not have permission to import attendance. Please contact your administrator.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <PageHeader
        title="Bulk Import Attendance"
        description="Import attendance records for multiple students at once"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={downloadTemplate}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/attendance')}
          >
            <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
            Back to Attendance
          </Button>
        </div>
      </PageHeader>

      {/* ── Import Form ─────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Date and Class Selection */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                <Calendar className="inline-block mr-2 h-4 w-4" />
                Attendance Date
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                <Users className="inline-block mr-2 h-4 w-4" />
                Class
              </label>
              <Select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={isLoadingClasses}
              >
                <option value="">Select a class</option>
                {classes.map((cls) => (
                  <option key={cls.classId} value={cls.classId}>
                    {cls.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              <Upload className="inline-block mr-2 h-4 w-4" />
              Attendance File
            </label>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".csv,.xlsx,.xls"
                className="hidden"
                id="attendance-file-upload"
              />
              
              {!file ? (
                <label
                  htmlFor="attendance-file-upload"
                  className="cursor-pointer"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Upload className="h-12 w-12 text-gray-400" />
                    <div>
                      <span className="text-blue-600 hover:text-blue-500 font-medium">
                        Click to upload
                      </span>
                      <span className="text-gray-500"> or drag and drop</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      CSV or Excel files up to 5MB
                    </p>
                  </div>
                </label>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3">
                  <FileSpreadsheet className="h-12 w-12 text-green-500" />
                  <div>
                    <p className="font-medium text-gray-900">{fileName}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleReset}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-lg bg-gray-50 p-4">
            <h4 className="mb-2 flex items-center gap-2 font-medium text-gray-900">
              <Info className="h-4 w-4 text-blue-500" />
              File Format Requirements
            </h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Required columns: Admission Number, Status</li>
              <li>• Status values: present, absent, late, excused</li>
              <li>• Arrival Time: HH:MM format (24-hour) for present/late status</li>
              <li>• Reason: Optional text for absent/excused status</li>
              <li>• Admission numbers must match existing students</li>
            </ul>
          </div>

          {/* Import Button */}
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={!file || !selectedClassId || !selectedDate || isLoading}
              loading={isLoading}
              className="min-w-32"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Attendance
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Import Results ──────────────────────────────────── */}
      {importResult && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                {importResult.successfulImports > 0 ? (
                  <CheckCircle className="h-10 w-10 text-green-600" />
                ) : (
                  <AlertCircle className="h-10 w-10 text-red-600" />
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                {importResult.successfulImports > 0 ? 'Import Successful!' : 'Import Completed'}
              </h3>
              <p className="mt-2 text-gray-500">
                {importResult.message}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-sm font-medium text-green-600">Successful</p>
                <p className="text-2xl font-bold text-green-700">
                  {importResult.successfulImports}
                </p>
              </div>
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <p className="text-sm font-medium text-red-600">Failed</p>
                <p className="text-2xl font-bold text-red-700">
                  {importResult.failedImports}
                </p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mt-6">
                <h4 className="mb-3 font-medium text-gray-900 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Import Errors:
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {importResult.errors.map((err, idx) => (
                    <div key={idx} className="rounded border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-medium text-red-700">
                        Row {err.row}: {err.admissionNumber} - {err.error}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-center">
              <Button
                variant="secondary"
                onClick={() => router.push('/attendance')}
              >
                View Attendance
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Status Legend ───────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <h4 className="mb-3 font-medium text-gray-900">Status Legend</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600">Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-sm text-gray-600">Absent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-sm text-gray-600">Late</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-600">Excused</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
