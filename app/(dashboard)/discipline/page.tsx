// app/(dashboard)/discipline/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Shield,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  CheckCircle,
  Clock,
  User,
  Calendar,
  MapPin,
  FileText,
  MessageSquare,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  ChevronRight,
  Phone,
  Mail,
  X,
  Save,
  UserCheck,
  Bell,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ConfirmDialog,
} from '@/components/ui/Modal';
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
import { cn, formatDate } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────
type IncidentSeverity = 'minor' | 'moderate' | 'major' | 'critical';
type IncidentStatus = 'reported' | 'investigating' | 'resolved' | 'escalated';

interface DisciplinaryRecord {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  gradeName: string;
  photoUrl: string | null;
  incidentDate: string;
  incidentType: string;
  severity: IncidentSeverity;
  description: string;
  location: string | null;
  witnesses: string | null;
  actionTaken: string | null;
  status: IncidentStatus;
  followUpDate: string | null;
  followUpNotes: string | null;
  parentNotified: boolean;
  parentNotifiedDate: string | null;
  recordedBy: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DisciplineStats {
  total: number;
  open: number;
  resolved: number;
  thisMonth: number;
  lastMonth: number;
  bySeverity: {
    minor: number;
    moderate: number;
    major: number;
    critical: number;
  };
  byType: {
    type: string;
    count: number;
  }[];
  trend: number; // percentage change
}

interface StudentSearchResult {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  className: string;
  photoUrl: string | null;
}

// ─── Validation Schema ───────────────────────────────────────
const incidentSchema = z.object({
  studentId: z.string().min(1, 'Please select a student'),
  incidentDate: z.string().min(1, 'Incident date is required'),
  incidentType: z.string().min(1, 'Incident type is required'),
  severity: z.enum(['minor', 'moderate', 'major', 'critical']),
  description: z.string().min(10, 'Please provide a detailed description (min 10 characters)'),
  location: z.string().optional(),
  witnesses: z.string().optional(),
  actionTaken: z.string().optional(),
  followUpDate: z.string().optional(),
  notifyParent: z.boolean().default(false),
});

type IncidentFormData = z.infer<typeof incidentSchema>;

// ─── Constants ───────────────────────────────────────────────
const SEVERITY_CONFIG: Record<
  IncidentSeverity,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  minor: {
    label: 'Minor',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  moderate: {
    label: 'Moderate',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  major: {
    label: 'Major',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: <AlertOctagon className="h-4 w-4" />,
  },
  critical: {
    label: 'Critical',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: <AlertOctagon className="h-4 w-4" />,
  },
};

const STATUS_CONFIG: Record<
  IncidentStatus,
  { label: string; variant: 'default' | 'warning' | 'success' | 'error' }
> = {
  reported: { label: 'Reported', variant: 'default' },
  investigating: { label: 'Investigating', variant: 'warning' },
  resolved: { label: 'Resolved', variant: 'success' },
  escalated: { label: 'Escalated', variant: 'error' },
};

function normalizeSeverity(value?: string): IncidentSeverity {
  switch (value) {
    case 'minor':
    case 'moderate':
    case 'major':
    case 'critical':
      return value;
    case 'severe':
      return 'critical';
    default:
      return 'minor';
  }
}

function normalizeStatus(value?: string): IncidentStatus {
  switch (value) {
    case 'resolved':
      return 'resolved';
    case 'escalated':
      return 'escalated';
    case 'under_review':
    case 'in_progress':
    case 'investigating':
      return 'investigating';
    case 'open':
    case 'reported':
    default:
      return 'reported';
  }
}

function normalizeStats(data: any): DisciplineStats {
  const bySeverity = data?.bySeverity || data?.by_severity || {};
  const byStatus = data?.byStatus || data?.by_status || {};
  const total =
    data?.total ??
    data?.total_incidents ??
    Object.values(byStatus).reduce(
      (sum: number, count) => sum + Number(count || 0),
      0,
    );

  return {
    total,
    open:
      byStatus.open ||
      byStatus.reported ||
      byStatus.under_review ||
      byStatus.in_progress ||
      0,
    resolved: byStatus.resolved || byStatus.closed || 0,
    thisMonth: data?.thisMonth || 0,
    lastMonth: data?.lastMonth || 0,
    bySeverity: {
      minor: bySeverity.minor || 0,
      moderate: bySeverity.moderate || 0,
      major: bySeverity.major || 0,
      critical: bySeverity.critical || bySeverity.severe || 0,
    },
    byType: Array.isArray(data?.byType)
      ? data.byType
      : Object.entries(data?.by_type || {}).map(([type, count]) => ({
          type,
          count: Number(count || 0),
        })),
    trend: data?.trend || 0,
  };
}

const INCIDENT_TYPES = [
  'Bullying',
  'Fighting',
  'Disrespect to Staff',
  'Cheating',
  'Truancy',
  'Vandalism',
  'Theft',
  'Substance Abuse',
  'Dress Code Violation',
  'Late Coming',
  'Disruptive Behavior',
  'Use of Mobile Phone',
  'Inappropriate Language',
  'Other',
];

// ─── Stat Card Component ─────────────────────────────────────
interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
}

const colorConfig = {
  blue: { icon: 'bg-blue-100 text-blue-600' },
  green: { icon: 'bg-green-100 text-green-600' },
  amber: { icon: 'bg-amber-100 text-amber-600' },
  red: { icon: 'bg-red-100 text-red-600' },
  purple: { icon: 'bg-purple-100 text-purple-600' },
};

function StatCard({ title, value, subtitle, icon, color, trend, onClick }: StatCardProps) {
  const colors = colorConfig[color];

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
            )}
            {trend && (
              <div className="mt-1 flex items-center gap-1">
                {trend.isPositive ? (
                  <TrendingDown className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingUp className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {Math.abs(trend.value)}% vs last month
                </span>
              </div>
            )}
          </div>
          <div className={cn('rounded-xl p-2.5', colors.icon)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Severity Badge Component ────────────────────────────────
function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const config = SEVERITY_CONFIG[severity];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        config.bgColor,
        config.color
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// ─── Status Badge Component ──────────────────────────────────
function StatusBadge({ status }: { status: IncidentStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ─── Student Search Component ────────────────────────────────
interface StudentSearchProps {
  onSelect: (student: StudentSearchResult) => void;
  selectedStudent: StudentSearchResult | null;
  onClear: () => void;
  error?: string;
}

function StudentSearch({ onSelect, selectedStudent, onClear, error }: StudentSearchProps) {
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
      <div
        className={cn(
          'rounded-lg border-2 p-4',
          error ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              src={selectedStudent.photoUrl ?? undefined}
              alt={selectedStudent.fullName}
              name={selectedStudent.fullName}
              size="md"
            />
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
          placeholder="Search student by name or admission number..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className={cn('pl-10', error && 'border-red-500')}
        />
        {isSearching && (
          <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

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
                  <Avatar
                    src={student.photoUrl ?? undefined}
                    alt={student.fullName}
                    name={student.fullName}
                    size="sm"
                  />
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
                  No students found matching &quot;{searchTerm}&quot;
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Incident Form Modal ─────────────────────────────────────
interface IncidentFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: IncidentFormData) => Promise<void>;
  initialData?: Partial<DisciplinaryRecord>;
  mode: 'create' | 'edit';
  isSubmitting: boolean;
}

function IncidentFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  mode,
  isSubmitting,
}: IncidentFormModalProps) {
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(
    initialData
      ? {
          studentId: initialData.studentId!,
          fullName: initialData.studentName!,
          admissionNumber: initialData.admissionNumber!,
          className: initialData.className!,
          photoUrl: initialData.photoUrl ?? null,
        }
      : null
  );

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      studentId: initialData?.studentId || '',
      incidentDate: initialData?.incidentDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      incidentType: initialData?.incidentType || '',
      severity: initialData?.severity || 'minor',
      description: initialData?.description || '',
      location: initialData?.location || '',
      witnesses: initialData?.witnesses || '',
      actionTaken: initialData?.actionTaken || '',
      followUpDate: initialData?.followUpDate?.split('T')[0] || '',
      notifyParent: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        setSelectedStudent({
          studentId: initialData.studentId!,
          fullName: initialData.studentName!,
          admissionNumber: initialData.admissionNumber!,
          className: initialData.className!,
          photoUrl: initialData.photoUrl ?? null,
        });
        reset({
          studentId: initialData.studentId || '',
          incidentDate: initialData.incidentDate?.split('T')[0] || new Date().toISOString().split('T')[0],
          incidentType: initialData.incidentType || '',
          severity: initialData.severity || 'minor',
          description: initialData.description || '',
          location: initialData.location || '',
          witnesses: initialData.witnesses || '',
          actionTaken: initialData.actionTaken || '',
          followUpDate: initialData.followUpDate?.split('T')[0] || '',
          notifyParent: false,
        });
      } else {
        setSelectedStudent(null);
        reset({
          studentId: '',
          incidentDate: new Date().toISOString().split('T')[0],
          incidentType: '',
          severity: 'minor',
          description: '',
          location: '',
          witnesses: '',
          actionTaken: '',
          followUpDate: '',
          notifyParent: false,
        });
      }
    }
  }, [open, initialData, reset]);

  const handleStudentSelect = (student: StudentSearchResult) => {
    setSelectedStudent(student);
    setValue('studentId', student.studentId);
  };

  const handleFormSubmit = async (data: IncidentFormData) => {
    await onSubmit(data);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
    >
      <ModalHeader>
        <ModalTitle>
          {mode === 'create' ? 'Report Disciplinary Incident' : 'Edit Incident'}
        </ModalTitle>
      </ModalHeader>
      <ModalBody>
        <form id="incident-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Student Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Student *
            </label>
            <Controller
              name="studentId"
              control={control}
              render={({ field }) => (
                <StudentSearch
                  onSelect={handleStudentSelect}
                  selectedStudent={selectedStudent}
                  onClear={() => {
                    setSelectedStudent(null);
                    field.onChange('');
                  }}
                  error={errors.studentId?.message}
                />
              )}
            />
          </div>

          {/* Date and Type */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="incidentDate"
              control={control}
              render={({ field }) => (
                <Input
                  label="Incident Date *"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  error={errors.incidentDate?.message}
                  {...field}
                />
              )}
            />

            <Controller
              name="incidentType"
              control={control}
              render={({ field }) => (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Incident Type *
                  </label>
                  <Select
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.incidentType?.message}
                  >
                    <option value="">Select type</option>
                    {INCIDENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            />
          </div>

          {/* Severity */}
          <Controller
            name="severity"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Severity *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(SEVERITY_CONFIG) as IncidentSeverity[]).map(
                    (severity) => {
                      const config = SEVERITY_CONFIG[severity];
                      const isSelected = field.value === severity;

                      return (
                        <button
                          key={severity}
                          type="button"
                          onClick={() => field.onChange(severity)}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all',
                            isSelected
                              ? `border-current ${config.bgColor} ${config.color}`
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          {config.icon}
                          <span className="text-xs font-medium">
                            {config.label}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          />

          {/* Description */}
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Description *
                </label>
                <textarea
                  placeholder="Provide a detailed description of the incident..."
                  rows={4}
                  className={cn(
                    'w-full rounded-lg border px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
                    errors.description
                      ? 'border-red-500'
                      : 'border-gray-300'
                  )}
                  {...field}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description.message}</p>
                )}
              </div>
            )}
          />

          {/* Location and Witnesses */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="location"
              control={control}
              render={({ field }) => (
                <Input
                  label="Location"
                  placeholder="e.g., Classroom 3A, Playground"
                  leftIcon={<MapPin className="h-4 w-4" />}
                  {...field}
                />
              )}
            />

            <Controller
              name="witnesses"
              control={control}
              render={({ field }) => (
                <Input
                  label="Witnesses"
                  placeholder="Names of witnesses"
                  leftIcon={<User className="h-4 w-4" />}
                  {...field}
                />
              )}
            />
          </div>

          {/* Action Taken */}
          <Controller
            name="actionTaken"
            control={control}
            render={({ field }) => (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Action Taken
                </label>
                <textarea
                  placeholder="Describe any immediate action taken..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  {...field}
                />
              </div>
            )}
          />

          {/* Follow-up Date */}
          <Controller
            name="followUpDate"
            control={control}
            render={({ field }) => (
              <Input
                label="Follow-up Date"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                {...field}
              />
            )}
          />

          {/* Notify Parent */}
          <Controller
            name="notifyParent"
            control={control}
            render={({ field }) => (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-4">
                <input
                  type="checkbox"
                  id="notifyParent"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <label
                    htmlFor="notifyParent"
                    className="text-sm font-medium text-gray-900 cursor-pointer"
                  >
                    Notify Parent/Guardian
                  </label>
                  <p className="text-xs text-gray-500">
                    Send notification about this incident to the student&apos;s guardians
                  </p>
                </div>
              </div>
            )}
          />
        </form>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="incident-form" type="submit" variant="primary" loading={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {mode === 'create' ? 'Report Incident' : 'Save Changes'}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

// ─── Incident Detail Modal ───────────────────────────────────
interface IncidentDetailModalProps {
  open: boolean;
  onClose: () => void;
  incident: DisciplinaryRecord | null;
  onEdit: () => void;
  onResolve: () => void;
  onNotifyParent: () => void;
  canEdit: boolean;
}

function IncidentDetailModal({
  open,
  onClose,
  incident,
  onEdit,
  onResolve,
  onNotifyParent,
  canEdit,
}: IncidentDetailModalProps) {
  if (!incident) return null;

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader>
        <ModalTitle>Incident Details</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-6">
        {/* Student Info */}
        <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4">
          <Avatar
            src={incident.photoUrl ?? undefined}
            alt={incident.studentName}
            name={incident.studentName}
            size="lg"
          />
          <div>
            <p className="font-semibold text-gray-900">{incident.studentName}</p>
            <p className="text-sm text-gray-600">
              {incident.admissionNumber} • {incident.className}
            </p>
          </div>
        </div>

        {/* Incident Info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray-500">Incident Type</p>
            <p className="font-medium text-gray-900">{incident.incidentType}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Incident Date</p>
            <p className="font-medium text-gray-900">
              {formatDate(incident.incidentDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Severity</p>
            <SeverityBadge severity={incident.severity} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <StatusBadge status={incident.status} />
          </div>
          {incident.location && (
            <div>
              <p className="text-xs text-gray-500">Location</p>
              <p className="font-medium text-gray-900">{incident.location}</p>
            </div>
          )}
          {incident.witnesses && (
            <div>
              <p className="text-xs text-gray-500">Witnesses</p>
              <p className="font-medium text-gray-900">{incident.witnesses}</p>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Description</p>
          <p className="text-gray-700 whitespace-pre-wrap rounded-lg bg-gray-50 p-3">
            {incident.description}
          </p>
        </div>

        {/* Action Taken */}
        {incident.actionTaken && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Action Taken</p>
            <p className="text-gray-700 whitespace-pre-wrap rounded-lg bg-amber-50 p-3">
              {incident.actionTaken}
            </p>
          </div>
        )}

        {/* Follow-up */}
        {incident.followUpDate && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              Follow-up scheduled for {formatDate(incident.followUpDate)}
            </span>
          </div>
        )}

        {/* Parent Notification */}
        <div className="flex items-center gap-2">
          {incident.parentNotified ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">
                Parent notified on {formatDate(incident.parentNotifiedDate!)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Parent not yet notified</span>
            </div>
          )}
        </div>

        {/* Meta Info */}
        <div className="border-t border-gray-200 pt-4 text-xs text-gray-500">
          <p>Recorded by: {incident.recordedBy}</p>
          <p>Recorded on: {formatDate(incident.createdAt)}</p>
          {incident.resolvedBy && (
            <p>
              Resolved by: {incident.resolvedBy} on {formatDate(incident.resolvedAt!)}
            </p>
          )}
        </div>
      </div>
    </ModalBody>
    <ModalFooter>
        {canEdit && (
          <div className="flex justify-end gap-2 text-gray-500">
            {!incident.parentNotified && (
              <Button variant="secondary" size="sm" onClick={onNotifyParent}>
                <Bell className="mr-2 h-4 w-4" />
                Notify Parent
              </Button>
            )}
            {incident.status !== 'resolved' && (
              <Button variant="secondary" size="sm" onClick={onResolve}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Resolved
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        )}
      </ModalFooter>
    </Modal>
  );
}

// ─── Main Page Component ─────────────────────────────────────
export default function DisciplinePage() {
  const router = useRouter();
  const { user, checkPermission } = useAuth();
  const { success, error: toastError, info } = useToast();

  // ─── State ─────────────────────────────────────────────────
  const [records, setRecords] = useState<DisciplinaryRecord[]>([]);
  const [stats, setStats] = useState<DisciplineStats | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState('all');

  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedRecord, setSelectedRecord] = useState<DisciplinaryRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailRecord, setDetailRecord] = useState<DisciplinaryRecord | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState<DisciplinaryRecord | null>(null);

  // ─── Permissions ───────────────────────────────────────────
  const canCreate = checkPermission('compliance', 'create');
  const canEdit = checkPermission('compliance', 'update');
  const canDelete = checkPermission('compliance', 'delete');

  // ─── Fetch Data ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch records
      const recordsResponse = await fetch('/api/discipline', {
        credentials: 'include',
      });

      if (recordsResponse.ok) {
        const json = await recordsResponse.json();
        const records = Array.isArray(json.data)
          ? json.data
          : (json.data?.records ?? []);
        setRecords(
          records.map((r: any) => ({
            id: r.id,
            studentId: r.student_id || r.studentId,
            studentName:
              r.student?.full_name ||
              r.student?.name ||
              r.studentName ||
              `${r.student?.first_name || ''} ${r.student?.last_name || ''}`.trim(),
            admissionNumber: r.student?.admission_number || r.admissionNumber,
            className:
              r.student?.class_name ||
              r.student?.current_class?.name ||
              r.className ||
              'N/A',
            gradeName: r.student?.current_class?.grade?.name || r.gradeName || '',
            photoUrl: r.student?.photo_url || r.photoUrl,
            incidentDate: r.incident_date || r.incidentDate,
            incidentType: r.incident_type || r.incidentType,
            severity: normalizeSeverity(r.severity),
            description: r.description,
            location: r.location,
            witnesses: r.witnesses,
            actionTaken: r.action_taken || r.actionTaken,
            status: normalizeStatus(r.status),
            followUpDate: r.follow_up_date || r.followUpDate,
            followUpNotes: r.follow_up_notes || r.followUpNotes,
            parentNotified: r.parent_notified || r.parentNotified || false,
            parentNotifiedDate: r.parent_notified_date || r.parentNotifiedDate,
            recordedBy: r.recorded_by_user?.first_name
              ? `${r.recorded_by_user.first_name} ${r.recorded_by_user.last_name}`
              : r.reported_by_email || r.recordedBy || 'System',
            resolvedBy: r.resolved_by_user
              ? `${r.resolved_by_user.first_name} ${r.resolved_by_user.last_name}`
              : r.resolvedBy,
            resolvedAt: r.resolved_at || r.resolvedAt,
            createdAt: r.created_at || r.createdAt,
            updatedAt: r.updated_at || r.updatedAt,
          }))
        );

        if (json.data?.summary) {
          setStats(normalizeStats(json.data.summary));
        }
      }

      // Fetch stats
      const statsResponse = await fetch('/api/discipline/summary', {
        credentials: 'include',
      });

      if (statsResponse.ok) {
        const json = await statsResponse.json();
        setStats(normalizeStats(json.data));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchData();
      setIsLoading(false);
    };

    loadData();
  }, [fetchData]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
    success('Refreshed', 'Discipline records have been updated.');
  };

  const handleCreateNew = () => {
    setSelectedRecord(null);
    setFormMode('create');
    setShowFormModal(true);
  };

  const handleEdit = (record: DisciplinaryRecord) => {
    setSelectedRecord(record);
    setFormMode('edit');
    setShowFormModal(true);
    setShowDetailModal(false);
  };

  const handleView = (record: DisciplinaryRecord) => {
    setDetailRecord(record);
    setShowDetailModal(true);
  };

  const handleDeleteClick = (record: DisciplinaryRecord) => {
    setDeleteRecord(record);
    setShowDeleteConfirm(true);
  };

  const handleFormSubmit = async (data: IncidentFormData) => {
    setIsSubmitting(true);

    try {
      const url = formMode === 'edit' && selectedRecord
        ? `/api/discipline/${selectedRecord.id}`
        : '/api/discipline';

      const method = formMode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save incident');
      }

      success(formMode === 'edit' ? 'Incident Updated' : 'Incident Reported', 'The disciplinary record has been saved successfully.');

      setShowFormModal(false);
      setSelectedRecord(null);
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toastError('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!detailRecord) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/discipline/${detailRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'resolved' }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve incident');
      }

      success('Incident Resolved', 'The incident has been marked as resolved.');

      setShowDetailModal(false);
      setDetailRecord(null);
      fetchData();
    } catch (err) {
      toastError('Error', 'Failed to resolve incident.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNotifyParent = async () => {
    if (!detailRecord) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/discipline/${detailRecord.id}/notify`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to notify parent');
      }

      success('Parent Notified', 'The parent/guardian has been notified about this incident.');

      setShowDetailModal(false);
      setDetailRecord(null);
      fetchData();
    } catch (err) {
      toastError('Error', 'Failed to notify parent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRecord) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/discipline/${deleteRecord.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete incident');
      }

      success('Incident Deleted', 'The disciplinary record has been removed.');

      setShowDeleteConfirm(false);
      setDeleteRecord(null);
      fetchData();
    } catch (err) {
      toastError('Error', 'Failed to delete incident.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Filtering ─────────────────────────────────────────────
  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      !searchTerm ||
      record.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.incidentType.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity = !filterSeverity || record.severity === filterSeverity;

    const matchesStatus = !filterStatus || record.status === filterStatus;

    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'open' && record.status !== 'resolved') ||
      (activeTab === 'resolved' && record.status === 'resolved');

    return matchesSearch && matchesSeverity && matchesStatus && matchesTab;
  });

  // ─── Render ────────────────────────────────────────────────
  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading discipline records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <PageHeader
        title="Discipline Management"
        description="Track and manage student disciplinary incidents"
      >
        <div className="flex items-center gap-2">
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
          {canCreate && (
            <Button variant="primary" size="sm" onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Report Incident
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Incidents"
            value={stats.total}
            subtitle="All time"
            icon={<Shield className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            title="Open Cases"
            value={stats.open}
            icon={<AlertCircle className="h-5 w-5" />}
            color="amber"
            onClick={() => setActiveTab('open')}
          />
          <StatCard
            title="Resolved"
            value={stats.resolved}
            icon={<CheckCircle className="h-5 w-5" />}
            color="green"
            onClick={() => setActiveTab('resolved')}
          />
          <StatCard
            title="This Month"
            value={stats.thisMonth}
            icon={<Calendar className="h-5 w-5" />}
            color="purple"
            trend={{
              value: stats.trend,
              isPositive: stats.trend < 0,
            }}
          />
          <StatCard
            title="Critical"
            value={stats.bySeverity?.critical || 0}
            icon={<AlertOctagon className="h-5 w-5" />}
            color="red"
            onClick={() => setFilterSeverity('critical')}
          />
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by student name, admission no, or incident type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="w-36"
              >
                <option value="">All Severity</option>
                {(Object.keys(SEVERITY_CONFIG) as IncidentSeverity[]).map(
                  (severity) => (
                    <option key={severity} value={severity}>
                      {SEVERITY_CONFIG[severity].label}
                    </option>
                  )
                )}
              </Select>

              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-36"
              >
                <option value="">All Status</option>
                {(Object.keys(STATUS_CONFIG) as IncidentStatus[]).map(
                  (status) => (
                    <option key={status} value={status}>
                      {STATUS_CONFIG[status].label}
                    </option>
                  )
                )}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs & Table ────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabTrigger value="all">
            All ({records.length})
          </TabTrigger>
          <TabTrigger value="open">
            Open ({records.filter((r) => r.status !== 'resolved').length})
          </TabTrigger>
          <TabTrigger value="resolved">
            Resolved ({records.filter((r) => r.status === 'resolved').length})
          </TabTrigger>
        </TabsList>

        <TabContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {filteredRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Incident</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Parent Notified</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
                        <TableRow
                          key={record.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => handleView(record)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={record.photoUrl ?? undefined}
                                alt={record.studentName}
                                name={record.studentName}
                                size="sm"
                              />
                              <div>
                                <p className="font-medium text-gray-900">
                                  {record.studentName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {record.admissionNumber} • {record.className}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-gray-900">
                              {record.incidentType}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">
                              {record.description}
                            </p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(record.incidentDate)}
                          </TableCell>
                          <TableCell>
                            <SeverityBadge severity={record.severity} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={record.status} />
                          </TableCell>
                          <TableCell>
                            {record.parentNotified ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <X className="h-5 w-5 text-gray-300" />
                            )}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleView(record)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(record)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(record)}
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Shield className="h-12 w-12 text-gray-300" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {searchTerm || filterSeverity || filterStatus
                      ? 'No Records Found'
                      : 'No Disciplinary Records'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm || filterSeverity || filterStatus
                      ? 'Try adjusting your filters.'
                      : 'No incidents have been reported yet.'}
                  </p>
                  {canCreate && !searchTerm && !filterSeverity && !filterStatus && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="mt-4"
                      onClick={handleCreateNew}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Report Incident
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>

      {/* ── Incident Form Modal ─────────────────────────────── */}
      <IncidentFormModal
        open={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedRecord(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={selectedRecord ?? undefined}
        mode={formMode}
        isSubmitting={isSubmitting}
      />

      {/* ── Incident Detail Modal ───────────────────────────── */}
      <IncidentDetailModal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailRecord(null);
        }}
        incident={detailRecord}
        onEdit={() => detailRecord && handleEdit(detailRecord)}
        onResolve={handleResolve}
        onNotifyParent={handleNotifyParent}
        canEdit={canEdit}
      />

      {/* ── Delete Confirmation ─────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteRecord(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Incident Record"
        description={`Are you sure you want to delete this disciplinary record for ${deleteRecord?.studentName}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={isSubmitting}
      />
    </div>
  );
}
