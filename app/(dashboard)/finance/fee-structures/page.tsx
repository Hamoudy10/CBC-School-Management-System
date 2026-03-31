// app/(dashboard)/finance/fee-structures/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  FileText,
  DollarSign,
  Users,
  GraduationCap,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  X,
  Save,
  ArrowLeft,
  Copy,
  Eye,
  UserPlus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter, ConfirmDialog } from '@/components/ui/Modal';
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
import { cn, formatCurrency } from '@/lib/utils';

// ─── Validation Schemas ──────────────────────────────────────
const feeStructureSchema = z.object({
  name: z.string().min(1, 'Fee name is required').max(150),
  description: z.string().max(500).optional(),
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Enter a valid amount' })
    .positive('Amount must be greater than 0'),
  gradeId: z.string().optional(),
  termId: z.string().optional(),
  isMandatory: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

type FeeStructureFormData = z.infer<typeof feeStructureSchema>;

const bulkAssignSchema = z.object({
  feeStructureId: z.string().min(1, 'Please select a fee structure'),
  assignmentType: z.enum(['all', 'grade', 'class']),
  gradeId: z.string().optional(),
  classId: z.string().optional(),
  overwriteExisting: z.boolean().default(false),
});

type BulkAssignFormData = z.infer<typeof bulkAssignSchema>;

// ─── Types ───────────────────────────────────────────────────
interface FeeStructure {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  gradeId: string | null;
  gradeName: string | null;
  termId: string | null;
  termName: string | null;
  academicYearId: string;
  academicYear: string;
  isMandatory: boolean;
  isActive: boolean;
  createdAt: string;
  // Statistics
  assignedCount: number;
  totalExpected: number;
  totalCollected: number;
  collectionRate: number;
}

interface GradeOption {
  gradeId: string;
  name: string;
}

interface ClassOption {
  classId: string;
  name: string;
  gradeName: string;
  gradeId: string;
}

interface TermOption {
  termId: string;
  name: string;
}

// ─── Fee Structure Card Component ────────────────────────────
interface FeeStructureCardProps {
  structure: FeeStructure;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAssign: () => void;
  onViewAssignments: () => void;
  canEdit: boolean;
}

function FeeStructureCard({
  structure,
  onEdit,
  onDelete,
  onDuplicate,
  onAssign,
  onViewAssignments,
  canEdit,
}: FeeStructureCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Card className="relative overflow-hidden transition-all hover:shadow-md">
      {/* Status Indicator */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-1',
          structure.isActive ? 'bg-green-500' : 'bg-gray-300'
        )}
      />

      <CardContent className="p-5 pl-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 truncate">
                {structure.name}
              </h3>
              {structure.isMandatory && (
                <Badge variant="primary" className="text-xs">
                  Mandatory
                </Badge>
              )}
              {!structure.isActive && (
                <Badge variant="default" className="text-xs">
                  Inactive
                </Badge>
              )}
            </div>

            {structure.description && (
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                {structure.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              {structure.gradeName ? (
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  {structure.gradeName}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-blue-600">
                  <GraduationCap className="h-4 w-4" />
                  All Grades
                </span>
              )}

              {structure.termName ? (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {structure.termName}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-blue-600">
                  <Calendar className="h-4 w-4" />
                  Full Year
                </span>
              )}

              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {structure.assignedCount} students
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(structure.amount)}
              </p>
              <p className="text-xs text-gray-500">per student</p>
            </div>

            {canEdit && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMenu(!showMenu)}
                  className="h-8 w-8 p-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>

                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      <button
                        onClick={() => {
                          onEdit();
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          onAssign();
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <UserPlus className="h-4 w-4" />
                        Assign to Students
                      </button>
                      <button
                        onClick={() => {
                          onViewAssignments();
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Eye className="h-4 w-4" />
                        View Assignments
                      </button>
                      <button
                        onClick={() => {
                          onDuplicate();
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Copy className="h-4 w-4" />
                        Duplicate
                      </button>
                      <div className="my-1 border-t border-gray-100" />
                      <button
                        onClick={() => {
                          onDelete();
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Collection Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 rounded-lg bg-gray-50 p-3">
          <div className="text-center">
            <p className="text-xs text-gray-500">Expected</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(structure.totalExpected)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Collected</p>
            <p className="text-sm font-semibold text-green-600">
              {formatCurrency(structure.totalCollected)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Rate</p>
            <p
              className={cn(
                'text-sm font-semibold',
                structure.collectionRate >= 80
                  ? 'text-green-600'
                  : structure.collectionRate >= 50
                    ? 'text-amber-600'
                    : 'text-red-600'
              )}
            >
              {structure.collectionRate.toFixed(0)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Fee Structure Form Modal ────────────────────────────────
interface FeeStructureFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FeeStructureFormData) => Promise<void>;
  initialData?: Partial<FeeStructureFormData>;
  grades: GradeOption[];
  terms: TermOption[];
  isSubmitting: boolean;
  mode: 'create' | 'edit' | 'duplicate';
}

function FeeStructureFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  grades,
  terms,
  isSubmitting,
  mode,
}: FeeStructureFormModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeeStructureFormData>({
    resolver: zodResolver(feeStructureSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      amount: initialData?.amount || 0,
      gradeId: initialData?.gradeId || '',
      termId: initialData?.termId || '',
      isMandatory: initialData?.isMandatory ?? true,
      isActive: initialData?.isActive ?? true,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: mode === 'duplicate' ? `${initialData?.name} (Copy)` : initialData?.name || '',
        description: initialData?.description || '',
        amount: initialData?.amount || 0,
        gradeId: initialData?.gradeId || '',
        termId: initialData?.termId || '',
        isMandatory: initialData?.isMandatory ?? true,
        isActive: initialData?.isActive ?? true,
      });
    }
  }, [open, initialData, mode, reset]);

  const handleFormSubmit = async (data: FeeStructureFormData) => {
    await onSubmit(data);
  };

  const titles = {
    create: 'Create Fee Structure',
    edit: 'Edit Fee Structure',
    duplicate: 'Duplicate Fee Structure',
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader>
        <ModalTitle>{titles[mode]}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <form id="fee-structure-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Name */}
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Input
              label="Fee Name *"
              placeholder="e.g., Tuition Fee, Activity Fee, Lunch Program"
              error={errors.name?.message}
              {...field}
            />
          )}
        />

        {/* Description */}
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                placeholder="Optional description of this fee..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                {...field}
              />
            </div>
          )}
        />

        {/* Amount */}
        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <Input
              label="Amount (KES) *"
              type="number"
              min={0}
              step={0.01}
              placeholder="Enter amount"
              error={errors.amount?.message}
              leftIcon={<DollarSign className="h-4 w-4" />}
              {...field}
              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
            />
          )}
        />

        {/* Grade & Term Selection */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="gradeId"
            control={control}
            render={({ field }) => (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Applicable Grade
                </label>
                <Select value={field.value || ''} onChange={field.onChange}>
                  <option value="">All Grades</option>
                  {grades.map((grade) => (
                    <option key={grade.gradeId} value={grade.gradeId}>
                      {grade.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-gray-500">
                  Leave empty to apply to all grades
                </p>
              </div>
            )}
          />

          <Controller
            name="termId"
            control={control}
            render={({ field }) => (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Applicable Term
                </label>
                <Select value={field.value || ''} onChange={field.onChange}>
                  <option value="">Full Year</option>
                  {terms.map((term) => (
                    <option key={term.termId} value={term.termId}>
                      {term.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-gray-500">
                  Leave empty for yearly fee
                </p>
              </div>
            )}
          />
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-6">
          <Controller
            name="isMandatory"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Mandatory fee</span>
              </label>
            )}
          />

          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            )}
          />
        </div>

        </form>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="fee-structure-form" type="submit" variant="primary" loading={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {mode === 'create' ? 'Create' : mode === 'edit' ? 'Save Changes' : 'Create Copy'}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

// ─── Bulk Assignment Modal ───────────────────────────────────
interface BulkAssignModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BulkAssignFormData) => Promise<void>;
  feeStructure: FeeStructure | null;
  grades: GradeOption[];
  classes: ClassOption[];
  isSubmitting: boolean;
}

function BulkAssignModal({
  open,
  onClose,
  onSubmit,
  feeStructure,
  grades,
  classes,
  isSubmitting,
}: BulkAssignModalProps) {
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<BulkAssignFormData>({
    resolver: zodResolver(bulkAssignSchema),
    defaultValues: {
      feeStructureId: feeStructure?.id || '',
      assignmentType: 'all',
      gradeId: '',
      classId: '',
      overwriteExisting: false,
    },
  });

  const watchAssignmentType = watch('assignmentType');
  const watchGradeId = watch('gradeId');

  useEffect(() => {
    if (open && feeStructure) {
      reset({
        feeStructureId: feeStructure.id,
        assignmentType: 'all',
        gradeId: '',
        classId: '',
        overwriteExisting: false,
      });
    }
  }, [open, feeStructure, reset]);

  const filteredClasses = watchGradeId
    ? classes.filter((c) => c.gradeId === watchGradeId)
    : classes;

  if (!feeStructure) {return null;}

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
    >
      <ModalHeader>
        <ModalTitle>Assign Fee to Students</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <form id="bulk-assign-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Fee Info */}
        <div className="rounded-lg bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-900">{feeStructure.name}</p>
              <p className="text-sm text-blue-700">
                {feeStructure.gradeName || 'All Grades'} •{' '}
                {feeStructure.termName || 'Full Year'}
              </p>
            </div>
            <p className="text-xl font-bold text-blue-900">
              {formatCurrency(feeStructure.amount)}
            </p>
          </div>
        </div>

        {/* Assignment Type */}
        <Controller
          name="assignmentType"
          control={control}
          render={({ field }) => (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Assign to *
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'all', label: 'All Students', icon: Users },
                  { value: 'grade', label: 'By Grade', icon: GraduationCap },
                  { value: 'class', label: 'By Class', icon: FileText },
                ].map((option) => {
                  const Icon = option.icon;
                  const isSelected = field.value === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => field.onChange(option.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-6 w-6',
                          isSelected ? 'text-blue-600' : 'text-gray-400'
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isSelected ? 'text-blue-700' : 'text-gray-700'
                        )}
                      >
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        />

        {/* Grade Selection */}
        {(watchAssignmentType === 'grade' || watchAssignmentType === 'class') && (
          <Controller
            name="gradeId"
            control={control}
            render={({ field }) => (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Select Grade *
                </label>
                <Select value={field.value || ''} onChange={field.onChange}>
                  <option value="">Select grade</option>
                  {grades.map((grade) => (
                    <option key={grade.gradeId} value={grade.gradeId}>
                      {grade.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          />
        )}

        {/* Class Selection */}
        {watchAssignmentType === 'class' && watchGradeId && (
          <Controller
            name="classId"
            control={control}
            render={({ field }) => (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Select Class *
                </label>
                <Select value={field.value || ''} onChange={field.onChange}>
                  <option value="">Select class</option>
                  {filteredClasses.map((cls) => (
                    <option key={cls.classId} value={cls.classId}>
                      {cls.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          />
        )}

        {/* Overwrite Option */}
        <Controller
          name="overwriteExisting"
          control={control}
          render={({ field }) => (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-sm font-medium text-amber-800">
                    Overwrite existing assignments
                  </span>
                  <p className="text-xs text-amber-600">
                    If checked, students who already have this fee assigned will
                    have their amounts reset. Existing payments will be preserved.
                  </p>
                </div>
              </label>
            </div>
          )}
        />

        {/* Summary */}
        <Alert variant="info" title="Assignment Preview">
          {watchAssignmentType === 'all' && (
            <p>This fee will be assigned to all active students in the school.</p>
          )}
          {watchAssignmentType === 'grade' && watchGradeId && (
            <p>
              This fee will be assigned to all active students in{' '}
              <strong>
                {grades.find((g) => g.gradeId === watchGradeId)?.name}
              </strong>
              .
            </p>
          )}
          {watchAssignmentType === 'class' && watch('classId') && (
            <p>
              This fee will be assigned to all active students in{' '}
              <strong>
                {filteredClasses.find((c) => c.classId === watch('classId'))?.name}
              </strong>
              .
            </p>
          )}
        </Alert>

        </form>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="bulk-assign-form" type="submit" variant="primary" loading={isSubmitting}>
            <UserPlus className="mr-2 h-4 w-4" />
            Assign Fee
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

// ─── Main Page Component ─────────────────────────────────────
export default function FeeStructuresPage() {
  const router = useRouter();
  const { user, checkPermission } = useAuth();
  const { success, error: toastError, info } = useToast();

  // ─── State ─────────────────────────────────────────────────
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [selectedStructure, setSelectedStructure] = useState<FeeStructure | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignStructure, setAssignStructure] = useState<FeeStructure | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStructure, setDeleteStructure] = useState<FeeStructure | null>(null);

  // ─── Permissions ───────────────────────────────────────────
  const canManageFees = checkPermission('finance', 'create');

  // ─── Fetch Data ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch fee structures
      const feesResponse = await fetch('/api/fees', {
        credentials: 'include',
      });
      if (feesResponse.ok) {
        const json = await feesResponse.json();
        setFeeStructures(
          (json.data || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            description: f.description,
            amount: Number(f.amount),
            gradeId: f.grade_id || f.gradeId,
            gradeName: f.grade?.name || f.gradeName,
            termId: f.term_id || f.termId,
            termName: f.term?.name || f.termName,
            academicYearId: f.academic_year_id || f.academicYearId,
            academicYear: f.academic_year?.year || f.academicYear || '',
            isMandatory: f.is_mandatory ?? f.isMandatory ?? true,
            isActive: f.is_active ?? f.isActive ?? true,
            createdAt: f.created_at || f.createdAt,
            assignedCount: f.assignedCount || f.assigned_count || 0,
            totalExpected: Number(f.totalExpected || f.total_expected || 0),
            totalCollected: Number(f.totalCollected || f.total_collected || 0),
            collectionRate: Number(f.collectionRate || f.collection_rate || 0),
          }))
        );
      }

      // Fetch grades from the shared reference-data endpoint so we get real grade IDs
      const gradesResponse = await fetch('/api/settings/reference-data', {
        credentials: 'include',
      });
      if (gradesResponse.ok) {
        const json = await gradesResponse.json();
        const levels = json.data?.levels || json.data || [];
        setGrades(
          levels.map((g: any) => ({
            gradeId: g.grade_id || g.gradeId || g.id,
            name: g.name || g.label,
          }))
          .filter((grade: GradeOption) => Boolean(grade.gradeId))
        );
      }

      // Fetch classes
      const classesResponse = await fetch('/api/settings/classes', {
        credentials: 'include',
      });
      if (classesResponse.ok) {
        const json = await classesResponse.json();
        setClasses(
          (json.data || []).map((c: any) => ({
            classId: c.class_id || c.classId,
            name: c.name,
            gradeName: c.grade?.name || c.gradeName || '',
            gradeId: c.grade?.grade_id || c.grade_id || c.gradeId || '',
          }))
        );
      }

      // Fetch terms
      const termsResponse = await fetch('/api/settings/terms', {
        credentials: 'include',
      });
      if (termsResponse.ok) {
        const json = await termsResponse.json();
        setTerms(
          (json.data || []).map((t: any) => ({
            termId: t.term_id || t.termId || t.id,
            name: t.name,
          }))
        );
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
    success('Refreshed', 'Fee structures have been updated.');
  };

  const handleCreateNew = () => {
    setSelectedStructure(null);
    setFormMode('create');
    setShowFormModal(true);
  };

  const handleEdit = (structure: FeeStructure) => {
    setSelectedStructure(structure);
    setFormMode('edit');
    setShowFormModal(true);
  };

  const handleDuplicate = (structure: FeeStructure) => {
    setSelectedStructure(structure);
    setFormMode('duplicate');
    setShowFormModal(true);
  };

  const handleAssign = (structure: FeeStructure) => {
    setAssignStructure(structure);
    setShowAssignModal(true);
  };

  const handleViewAssignments = (structure: FeeStructure) => {
    router.push(`/finance/fee-structures/${structure.id}/assignments`);
  };

  const handleDeleteClick = (structure: FeeStructure) => {
    setDeleteStructure(structure);
    setShowDeleteConfirm(true);
  };

  const handleFormSubmit = async (data: FeeStructureFormData) => {
    setIsSubmitting(true);

    try {
      const url = formMode === 'edit' && selectedStructure
        ? `/api/fees/${selectedStructure.id}`
        : '/api/fees';
      
      const method = formMode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: data.name,
          description: data.description || null,
          amount: data.amount,
          gradeId: data.gradeId || null,
          termId: data.termId || null,
          isMandatory: data.isMandatory,
          isActive: data.isActive,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save fee structure');
      }

      success(formMode === 'edit' ? 'Fee Structure Updated' : 'Fee Structure Created', `${data.name} has been ${formMode === 'edit' ? 'updated' : 'created'} successfully.`);

      setShowFormModal(false);
      setSelectedStructure(null);
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toastError('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignSubmit = async (data: BulkAssignFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/student-fees/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to assign fee');
      }

      const result = await response.json();

      success('Fee Assigned', `Fee has been assigned to ${result.data?.assignedCount || 0} students.`);

      setShowAssignModal(false);
      setAssignStructure(null);
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toastError('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteStructure) {return;}

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/fees/${deleteStructure.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete fee structure');
      }

      success('Fee Structure Deleted', `${deleteStructure.name} has been deleted.`);

      setShowDeleteConfirm(false);
      setDeleteStructure(null);
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toastError('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Filtering ─────────────────────────────────────────────
  const filteredStructures = feeStructures.filter((structure) => {
    const matchesSearch =
      !searchTerm ||
      structure.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      structure.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesGrade = !filterGrade || structure.gradeId === filterGrade;

    const matchesStatus =
      !filterStatus ||
      (filterStatus === 'active' && structure.isActive) ||
      (filterStatus === 'inactive' && !structure.isActive) ||
      (filterStatus === 'mandatory' && structure.isMandatory);

    return matchesSearch && matchesGrade && matchesStatus;
  });

  // ─── Statistics ────────────────────────────────────────────
  const stats = {
    total: feeStructures.length,
    active: feeStructures.filter((f) => f.isActive).length,
    totalExpected: feeStructures.reduce((sum, f) => sum + f.totalExpected, 0),
    totalCollected: feeStructures.reduce((sum, f) => sum + f.totalCollected, 0),
  };

  // ─── Permission Check ──────────────────────────────────────
  if (!user) {
    return null;
  }

  // ─── Loading State ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading fee structures...</p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <PageHeader
        title="Fee Structures"
        description="Manage fee types, amounts, and assignments"
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
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
          {canManageFees && (
            <Button variant="primary" size="sm" onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create Fee
            </Button>
          )}
        </div>
      </PageHeader>

      {/* ── Error Alert ─────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive" title="Error">
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Fees</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
                <FileText className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Fees</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
              <div className="rounded-xl bg-green-100 p-3 text-green-600">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Expected</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalExpected)}
                </p>
              </div>
              <div className="rounded-xl bg-amber-100 p-3 text-amber-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Collected</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.totalCollected)}
                </p>
              </div>
              <div className="rounded-xl bg-green-100 p-3 text-green-600">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search fee structures..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-40"
              >
                <option value="">All Grades</option>
                {grades.map((grade) => (
                  <option key={grade.gradeId} value={grade.gradeId}>
                    {grade.name}
                  </option>
                ))}
              </Select>

              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-40"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="mandatory">Mandatory</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Fee Structure Cards ─────────────────────────────── */}
      {filteredStructures.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStructures.map((structure) => (
            <FeeStructureCard
              key={structure.id}
              structure={structure}
              onEdit={() => handleEdit(structure)}
              onDelete={() => handleDeleteClick(structure)}
              onDuplicate={() => handleDuplicate(structure)}
              onAssign={() => handleAssign(structure)}
              onViewAssignments={() => handleViewAssignments(structure)}
              canEdit={canManageFees}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              {searchTerm || filterGrade || filterStatus
                ? 'No Fee Structures Found'
                : 'No Fee Structures Yet'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || filterGrade || filterStatus
                ? 'Try adjusting your filters.'
                : 'Create your first fee structure to start collecting payments.'}
            </p>
            {canManageFees && !searchTerm && !filterGrade && !filterStatus && (
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={handleCreateNew}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Fee Structure
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Form Modal ──────────────────────────────────────── */}
      <FeeStructureFormModal
        open={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedStructure(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={
          selectedStructure
            ? {
                name: selectedStructure.name,
                description: selectedStructure.description || '',
                amount: selectedStructure.amount,
                gradeId: selectedStructure.gradeId || '',
                termId: selectedStructure.termId || '',
                isMandatory: selectedStructure.isMandatory,
                isActive: selectedStructure.isActive,
              }
            : undefined
        }
        grades={grades}
        terms={terms}
        isSubmitting={isSubmitting}
        mode={formMode}
      />

      {/* ── Bulk Assign Modal ───────────────────────────────── */}
      <BulkAssignModal
        open={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setAssignStructure(null);
        }}
        onSubmit={handleAssignSubmit}
        feeStructure={assignStructure}
        grades={grades}
        classes={classes}
        isSubmitting={isSubmitting}
      />

      {/* ── Delete Confirmation ─────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteStructure(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Fee Structure"
        description={`Are you sure you want to delete "${deleteStructure?.name}"? This will not affect existing student fee records or payments.`}
        confirmLabel="Delete"
        variant="danger"
        loading={isSubmitting}
      />
    </div>
  );
}
