// app/(dashboard)/staff/[id]/assignments/new/components/SubjectAssignmentForm.tsx
// ============================================================
// Subject Assignment Form - Client Component
// Form for assigning learning areas to a teacher
// Supports single and bulk assignment modes
// ============================================================

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BookOpen,
  GraduationCap,
  Calendar,
  AlertCircle,
  Loader2,
  Save,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Layers,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

// ============================================================
// Types
// ============================================================
interface LearningArea {
  learning_area_id: string;
  name: string;
  is_core: boolean;
}

interface ClassItem {
  class_id: string;
  name: string;
  stream: string | null;
  is_active: boolean;
  grades: {
    grade_id: string;
    name: string;
    level_order: number;
  };
}

interface AcademicYear {
  academic_year_id: string;
  year: string;
  is_active: boolean;
}

interface Term {
  term_id: string;
  name: string;
  is_active: boolean;
  academic_year_id: string;
}

interface ExistingAssignment {
  id: string;
  learning_area_id: string;
  class_id: string;
  academic_year_id: string;
  term_id: string;
}

interface SubjectAssignmentFormProps {
  staffId: string;
  learningAreas: LearningArea[];
  classes: ClassItem[];
  academicYears: AcademicYear[];
  terms: Term[];
  existingAssignments: ExistingAssignment[];
}

// ============================================================
// Form Schema
// ============================================================
const singleAssignmentSchema = z.object({
  learningAreaId: z.string().uuid('Please select a learning area'),
  classId: z.string().uuid('Please select a class'),
  academicYearId: z.string().uuid('Please select an academic year'),
  termId: z.string().uuid('Please select a term'),
});

const bulkAssignmentSchema = z.object({
  assignments: z
    .array(singleAssignmentSchema)
    .min(1, 'Add at least one assignment')
    .max(20, 'Maximum 20 assignments at once'),
});

type SingleAssignmentData = z.infer<typeof singleAssignmentSchema>;
type BulkAssignmentData = z.infer<typeof bulkAssignmentSchema>;

// ============================================================
// Result Types
// ============================================================
interface AssignmentResult {
  success: boolean;
  assignmentId?: string;
  error?: string;
  input: SingleAssignmentData;
}

