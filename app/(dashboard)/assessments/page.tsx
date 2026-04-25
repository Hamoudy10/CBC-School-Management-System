// app/(dashboard)/assessments/page.tsx
'use client';

import React, {
  Suspense,
  lazy,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useDeferredValue,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  BookOpen,
  Users,
  Search,
  Filter,
  RefreshCw,
  Save,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Award,
  Target,
  Layers,
  GraduationCap,
  Calendar,
  Info,
  X,
  Check,
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
import { Tabs, TabsList, TabTrigger, TabContent } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { useReferenceData } from '@/hooks/useReferenceData';

const RemarksModal = lazy(() => import('./components/RemarksModal'));

// ─── Types ───────────────────────────────────────────────────
type PerformanceLevel = 1 | 2 | 3 | 4;
type PerformanceLevelName = 'below_expectation' | 'approaching' | 'meeting' | 'exceeding';

interface ClassOption {
  classId: string;
  name: string;
  gradeName: string;
  studentCount: number;
}

interface LearningArea {
  learningAreaId: string;
  name: string;
  isCore: boolean;
}

interface Strand {
  strandId: string;
  name: string;
  learningAreaId: string;
}

interface SubStrand {
  subStrandId: string;
  name: string;
  strandId: string;
}

interface Competency {
  competencyId: string;
  name: string;
  description: string | null;
  subStrandId: string;
}

interface StudentAssessment {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  photoUrl: string | null;
  score: PerformanceLevel | null;
  remarks: string | null;
  assessmentId: string | null;
  lastUpdated: string | null;
}

interface AssessmentStats {
  totalStudents: number;
  assessed: number;
  pending: number;
  averageScore: number;
  distribution: {
    exceeding: number;
    meeting: number;
    approaching: number;
    below_expectation: number;
  };
}

interface CBCHierarchy {
  learningAreas: LearningArea[];
  strands: Strand[];
  subStrands: SubStrand[];
  competencies: Competency[];
}

interface AssessmentOverviewRow {
  assessmentId: string;
  studentId: string;
  studentName: string;
  studentAdmissionNo: string;
  learningAreaId: string;
  learningAreaName: string;
  competencyId: string;
  competencyName: string;
  score: PerformanceLevel | null;
  levelLabel: PerformanceLevelName | null;
  remarks: string | null;
  assessmentDate: string;
  termName: string;
  academicYear: string;
}

// ─── Constants ───────────────────────────────────────────────
const PERFORMANCE_LEVELS: {
  value: PerformanceLevel;
  name: PerformanceLevelName;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  description: string;
}[] = [
  {
    value: 4,
    name: 'exceeding',
    label: 'Exceeding Expectation',
    shortLabel: 'EE',
    color: 'text-green-700',
    bgColor: 'bg-green-100 hover:bg-green-200 border-green-400',
    description: 'Demonstrates exceptional understanding and skill',
  },
  {
    value: 3,
    name: 'meeting',
    label: 'Meeting Expectation',
    shortLabel: 'ME',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100 hover:bg-blue-200 border-blue-400',
    description: 'Demonstrates required understanding and skill',
  },
  {
    value: 2,
    name: 'approaching',
    label: 'Approaching Expectation',
    shortLabel: 'AE',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100 hover:bg-amber-200 border-amber-400',
    description: 'Shows progress towards required level',
  },
  {
    value: 1,
    name: 'below_expectation',
    label: 'Below Expectation',
    shortLabel: 'BE',
    color: 'text-red-700',
    bgColor: 'bg-red-100 hover:bg-red-200 border-red-400',
    description: 'Needs additional support and intervention',
  },
];

// ─── Helper Functions ────────────────────────────────────────
function getLevelConfig(score: PerformanceLevel | null) {
  if (!score) {return null;}
  return PERFORMANCE_LEVELS.find((l) => l.value === score);
}

function getLevelConfigByName(name: string | null | undefined) {
  if (!name) {return null;}
  return PERFORMANCE_LEVELS.find((l) => l.name === name);
}

function getLevelColor(score: number | null): string {
  if (!score) {return 'text-gray-400';}
  if (score >= 3.5) {return 'text-green-600';}
  if (score >= 2.5) {return 'text-blue-600';}
  if (score >= 1.5) {return 'text-amber-600';}
  return 'text-red-600';
}

function formatDisplayDate(value: string): string {
  if (!value) {return '-';}
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {return value;}
  return date.toLocaleDateString();
}

function toPerformanceLevelScore(score: unknown): PerformanceLevel | null {
  const numeric = Number(score);
  if (numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4) {
    return numeric as PerformanceLevel;
  }
  return null;
}

function normalizeOverviewRow(raw: any): AssessmentOverviewRow {
  return {
    assessmentId: raw.assessmentId ?? raw.assessment_id ?? '',
    studentId: raw.studentId ?? raw.student_id ?? '',
    studentName: raw.studentName ?? raw.student_name ?? 'Unknown Student',
    studentAdmissionNo: raw.studentAdmissionNo ?? raw.student_admission_no ?? '',
    learningAreaId: raw.learningAreaId ?? raw.learning_area_id ?? '',
    learningAreaName: raw.learningAreaName ?? raw.learning_area_name ?? 'Unknown Learning Area',
    competencyId: raw.competencyId ?? raw.competency_id ?? '',
    competencyName: raw.competencyName ?? raw.competency_name ?? 'Unknown Competency',
    score: toPerformanceLevelScore(raw.score),
    levelLabel: (raw.levelLabel ?? raw.level_label ?? null) as PerformanceLevelName | null,
    remarks: raw.remarks ?? null,
    assessmentDate: raw.assessmentDate ?? raw.assessment_date ?? '',
    termName: raw.termName ?? raw.term_name ?? '',
    academicYear: String(raw.academicYear ?? raw.academic_year ?? ''),
  };
}

// ─── Stat Card Component ─────────────────────────────────────
interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

const statColorConfig = {
  blue: { icon: 'bg-blue-100 text-blue-600' },
  green: { icon: 'bg-green-100 text-green-600' },
  amber: { icon: 'bg-amber-100 text-amber-600' },
  red: { icon: 'bg-red-100 text-red-600' },
  purple: { icon: 'bg-purple-100 text-purple-600' },
};

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  const colors = statColorConfig[color];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
          <div className={cn('rounded-xl p-2.5', colors.icon)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Performance Distribution Chart ──────────────────────────
function PerformanceDistribution({
  distribution,
  total,
}: {
  distribution: AssessmentStats['distribution'];
  total: number;
}) {
  const levels = [
    { key: 'exceeding', label: 'EE', count: distribution.exceeding, color: 'bg-green-500' },
    { key: 'meeting', label: 'ME', count: distribution.meeting, color: 'bg-blue-500' },
    { key: 'approaching', label: 'AE', count: distribution.approaching, color: 'bg-amber-500' },
    { key: 'below_expectation', label: 'BE', count: distribution.below_expectation, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-3">
      {levels.map((level) => (
        <div key={level.key} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">{level.label}</span>
            <span className="text-gray-500">
              {level.count} ({total > 0 ? ((level.count / total) * 100).toFixed(0) : 0}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn('h-full rounded-full transition-all duration-500', level.color)}
              style={{ width: `${total > 0 ? (level.count / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Score Button Component ──────────────────────────────────
interface ScoreButtonProps {
  level: (typeof PERFORMANCE_LEVELS)[number];
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

function ScoreButton({ level, isSelected, onClick, disabled, size = 'md' }: ScoreButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${level.label}: ${level.description}`}
      className={cn(
        'flex items-center justify-center rounded-lg border-2 font-bold transition-all',
        size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm',
        isSelected
          ? `${level.bgColor} ${level.color} border-current shadow-sm`
          : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:bg-gray-50',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {level.value}
    </button>
  );
}

// ─── Hierarchy Selector Component ────────────────────────────
interface HierarchySelectorProps {
  hierarchy: CBCHierarchy;
  selectedLearningAreaId: string;
  selectedStrandId: string;
  selectedSubStrandId: string;
  selectedCompetencyId: string;
  onLearningAreaChange: (id: string) => void;
  onStrandChange: (id: string) => void;
  onSubStrandChange: (id: string) => void;
  onCompetencyChange: (id: string) => void;
  isLoading: boolean;
}

function HierarchySelector({
  hierarchy,
  selectedLearningAreaId,
  selectedStrandId,
  selectedSubStrandId,
  selectedCompetencyId,
  onLearningAreaChange,
  onStrandChange,
  onSubStrandChange,
  onCompetencyChange,
  isLoading,
}: HierarchySelectorProps) {
  const filteredStrands = hierarchy.strands.filter(
    (s) => s.learningAreaId === selectedLearningAreaId
  );

  const filteredSubStrands = hierarchy.subStrands.filter(
    (s) => s.strandId === selectedStrandId
  );

  const filteredCompetencies = hierarchy.competencies.filter(
    (c) => c.subStrandId === selectedSubStrandId
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-5 w-5" />
          CBC Curriculum Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Learning Area */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            Learning Area *
          </label>
          <Select
            value={selectedLearningAreaId}
            onChange={(e) => onLearningAreaChange(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Select learning area</option>
            {hierarchy.learningAreas.map((la) => (
              <option key={la.learningAreaId} value={la.learningAreaId}>
                {la.name} {la.isCore && '(Core)'}
              </option>
            ))}
          </Select>
        </div>

        {/* Strand */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Strand *</label>
          <Select
            value={selectedStrandId}
            onChange={(e) => onStrandChange(e.target.value)}
            disabled={isLoading || !selectedLearningAreaId}
          >
            <option value="">
              {selectedLearningAreaId ? 'Select strand' : 'Select learning area first'}
            </option>
            {filteredStrands.map((s) => (
              <option key={s.strandId} value={s.strandId}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Sub-Strand */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            Sub-Strand *
          </label>
          <Select
            value={selectedSubStrandId}
            onChange={(e) => onSubStrandChange(e.target.value)}
            disabled={isLoading || !selectedStrandId}
          >
            <option value="">
              {selectedStrandId ? 'Select sub-strand' : 'Select strand first'}
            </option>
            {filteredSubStrands.map((s) => (
              <option key={s.subStrandId} value={s.subStrandId}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Competency */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            Competency *
          </label>
          <Select
            value={selectedCompetencyId}
            onChange={(e) => onCompetencyChange(e.target.value)}
            disabled={isLoading || !selectedSubStrandId}
          >
            <option value="">
              {selectedSubStrandId ? 'Select competency' : 'Select sub-strand first'}
            </option>
            {filteredCompetencies.map((c) => (
              <option key={c.competencyId} value={c.competencyId}>
                {c.name}
              </option>
            ))}
          </Select>
          {selectedCompetencyId && (
            <p className="text-xs text-gray-500">
              {filteredCompetencies.find((c) => c.competencyId === selectedCompetencyId)?.description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Score Entry Grid Component ──────────────────────────────
interface ScoreEntryGridProps {
  students: StudentAssessment[];
  onScoreChange: (studentId: string, score: PerformanceLevel, remarks?: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSubmitting: boolean;
}

function ScoreEntryGrid({
  students,
  onScoreChange,
  searchTerm,
  onSearchChange,
  isSubmitting,
}: ScoreEntryGridProps) {
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentAssessment | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredStudents = useMemo(() => {
    if (!deferredSearchTerm) {return students;}
    const term = deferredSearchTerm.toLowerCase();
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(term) ||
        s.admissionNumber.toLowerCase().includes(term)
    );
  }, [students, deferredSearchTerm]);

  const handleRemarkClick = (student: StudentAssessment) => {
    setSelectedStudent(student);
    setRemarkText(student.remarks || '');
    setShowRemarkModal(true);
  };

  const handleRemarkSave = () => {
    if (selectedStudent && selectedStudent.score) {
      onScoreChange(selectedStudent.studentId, selectedStudent.score, remarkText);
    }
    setShowRemarkModal(false);
    setSelectedStudent(null);
  };

  // Calculate live stats
  const stats = useMemo(() => {
    const assessed = students.filter((s) => s.score !== null).length;
    const scores = students.filter((s) => s.score !== null).map((s) => s.score!);
    const average = scores.length > 0
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length
      : 0;

    return {
      total: students.length,
      assessed,
      pending: students.length - assessed,
      average,
    };
  }, [students]);

  return (
    <div className="space-y-4">
      {/* Search and Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>
              Assessed: <strong>{stats.assessed}/{stats.total}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span>
              Pending: <strong>{stats.pending}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <span>
              Avg: <strong className={getLevelColor(stats.average)}>{stats.average.toFixed(1)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-gray-50 p-3">
        <span className="text-sm font-medium text-gray-700">Levels:</span>
        {PERFORMANCE_LEVELS.map((level) => (
          <div
            key={level.value}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              level.bgColor.replace('hover:bg-', '').replace('-200', '-100'),
              level.color
            )}
          >
            <span className="font-bold">{level.value}</span>
            <span>= {level.shortLabel}</span>
          </div>
        ))}
      </div>

      {/* Student Grid */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Student
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Score (1-4)
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Level
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Remarks
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredStudents.map((student, idx) => {
              const levelConfig = getLevelConfig(student.score);

              return (
                <tr
                  key={student.studentId}
                  className={cn(
                    'transition-colors',
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                    student.score ? '' : 'bg-amber-50/30'
                  )}
                >
                  {/* Student Info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                        {student.photoUrl ? (
                          <img
                            src={student.photoUrl}
                            alt={student.fullName}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          student.fullName.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {student.fullName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {student.admissionNumber}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Score Buttons */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {PERFORMANCE_LEVELS.slice().reverse().map((level) => (
                        <ScoreButton
                          key={level.value}
                          level={level}
                          isSelected={student.score === level.value}
                          onClick={() => onScoreChange(student.studentId, level.value)}
                          disabled={isSubmitting}
                          size="sm"
                        />
                      ))}
                    </div>
                  </td>

                  {/* Level Badge */}
                  <td className="px-4 py-3 text-center">
                    {levelConfig ? (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                          levelConfig.bgColor.split(' ')[0],
                          levelConfig.color
                        )}
                      >
                        {levelConfig.shortLabel}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Remarks */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleRemarkClick(student)}
                      disabled={!student.score}
                      className={cn(
                        'rounded-lg p-1.5 transition-colors',
                        student.remarks
                          ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                          : student.score
                            ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                            : 'cursor-not-allowed text-gray-300'
                      )}
                      title={student.remarks || 'Add remarks'}
                    >
                      {student.remarks ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <ClipboardList className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredStudents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">
              {searchTerm
                ? 'No students match your search.'
                : 'No students found in this class.'}
            </p>
          </div>
        )}
      </div>

      {showRemarkModal ? (
        <Suspense fallback={null}>
          <RemarksModal
            open={showRemarkModal}
            studentName={selectedStudent?.fullName}
            value={remarkText}
            onChange={setRemarkText}
            onClose={() => setShowRemarkModal(false)}
            onSave={handleRemarkSave}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────
export default function AssessmentsPage() {
  const router = useRouter();
  const { user, loading, checkPermission } = useAuth();
  const { success, error } = useToast();

  // ─── State ─────────────────────────────────────────────────
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  const [hierarchy, setHierarchy] = useState<CBCHierarchy>({
    learningAreas: [],
    strands: [],
    subStrands: [],
    competencies: [],
  });
  const [selectedLearningAreaId, setSelectedLearningAreaId] = useState<string>('');
  const [selectedStrandId, setSelectedStrandId] = useState<string>('');
  const [selectedSubStrandId, setSelectedSubStrandId] = useState<string>('');
  const [selectedCompetencyId, setSelectedCompetencyId] = useState<string>('');

  const [students, setStudents] = useState<StudentAssessment[]>([]);
  const [stats, setStats] = useState<AssessmentStats | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [overviewRows, setOverviewRows] = useState<AssessmentOverviewRow[]>([]);
  const [overviewSearchTerm, setOverviewSearchTerm] = useState('');
  const [overviewLearningAreaFilter, setOverviewLearningAreaFilter] = useState('');
  const [overviewCompetencyFilter, setOverviewCompetencyFilter] = useState('');
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('entry');

  // ─── Permissions ───────────────────────────────────────────
  const canAssess =
    checkPermission('assessments', 'create') ||
    checkPermission('assessments', 'update');
  const canViewAssessments = checkPermission('assessments', 'view');
  const {
    classes: referenceClasses,
    activeYear,
    activeTerm,
    isLoading: isReferenceLoading,
  } = useReferenceData({ enabled: Boolean(user) });
  const classes = useMemo<ClassOption[]>(
    () =>
      referenceClasses.map((c) => ({
        classId: c.classId,
        name: c.name,
        gradeName: c.gradeName || '',
        studentCount: c.studentCount || 0,
      })),
    [referenceClasses],
  );
  const selectedClass = useMemo(
    () => classes.find((classOption) => classOption.classId === selectedClassId) ?? null,
    [classes, selectedClassId],
  );

  const deferredOverviewSearchTerm = useDeferredValue(overviewSearchTerm);

  const filteredOverviewRows = useMemo(() => {
    const search = deferredOverviewSearchTerm.trim().toLowerCase();

    return overviewRows.filter((row) => {
      const matchesLearningArea =
        !overviewLearningAreaFilter || row.learningAreaId === overviewLearningAreaFilter;
      const matchesCompetency =
        !overviewCompetencyFilter || row.competencyId === overviewCompetencyFilter;
      const matchesSearch =
        !search ||
        row.studentName.toLowerCase().includes(search) ||
        row.studentAdmissionNo.toLowerCase().includes(search) ||
        row.learningAreaName.toLowerCase().includes(search) ||
        row.competencyName.toLowerCase().includes(search) ||
        (row.remarks ?? '').toLowerCase().includes(search);

      return matchesLearningArea && matchesCompetency && matchesSearch;
    });
  }, [
    overviewRows,
    overviewLearningAreaFilter,
    overviewCompetencyFilter,
    deferredOverviewSearchTerm,
  ]);

  const overviewLearningAreaOptions = useMemo(() => {
    const optionMap = new Map<string, string>();
    for (const row of overviewRows) {
      if (row.learningAreaId) {
        optionMap.set(row.learningAreaId, row.learningAreaName);
      }
    }

    return Array.from(optionMap.entries())
      .map(([learningAreaId, name]) => ({ learningAreaId, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [overviewRows]);

  const overviewCompetencyOptions = useMemo(() => {
    const optionMap = new Map<string, string>();
    for (const row of overviewRows) {
      if (
        row.competencyId &&
        (!overviewLearningAreaFilter || row.learningAreaId === overviewLearningAreaFilter)
      ) {
        optionMap.set(row.competencyId, row.competencyName);
      }
    }

    return Array.from(optionMap.entries())
      .map(([competencyId, name]) => ({ competencyId, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [overviewRows, overviewLearningAreaFilter]);

  const overviewStats = useMemo(() => {
    const scoredRows = filteredOverviewRows.filter((row) => row.score !== null);
    const studentsAssessed = new Set(filteredOverviewRows.map((row) => row.studentId));
    const competenciesCovered = new Set(filteredOverviewRows.map((row) => row.competencyId));
    const totalScore = scoredRows.reduce((sum, row) => sum + Number(row.score ?? 0), 0);

    return {
      totalAssessments: filteredOverviewRows.length,
      studentsAssessed: studentsAssessed.size,
      competenciesCovered: competenciesCovered.size,
      averageScore: scoredRows.length > 0 ? totalScore / scoredRows.length : 0,
    };
  }, [filteredOverviewRows]);

  const availableTabs = useMemo(() => {
    const tabs: string[] = [];
    if (canAssess) {
      tabs.push('entry');
    }
    if (canViewAssessments) {
      tabs.push('overview');
    }
    return tabs;
  }, [canAssess, canViewAssessments]);

  // ─── Fetch Initial Data ────────────────────────────────────
  const fetchHierarchy = useCallback(async () => {
    try {
      const response = await fetch('/api/learning-areas?includeHierarchy=true', {
        credentials: 'include',
      });

      if (response.ok) {
        const json = await response.json();
        
        const learningAreas: LearningArea[] = [];
        const strands: Strand[] = [];
        const subStrands: SubStrand[] = [];
        const competencies: Competency[] = [];

        (json.data || []).forEach((la: any) => {
          learningAreas.push({
            learningAreaId: la.learning_area_id || la.learningAreaId,
            name: la.name,
            isCore: la.is_core || la.isCore || false,
          });

          (la.strands || []).forEach((s: any) => {
            strands.push({
              strandId: s.strand_id || s.strandId,
              name: s.name,
              learningAreaId: la.learning_area_id || la.learningAreaId,
            });

            (s.sub_strands || s.subStrands || []).forEach((ss: any) => {
              subStrands.push({
                subStrandId: ss.sub_strand_id || ss.subStrandId,
                name: ss.name,
                strandId: s.strand_id || s.strandId,
              });

              (ss.competencies || []).forEach((c: any) => {
                competencies.push({
                  competencyId: c.competency_id || c.competencyId,
                  name: c.name,
                  description: c.description,
                  subStrandId: ss.sub_strand_id || ss.subStrandId,
                });
              });
            });
          });
        });

        setHierarchy({ learningAreas, strands, subStrands, competencies });
      }
    } catch (err) {
      console.error('Failed to fetch hierarchy:', err);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    if (!selectedClassId || !selectedCompetencyId) {return;}

    setIsLoadingStudents(true);
    try {
      const params = new URLSearchParams({
        classId: selectedClassId,
        competencyId: selectedCompetencyId,
      });

      if (activeYear?.id) {
        params.set('academicYearId', activeYear.id);
      }

      if (activeTerm?.id) {
        params.set('termId', activeTerm.id);
      }

      const response = await fetch(
        `/api/assessments?${params.toString()}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const json = await response.json();
        setStudents(
          (json.data || []).map((s: any) => ({
            studentId: s.student_id ?? s.studentId,
            fullName: s.full_name ?? s.fullName ?? `${s.first_name} ${s.last_name}`,
            admissionNumber: s.admission_number ?? s.admissionNumber,
            photoUrl: s.photo_url ?? s.photoUrl,
            score: s.score ?? null,
            remarks: s.remarks ?? null,
            assessmentId: s.assessment_id ?? s.assessmentId ?? null,
            lastUpdated: s.updated_at ?? s.updatedAt ?? null,
          }))
        );
        
        // Calculate stats
        const assessed = (json.data || []).filter((s: any) => s.score);
        const scores = assessed.map((s: any) => s.score);
        const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
        
        setStats({
          totalStudents: json.data?.length || 0,
          assessed: assessed.length,
          pending: (json.data?.length || 0) - assessed.length,
          averageScore: avg,
          distribution: {
            exceeding: assessed.filter((s: any) => s.score === 4).length,
            meeting: assessed.filter((s: any) => s.score === 3).length,
            approaching: assessed.filter((s: any) => s.score === 2).length,
            below_expectation: assessed.filter((s: any) => s.score === 1).length,
          },
        });
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);
      error('Error', 'Failed to load student assessments.');
    } finally {
      setIsLoadingStudents(false);
    }
  }, [activeTerm?.id, activeYear?.id, selectedClassId, selectedCompetencyId, success, error]);

  const fetchOverviewRows = useCallback(async () => {
    if (!selectedClassId) {
      setOverviewRows([]);
      setOverviewError(null);
      return;
    }

    setIsOverviewLoading(true);
    setOverviewError(null);

    try {
      const allRows: AssessmentOverviewRow[] = [];
      let currentPage = 1;
      let totalPages = 1;

      do {
        const params = new URLSearchParams({
          classId: selectedClassId,
          page: String(currentPage),
          pageSize: '100',
        });

        if (activeYear?.id) {
          params.set('academicYearId', activeYear.id);
        }

        if (activeTerm?.id) {
          params.set('termId', activeTerm.id);
        }

        const response = await fetch(`/api/assessments?${params.toString()}`, {
          credentials: 'include',
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || 'Failed to load assessments overview.');
        }

        const pageRows = Array.isArray(payload?.data) ? payload.data : [];
        allRows.push(...pageRows.map(normalizeOverviewRow));

        totalPages = Number(payload?.meta?.totalPages ?? 1);
        currentPage += 1;
      } while (currentPage <= totalPages);

      setOverviewRows(
        allRows.sort((left, right) => {
          if (left.assessmentDate === right.assessmentDate) {
            return left.studentName.localeCompare(right.studentName);
          }
          return right.assessmentDate.localeCompare(left.assessmentDate);
        }),
      );
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load class overview assessments.';
      setOverviewError(message);
    } finally {
      setIsOverviewLoading(false);
    }
  }, [activeTerm?.id, activeYear?.id, selectedClassId]);

  // ─── Effects ───────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        return;
      }

      setIsLoading(true);
      await fetchHierarchy();
      setIsLoading(false);
    };

    loadData();
  }, [fetchHierarchy, user]);

  useEffect(() => {
    if (selectedClassId && selectedCompetencyId) {
      fetchStudents();
    }
  }, [selectedClassId, selectedCompetencyId, fetchStudents]);

  useEffect(() => {
    if (activeTab === 'overview' && selectedClassId) {
      fetchOverviewRows();
    }
  }, [activeTab, selectedClassId, fetchOverviewRows]);

  useEffect(() => {
    setOverviewLearningAreaFilter('');
    setOverviewCompetencyFilter('');
    setOverviewSearchTerm('');
  }, [selectedClassId]);

  // Reset cascading selections
  useEffect(() => {
    setSelectedStrandId('');
    setSelectedSubStrandId('');
    setSelectedCompetencyId('');
  }, [selectedLearningAreaId]);

  useEffect(() => {
    setSelectedSubStrandId('');
    setSelectedCompetencyId('');
  }, [selectedStrandId]);

  useEffect(() => {
    setSelectedCompetencyId('');
  }, [selectedSubStrandId]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? 'entry');
    }
  }, [availableTabs, activeTab]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleScoreChange = (
    studentId: string,
    score: PerformanceLevel,
    remarks?: string
  ) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, score, remarks: remarks !== undefined ? remarks : s.remarks }
          : s
      )
    );
    setHasChanges(true);
  };

  const handleSave = useCallback(async () => {
    if (!selectedClassId || !selectedCompetencyId || students.length === 0) {return;}
    if (!activeYear?.id || !activeTerm?.id) {
      error(
        'Academic Context Missing',
        'Set an active academic year and term before saving assessments.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const assessments = students
        .filter((s) => s.score !== null)
        .map((s) => ({
          studentId: s.studentId,
          score: s.score,
          remarks: s.remarks,
        }));

      const response = await fetch('/api/assessments/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          classId: selectedClassId,
          competencyId: selectedCompetencyId,
          learningAreaId: selectedLearningAreaId,
          academicYearId: activeYear.id,
          termId: activeTerm.id,
          assessments,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.details 
          ? JSON.stringify(payload.details) 
          : (payload?.error || payload?.message || payload?.data?.message || 'Failed to save assessments');
        throw new Error(message);
      }

      const serverMessage =
        payload?.data?.message ??
        `Saved ${assessments.length} assessments successfully.`;
      const failedCount = Number(payload?.data?.failed ?? 0);
      if (failedCount > 0) {
        error('Assessments Partially Saved', serverMessage);
      } else {
        success('Assessments Saved', serverMessage);
      }

      setHasChanges(false);
      fetchStudents(); // Refresh to get updated data
      if (activeTab === 'overview') {
        fetchOverviewRows();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save assessments. Please try again.';
      error('Error', message);
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, activeTerm?.id, activeYear?.id, error, fetchOverviewRows, fetchStudents, selectedClassId, selectedCompetencyId, selectedLearningAreaId, students, success]);

  // ─── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading assessments...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assessments" />
        <Alert variant="destructive">
          Your session has expired. Please sign in again.
        </Alert>
      </div>
    );
  }

  if (isLoading || isReferenceLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading assessments...</p>
        </div>
      </div>
    );
  }

  const isReadyToAssess =
    selectedClassId &&
    selectedLearningAreaId &&
    selectedStrandId &&
    selectedSubStrandId &&
    selectedCompetencyId;

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <PageHeader
        title="CBC Assessments"
        description="Record competency-based assessments for students"
      >
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="warning" className="mr-2">
              Unsaved changes
            </Badge>
          )}
          {canAssess && hasChanges && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Assessments
            </Button>
          )}
        </div>
      </PageHeader>

      {/* ── Selection Panel ─────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Class Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-5 w-5" />
              Select Class
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setHasChanges(false);
              }}
            >
              <option value="">Select a class</option>
              {classes.map((cls) => (
                <option key={cls.classId} value={cls.classId}>
                  {cls.name} ({cls.studentCount} students)
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>

        {/* CBC Hierarchy */}
        <div className="lg:col-span-2">
          <HierarchySelector
            hierarchy={hierarchy}
            selectedLearningAreaId={selectedLearningAreaId}
            selectedStrandId={selectedStrandId}
            selectedSubStrandId={selectedSubStrandId}
            selectedCompetencyId={selectedCompetencyId}
            onLearningAreaChange={setSelectedLearningAreaId}
            onStrandChange={setSelectedStrandId}
            onSubStrandChange={setSelectedSubStrandId}
            onCompetencyChange={setSelectedCompetencyId}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {availableTabs.includes('entry') && (
            <TabTrigger value="entry" disabled={!isReadyToAssess}>
              Score Entry
            </TabTrigger>
          )}
          {availableTabs.includes('overview') && (
            <TabTrigger value="overview" disabled={!selectedClassId}>
              Class Overview
            </TabTrigger>
          )}
        </TabsList>

        {/* ── Score Entry Tab ─────────────────────────────── */}
        {availableTabs.includes('entry') && (
          <TabContent value="entry" className="mt-6">
          {isReadyToAssess ? (
            isLoadingStudents ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-4">
                <div className="xl:col-span-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>
                          {hierarchy.competencies.find(
                            (c) => c.competencyId === selectedCompetencyId
                          )?.name}
                        </span>
                        <Badge variant="default">
                          {students.length} Students
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScoreEntryGrid
                        students={students}
                        onScoreChange={handleScoreChange}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        isSubmitting={isSaving}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Stats Sidebar */}
                {stats && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Progress</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-center">
                          <div className="relative inline-flex items-center justify-center">
                            <svg className="h-24 w-24 -rotate-90">
                              <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="#e5e7eb"
                                strokeWidth="8"
                                fill="none"
                              />
                              <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke={
                                  stats.assessed === stats.totalStudents
                                    ? '#10b981'
                                    : '#3b82f6'
                                }
                                strokeWidth="8"
                                fill="none"
                                strokeDasharray={2 * Math.PI * 40}
                                strokeDashoffset={
                                  2 * Math.PI * 40 -
                                  (stats.assessed / stats.totalStudents) *
                                    2 *
                                    Math.PI *
                                    40
                                }
                                strokeLinecap="round"
                                className="transition-all duration-500"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xl font-bold">
                                {stats.totalStudents > 0
                                  ? Math.round(
                                      (stats.assessed / stats.totalStudents) * 100
                                    )
                                  : 0}
                                %
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            {stats.assessed} of {stats.totalStudents} assessed
                          </p>
                        </div>

                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-xs text-gray-500">Class Average</p>
                          <p
                            className={cn(
                              'text-2xl font-bold',
                              getLevelColor(stats.averageScore)
                            )}
                          >
                            {stats.averageScore.toFixed(2)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <PerformanceDistribution
                          distribution={stats.distribution}
                          total={stats.assessed}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  Select Assessment Target
                </h3>
                <p className="mt-1 max-w-md text-center text-sm text-gray-500">
                  Choose a class and navigate through the CBC curriculum hierarchy
                  (Learning Area → Strand → Sub-Strand → Competency) to begin
                  recording assessments.
                </p>
              </CardContent>
            </Card>
          )}
          </TabContent>
        )}

        {/* ── Overview Tab ────────────────────────────────── */}
        {availableTabs.includes('overview') && (
          <TabContent value="overview" className="mt-6">
          {selectedClassId ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Total Assessments"
                  value={overviewStats.totalAssessments}
                  subtitle={selectedClass?.name ? `${selectedClass.name} class` : undefined}
                  icon={<ClipboardList className="h-5 w-5" />}
                  color="blue"
                />
                <StatCard
                  title="Students Assessed"
                  value={overviewStats.studentsAssessed}
                  subtitle="Unique students"
                  icon={<Users className="h-5 w-5" />}
                  color="green"
                />
                <StatCard
                  title="Competencies Covered"
                  value={overviewStats.competenciesCovered}
                  subtitle="Distinct competencies"
                  icon={<Target className="h-5 w-5" />}
                  color="amber"
                />
                <StatCard
                  title="Average Score"
                  value={overviewStats.averageScore.toFixed(2)}
                  subtitle={
                    activeTerm?.name && activeYear?.year
                      ? `${activeTerm.name} ${activeYear.year}`
                      : 'Current context'
                  }
                  icon={<BarChart3 className="h-5 w-5" />}
                  color="purple"
                />
              </div>

              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="relative md:col-span-2">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search by student, admission, learning area, competency, or remarks..."
                        value={overviewSearchTerm}
                        onChange={(event) => setOverviewSearchTerm(event.target.value)}
                        className="pl-10"
                      />
                    </div>

                    <Select
                      value={overviewLearningAreaFilter}
                      onChange={(event) => {
                        setOverviewLearningAreaFilter(event.target.value);
                        setOverviewCompetencyFilter('');
                      }}
                    >
                      <option value="">All learning areas</option>
                      {overviewLearningAreaOptions.map((option) => (
                        <option key={option.learningAreaId} value={option.learningAreaId}>
                          {option.name}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={overviewCompetencyFilter}
                      onChange={(event) => setOverviewCompetencyFilter(event.target.value)}
                    >
                      <option value="">All competencies</option>
                      {overviewCompetencyOptions.map((option) => (
                        <option key={option.competencyId} value={option.competencyId}>
                          {option.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-500">
                      Showing {filteredOverviewRows.length} of {overviewRows.length} saved assessments.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchOverviewRows}
                      loading={isOverviewLoading}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {isOverviewLoading ? (
                <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-12">
                  <Spinner size="lg" />
                </div>
              ) : overviewError ? (
                <Alert variant="destructive">
                  Failed to load class overview: {overviewError}
                </Alert>
              ) : filteredOverviewRows.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">All Saved Assessments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full min-w-[980px]">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Student
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Learning Area
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Competency
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                              Score
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                              Level
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Remarks
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {filteredOverviewRows.map((row, index) => {
                            const levelConfig =
                              getLevelConfigByName(row.levelLabel) ?? getLevelConfig(row.score);

                            return (
                              <tr
                                key={row.assessmentId || `${row.studentId}-${row.competencyId}-${index}`}
                                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                              >
                                <td className="px-4 py-3">
                                  <p className="text-sm font-medium text-gray-900">
                                    {row.studentName}
                                  </p>
                                  <p className="text-xs text-gray-500">{row.studentAdmissionNo}</p>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {row.learningAreaName}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {row.competencyName}
                                </td>
                                <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                                  {row.score ?? '-'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {levelConfig ? (
                                    <span
                                      className={cn(
                                        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                                        levelConfig.bgColor.split(' ')[0],
                                        levelConfig.color,
                                      )}
                                    >
                                      {levelConfig.shortLabel}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {formatDisplayDate(row.assessmentDate)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {row.remarks ? (
                                    <span title={row.remarks} className="line-clamp-2">
                                      {row.remarks}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">No remarks</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Info className="h-10 w-10 text-gray-300" />
                    <h3 className="mt-4 text-lg font-semibold text-gray-900">
                      No Assessments Found
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No saved assessments match your selected filters for this class.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  Select a Class
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Choose a class to view all saved assessments and progress overview.
                </p>
              </CardContent>
            </Card>
          )}
          </TabContent>
        )}
      </Tabs>

      {/* ── Unsaved Changes Warning ─────────────────────────── */}
      {hasChanges && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform">
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 shadow-lg ring-1 ring-amber-200">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              You have unsaved assessments
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={isSaving}
            >
              Save Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
