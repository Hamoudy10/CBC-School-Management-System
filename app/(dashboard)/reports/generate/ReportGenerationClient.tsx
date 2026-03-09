// app/(dashboard)/reports/generate/ReportGenerationClient.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Spinner,
  Input,
} from '@/components/ui';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { FileText, ChevronLeft, AlertCircle, CheckCircle, Users } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface Props {
  schoolId: string;
  roleName: string;
  activeYear: { academic_year_id: string; year: string } | null;
  terms: Array<{ term_id: string; name: string; is_active: boolean }>;
  activeTermId: string | null;
  classes: Array<{ class_id: string; name: string; grade_name: string }>;
  learningAreas: Array<{
    learning_area_id: string;
    name: string;
    code: string;
  }>;
}

interface StudentPreview {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  has_existing_report: boolean;
  assessment_count: number;
}

type GenerationStatus = 'idle' | 'previewing' | 'generating' | 'completed' | 'error';

export default function ReportGenerationClient({
  schoolId,
  roleName,
  activeYear,
  terms,
  activeTermId,
  classes,
  learningAreas,
}: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [selectedTermId, setSelectedTermId] = useState(activeTermId ?? '');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  const [students, setStudents] = useState<StudentPreview[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [generationResult, setGenerationResult] = useState<{
    generated: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const [isPreviewing, startPreviewTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();

  if (!activeYear) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Generate Report Cards"
          description="Bulk generate CBC report cards"
          icon={<FileText className="h-6 w-6" />}
        >
          <Button variant="ghost" onClick={() => router.push('/reports')}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Reports
          </Button>
        </PageHeader>
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          No active academic year found. Please configure the academic calendar
          before generating reports.
        </Alert>
      </div>
    );
  }

  const handlePreview = () => {
    if (!selectedTermId || !selectedClassId) {
      setErrorMessage('Please select both a term and a class');
      return;
    }

    setErrorMessage('');
    startPreviewTransition(async () => {
      try {
        setStatus('previewing');

        // Fetch students in the selected class
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('student_id, first_name, last_name, admission_number')
          .eq('school_id', schoolId)
          .eq('current_class_id', selectedClassId)
          .eq('status', 'active')
          .order('last_name')
          .order('first_name');

        if (studentsError) throw new Error(studentsError.message);

        const studentList = studentsData ?? [];

        if (studentList.length === 0) {
          setStudents([]);
          setStatus('idle');
          setErrorMessage('No active students found in this class');
          return;
        }

        const studentIds = studentList.map((s) => (s as any).student_id);

        // Check existing report cards
        const { data: existingReports } = await supabase
          .from('report_cards')
          .select('student_id')
          .eq('school_id', schoolId)
          .eq('term_id', selectedTermId)
          .in('student_id', studentIds);

        const existingReportStudentIds = new Set(
          (existingReports ?? []).map((r) => (r as any).student_id)
        );

        // Check assessment counts per student
        const { data: assessmentCounts } = await supabase
          .from('assessments')
          .select('student_id')
          .eq('school_id', schoolId)
          .eq('term_id', selectedTermId)
          .in('student_id', studentIds);

        const assessmentCountMap = new Map<string, number>();
        for (const a of assessmentCounts ?? []) {
          assessmentCountMap.set(
            (a as any).student_id,
            (assessmentCountMap.get((a as any).student_id) ?? 0) + 1
          );
        }

        const previewStudents: StudentPreview[] = studentList.map((s: any) => ({
          student_id: s.student_id,
          first_name: s.first_name,
          last_name: s.last_name,
          admission_number: s.admission_number,
          has_existing_report: existingReportStudentIds.has(s.student_id),
          assessment_count: assessmentCountMap.get(s.student_id) ?? 0,
        }));

        setStudents(previewStudents);

        // Auto-select students without existing reports (or all if overwrite is on)
        const autoSelected = new Set(
          previewStudents
            .filter((s) => !s.has_existing_report || overwriteExisting)
            .filter((s) => s.assessment_count > 0)
            .map((s) => s.student_id)
        );
        setSelectedStudentIds(autoSelected);

        setStatus('idle');
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to load preview'
        );
        setStatus('error');
      }
    });
  };

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const eligible = students
      .filter((s) => s.assessment_count > 0)
      .filter((s) => !s.has_existing_report || overwriteExisting);
    setSelectedStudentIds(new Set(eligible.map((s) => s.student_id)));
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  const handleGenerate = () => {
    if (selectedStudentIds.size === 0) {
      setErrorMessage('Please select at least one student');
      return;
    }

    setErrorMessage('');
    startGenerateTransition(async () => {
      try {
        setStatus('generating');

        let generated = 0;
        let skipped = 0;
        let failed = 0;

        const selectedStudents = students.filter((s) =>
          selectedStudentIds.has(s.student_id)
        );

        for (const student of selectedStudents) {
          try {
            // If overwrite is off and report exists, skip
            if (student.has_existing_report && !overwriteExisting) {
              skipped++;
              continue;
            }

            // Fetch assessment aggregates for this student
            const { data: aggregates } = await supabase
              .from('assessment_aggregates')
              .select(
                `
                *,
                learning_areas ( name, code )
              `
              )
              .eq('student_id', student.student_id)
              .eq('school_id', schoolId)
              .eq('term_id', selectedTermId);

            if (!aggregates || aggregates.length === 0) {
              skipped++;
              continue;
            }

            // Compute overall average score
            const totalScore = aggregates.reduce(
              (sum, a) => sum + ((a as any).average_score ?? 0),
              0
            );
            const overallScore =
              aggregates.length > 0 ? totalScore / aggregates.length : 0;

            // Determine performance level
            let performanceLevel: string;
            if (overallScore >= 3.5) {
              performanceLevel = 'exceeding';
            } else if (overallScore >= 2.5) {
              performanceLevel = 'meeting';
            } else if (overallScore >= 1.5) {
              performanceLevel = 'approaching';
            } else {
              performanceLevel = 'below';
            }

            // Build analytics JSON
            const analyticsJson = {
              learning_area_scores: aggregates.map((a) => ({
                learning_area: ((a as any).learning_areas as Record<string, string>)?.name ?? 'Unknown',
                code: ((a as any).learning_areas as Record<string, string>)?.code ?? '',
                average_score: (a as any).average_score,
                competencies_assessed: (a as any).competencies_assessed ?? 0,
              })),
              overall_score: Math.round(overallScore * 100) / 100,
              performance_level: performanceLevel,
              generated_at: new Date().toISOString(),
            };

            // If overwriting, delete existing report first
            if (student.has_existing_report && overwriteExisting) {
              await supabase
                .from('report_cards')
                .delete()
                .eq('student_id', student.student_id)
                .eq('school_id', schoolId)
                .eq('term_id', selectedTermId);
            }

            // Insert report card
            const { error: insertError } = await supabase
              .from('report_cards')
              .insert({
                school_id: schoolId,
                student_id: student.student_id,
                class_id: selectedClassId,
                term_id: selectedTermId,
                academic_year_id: activeYear.academic_year_id,
                overall_score: Math.round(overallScore * 100) / 100,
                performance_level: performanceLevel,
                analytics_json: analyticsJson,
                status: 'draft',
                generated_at: new Date().toISOString(),
              } as any);

            if (insertError) {
              console.error(
                `Failed to generate report for ${student.student_id}:`,
                insertError.message
              );
              failed++;
            } else {
              generated++;
            }
          } catch {
            failed++;
          }
        }

        setGenerationResult({ generated, skipped, failed });
        setStatus('completed');
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Report generation failed'
        );
        setStatus('error');
      }
    });
  };

  const selectedClassName =
    classes.find((c) => c.class_id === selectedClassId)?.name ?? '';
  const selectedTermName =
    terms.find((t) => t.term_id === selectedTermId)?.name ?? '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generate Report Cards"
        description={`${activeYear.year} — Bulk generate CBC report cards`}
        icon={<FileText className="h-6 w-6" />}
      >
        <Button variant="ghost" onClick={() => router.push('/reports')}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
      </PageHeader>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          {errorMessage}
        </Alert>
      )}

      {/* Step 1: Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Select Term & Class</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Term <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedTermId}
                onChange={(e) => {
                  setSelectedTermId(e.target.value);
                  setStudents([]);
                  setSelectedStudentIds(new Set());
                  setGenerationResult(null);
                  setStatus('idle');
                }}
              >
                <option value="">Select term</option>
                {terms.map((t) => (
                  <option key={t.term_id} value={t.term_id}>
                    {t.name} {t.is_active ? '(Current)' : ''}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Class <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setStudents([]);
                  setSelectedStudentIds(new Set());
                  setGenerationResult(null);
                  setStatus('idle');
                }}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.name} ({c.grade_name})
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Overwrite existing reports
                </span>
              </label>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button
            variant="secondary"
            onClick={handlePreview}
            loading={isPreviewing}
            disabled={!selectedTermId || !selectedClassId || isPreviewing}
          >
            <Users className="mr-2 h-4 w-4" />
            Preview Students
          </Button>
        </CardFooter>
      </Card>

      {/* Step 2: Student Preview & Selection */}
      {students.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Step 2: Select Students ({selectedStudentIds.size} of{' '}
                {students.length} selected)
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  Select All Eligible
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={
                          selectedStudentIds.size > 0 &&
                          selectedStudentIds.size ===
                            students.filter(
                              (s) =>
                                s.assessment_count > 0 &&
                                (!s.has_existing_report || overwriteExisting)
                            ).length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleSelectAll();
                          } else {
                            handleDeselectAll();
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Assessments</TableHead>
                    <TableHead>Existing Report</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => {
                    const noAssessments = student.assessment_count === 0;
                    const hasReport = student.has_existing_report;
                    const isDisabled =
                      noAssessments || (hasReport && !overwriteExisting);

                    return (
                      <TableRow
                        key={student.student_id}
                        className={cn(isDisabled && 'opacity-50')}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.has(student.student_id)}
                            disabled={isDisabled}
                            onChange={() =>
                              handleToggleStudent(student.student_id)
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {student.admission_number}
                        </TableCell>
                        <TableCell className="font-medium">
                          {student.last_name}, {student.first_name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              student.assessment_count > 0
                                ? 'success'
                                : 'error'
                            }
                          >
                            {student.assessment_count} assessments
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {hasReport ? (
                            <Badge variant="warning">Exists</Badge>
                          ) : (
                            <Badge variant="default">None</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {noAssessments ? (
                            <span className="text-sm text-red-600">
                              No assessments — cannot generate
                            </span>
                          ) : hasReport && !overwriteExisting ? (
                            <span className="text-sm text-amber-600">
                              Report exists — enable overwrite
                            </span>
                          ) : (
                            <span className="text-sm text-green-600">
                              Ready to generate
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <p className="text-sm text-gray-500">
              Generating for: <strong>{selectedClassName}</strong> —{' '}
              <strong>{selectedTermName}</strong> —{' '}
              <strong>{activeYear.year}</strong>
            </p>
            <Button
              variant="primary"
              onClick={handleGenerate}
              loading={isGenerating}
              disabled={
                selectedStudentIds.size === 0 ||
                isGenerating ||
                status === 'completed'
              }
            >
              <FileText className="mr-2 h-4 w-4" />
              Generate {selectedStudentIds.size} Report
              {selectedStudentIds.size !== 1 ? 's' : ''}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Generation Results */}
      {status === 'generating' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Spinner size="lg" />
            <p className="mt-4 text-lg font-medium text-gray-700">
              Generating report cards...
            </p>
            <p className="text-sm text-gray-500">
              This may take a moment for large classes.
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'completed' && generationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Generation Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-3xl font-bold text-green-700">
                  {generationResult.generated}
                </p>
                <p className="text-sm text-green-600">Generated</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4 text-center">
                <p className="text-3xl font-bold text-amber-700">
                  {generationResult.skipped}
                </p>
                <p className="text-sm text-amber-600">Skipped</p>
              </div>
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <p className="text-3xl font-bold text-red-700">
                  {generationResult.failed}
                </p>
                <p className="text-sm text-red-600">Failed</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setStatus('idle');
                setGenerationResult(null);
                setStudents([]);
                setSelectedStudentIds(new Set());
              }}
            >
              Generate More
            </Button>
            <Button
              variant="primary"
              onClick={() => router.push('/reports')}
            >
              View Reports
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}