// ============================================================
// Main Component
// ============================================================
export function SubjectAssignmentForm({
  staffId,
  learningAreas,
  classes,
  academicYears,
  terms,
  existingAssignments,
}: SubjectAssignmentFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AssignmentResult[] | null>(null);

  // Get active academic year and term
  const activeYear = academicYears.find((y) => y.is_active);
  const activeTerm = terms.find((t) => t.is_active);

  // Single assignment form
  const singleForm = useForm<SingleAssignmentData>({
    resolver: zodResolver(singleAssignmentSchema),
    defaultValues: {
      learningAreaId: '',
      classId: '',
      academicYearId: activeYear?.academic_year_id || '',
      termId: activeTerm?.term_id || '',
    },
  });

  // Bulk assignment form
  const bulkForm = useForm<BulkAssignmentData>({
    resolver: zodResolver(bulkAssignmentSchema),
    defaultValues: {
      assignments: [
        {
          learningAreaId: '',
          classId: '',
          academicYearId: activeYear?.academic_year_id || '',
          termId: activeTerm?.term_id || '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: bulkForm.control,
    name: 'assignments',
  });

  // Watch selected academic year to filter terms
  const selectedYearId = singleForm.watch('academicYearId');
  const filteredTerms = useMemo(() => {
    if (!selectedYearId) return terms;
    return terms.filter((t) => t.academic_year_id === selectedYearId);
  }, [selectedYearId, terms]);

  // Group classes by grade for better organization
  const groupedClasses = useMemo(() => {
    const groups: Record<string, ClassItem[]> = {};
    classes.forEach((cls) => {
      const gradeName = cls.grades?.name || 'Other';
      if (!groups[gradeName]) {
        groups[gradeName] = [];
      }
      groups[gradeName].push(cls);
    });
    return groups;
  }, [classes]);

  // Check if assignment already exists
  const isAssignmentDuplicate = (
    learningAreaId: string,
    classId: string,
    academicYearId: string,
    termId: string
  ) => {
    return existingAssignments.some(
      (a) =>
        a.learning_area_id === learningAreaId &&
        a.class_id === classId &&
        a.academic_year_id === academicYearId &&
        a.term_id === termId
    );
  };

  // Handle single assignment submit
  const onSingleSubmit = async (data: SingleAssignmentData) => {
    // Check for duplicate
    if (
      isAssignmentDuplicate(
        data.learningAreaId,
        data.classId,
        data.academicYearId,
        data.termId
      )
    ) {
      setError('This assignment already exists.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch(`/api/staff/${staffId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create assignment');
      }

      // Show success and redirect
      setResults([{ success: true, assignmentId: result.data?.assignmentId, input: data }]);

      setTimeout(() => {
        router.push(`/staff/${staffId}?tab=assignments`);
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle bulk assignment submit
  const onBulkSubmit = async (data: BulkAssignmentData) => {
    // Check for duplicates
    const duplicates = data.assignments.filter((a) =>
      isAssignmentDuplicate(a.learningAreaId, a.classId, a.academicYearId, a.termId)
    );

    if (duplicates.length > 0) {
      setError(`${duplicates.length} assignment(s) already exist and will be skipped.`);
    }

    setIsSubmitting(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch(`/api/staff/${staffId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: data.assignments }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create assignments');
      }

      // Set results for display
      setResults(result.data?.results || []);

      // If all succeeded, redirect after delay
      if (result.data?.totalFailed === 0) {
        setTimeout(() => {
          router.push(`/staff/${staffId}?tab=assignments`);
          router.refresh();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get display name for IDs
  const getLearningAreaName = (id: string) =>
    learningAreas.find((l) => l.learning_area_id === id)?.name || 'Unknown';
  const getClassName = (id: string) =>
    classes.find((c) => c.class_id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`
            px-4 py-2 text-sm font-medium rounded-md transition-colors
            ${
              mode === 'single'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }
          `}
        >
          Single Assignment
        </button>
        <button
          type="button"
          onClick={() => setMode('bulk')}
          className={`
            px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2
            ${
              mode === 'bulk'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }
          `}
        >
          <Layers className="h-4 w-4" />
          Bulk Assignment
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </Alert>
      )}

      {/* Results Display */}
      {results && results.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Assignment Results
          </h4>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className={`
                  flex items-center justify-between p-3 rounded-lg
                  ${
                    result.success
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {getLearningAreaName(result.input.learningAreaId)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {getClassName(result.input.classId)}
                    </p>
                  </div>
                </div>
                <Badge variant={result.success ? 'success' : 'error'} size="sm">
                  {result.success ? 'Created' : 'Failed'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Single Assignment Form */}
      {mode === 'single' && (
        <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Learning Area */}
            <div className="sm:col-span-2">
              <Select
                label="Learning Area"
                icon={<BookOpen className="h-4 w-4" />}
                error={singleForm.formState.errors.learningAreaId?.message}
                required
                {...singleForm.register('learningAreaId')}
              >
                <option value="">Select learning area</option>
                <optgroup label="Core Subjects">
                  {learningAreas
                    .filter((l) => l.is_core)
                    .map((area) => (
                      <option key={area.learning_area_id} value={area.learning_area_id}>
                        {area.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Optional Subjects">
                  {learningAreas
                    .filter((l) => !l.is_core)
                    .map((area) => (
                      <option key={area.learning_area_id} value={area.learning_area_id}>
                        {area.name}
                      </option>
                    ))}
                </optgroup>
              </Select>
            </div>

            {/* Class */}
            <div className="sm:col-span-2">
              <Select
                label="Class"
                icon={<GraduationCap className="h-4 w-4" />}
                error={singleForm.formState.errors.classId?.message}
                required
                {...singleForm.register('classId')}
              >
                <option value="">Select class</option>
                {Object.entries(groupedClasses).map(([gradeName, gradeClasses]) => (
                  <optgroup key={gradeName} label={gradeName}>
                    {gradeClasses.map((cls) => (
                      <option key={cls.class_id} value={cls.class_id}>
                        {cls.name}
                        {cls.stream ? ` (${cls.stream})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>

            {/* Academic Year */}
            <Select
              label="Academic Year"
              icon={<Calendar className="h-4 w-4" />}
              error={singleForm.formState.errors.academicYearId?.message}
              required
              {...singleForm.register('academicYearId')}
            >
              <option value="">Select year</option>
              {academicYears.map((year) => (
                <option key={year.academic_year_id} value={year.academic_year_id}>
                  {year.year}
                  {year.is_active ? ' (Current)' : ''}
                </option>
              ))}
            </Select>

            {/* Term */}
            <Select
              label="Term"
              icon={<Calendar className="h-4 w-4" />}
              error={singleForm.formState.errors.termId?.message}
              required
              {...singleForm.register('termId')}
            >
              <option value="">Select term</option>
              {filteredTerms.map((term) => (
                <option key={term.term_id} value={term.term_id}>
                  {term.name}
                  {term.is_active ? ' (Current)' : ''}
                </option>
              ))}
            </Select>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Assignment
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Bulk Assignment Form */}
      {mode === 'bulk' && (
        <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-6">
          {/* Assignment Rows */}
          <div className="space-y-4">
            {fields.map((field: any, index: number) => {
              const watchedYearId = bulkForm.watch(`assignments.${index}.academicYearId`);
              const rowFilteredTerms = watchedYearId
                ? terms.filter((t) => t.academic_year_id === watchedYearId)
                : terms;

              return (
                <Card
                  key={field.id}
                  className="p-4 border-l-4 border-l-blue-500 dark:border-l-blue-400"
                >
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="primary" size="sm">
                      Assignment {index + 1}
                    </Badge>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Learning Area */}
                    <Select
                      label="Learning Area"
                      error={
                        bulkForm.formState.errors.assignments?.[index]?.learningAreaId
                          ?.message
                      }
                      required
                      {...bulkForm.register(`assignments.${index}.learningAreaId`)}
                    >
                      <option value="">Select subject</option>
                      {learningAreas.map((area) => (
                        <option key={area.learning_area_id} value={area.learning_area_id}>
                          {area.name}
                        </option>
                      ))}
                    </Select>

                    {/* Class */}
                    <Select
                      label="Class"
                      error={
                        bulkForm.formState.errors.assignments?.[index]?.classId?.message
                      }
                      required
                      {...bulkForm.register(`assignments.${index}.classId`)}
                    >
                      <option value="">Select class</option>
                      {classes.map((cls) => (
                        <option key={cls.class_id} value={cls.class_id}>
                          {cls.name}
                        </option>
                      ))}
                    </Select>

                    {/* Academic Year */}
                    <Select
                      label="Year"
                      error={
                        bulkForm.formState.errors.assignments?.[index]?.academicYearId
                          ?.message
                      }
                      required
                      {...bulkForm.register(`assignments.${index}.academicYearId`)}
                    >
                      <option value="">Select year</option>
                      {academicYears.map((year) => (
                        <option key={year.academic_year_id} value={year.academic_year_id}>
                          {year.year}
                        </option>
                      ))}
                    </Select>

                    {/* Term */}
                    <Select
                      label="Term"
                      error={
                        bulkForm.formState.errors.assignments?.[index]?.termId?.message
                      }
                      required
                      {...bulkForm.register(`assignments.${index}.termId`)}
                    >
                      <option value="">Select term</option>
                      {rowFilteredTerms.map((term) => (
                        <option key={term.term_id} value={term.term_id}>
                          {term.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Add More Button */}
          {fields.length < 20 && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({
                  learningAreaId: '',
                  classId: '',
                  academicYearId: activeYear?.academic_year_id || '',
                  termId: activeTerm?.term_id || '',
                })
              }
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Assignment
            </Button>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {fields.length} assignment{fields.length !== 1 ? 's' : ''} to create
            </p>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating {fields.length} Assignment{fields.length !== 1 ? 's' : ''}...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create {fields.length} Assignment{fields.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}