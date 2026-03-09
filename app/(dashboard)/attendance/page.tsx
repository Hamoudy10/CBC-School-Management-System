// app/(dashboard)/attendance/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Users,
  UserCheck,
  UserX,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Save,
  Filter,
  Search,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Loader2,
  Check,
  X,
  Minus,
  FileText,
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
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Tabs, TabsList, TabTrigger, TabContent } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────
type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

interface StudentAttendance {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  photoUrl: string | null;
  status: AttendanceStatus | null;
  reason: string | null;
  arrivalTime: string | null;
  recordId: string | null;
}

interface ClassOption {
  classId: string;
  name: string;
  gradeName: string;
  studentCount: number;
}

interface AttendanceStats {
  date: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

interface ClassAttendanceSummary {
  classId: string;
  className: string;
  gradeName: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
  recorded: boolean;
}

interface WeeklyTrend {
  date: string;
  dayName: string;
  rate: number;
  present: number;
  total: number;
}

// ─── Constants ───────────────────────────────────────────────
const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  present: {
    label: 'Present',
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'text-green-700',
    bgColor: 'bg-green-100 hover:bg-green-200 border-green-300',
  },
  absent: {
    label: 'Absent',
    icon: <XCircle className="h-4 w-4" />,
    color: 'text-red-700',
    bgColor: 'bg-red-100 hover:bg-red-200 border-red-300',
  },
  late: {
    label: 'Late',
    icon: <Clock className="h-4 w-4" />,
    color: 'text-amber-700',
    bgColor: 'bg-amber-100 hover:bg-amber-200 border-amber-300',
  },
  excused: {
    label: 'Excused',
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-100 hover:bg-blue-200 border-blue-300',
  },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Helper Functions ────────────────────────────────────────
function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeekDates(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + 1); // Monday

  const dates: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

// ─── Stat Card Component ─────────────────────────────────────
interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'red';
  trend?: { value: number; isPositive: boolean };
}

const statColorConfig = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600' },
  green: { bg: 'bg-green-50', icon: 'bg-green-100 text-green-600' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600' },
  red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600' },
};

function StatCard({ title, value, subtitle, icon, color, trend }: StatCardProps) {
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
            {trend && (
              <div className="mt-1 flex items-center gap-1">
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.value}% vs last week
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

// ─── Attendance Rate Ring ────────────────────────────────────
function AttendanceRateRing({ rate, size = 120 }: { rate: number; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (rate / 100) * circumference;

  const color =
    rate >= 90 ? '#10b981' : rate >= 75 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">
          {rate.toFixed(0)}%
        </span>
        <span className="text-xs text-gray-500">Attendance</span>
      </div>
    </div>
  );
}

// ─── Quick Status Button ─────────────────────────────────────
interface QuickStatusButtonProps {
  status: AttendanceStatus;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function QuickStatusButton({
  status,
  isSelected,
  onClick,
  disabled,
}: QuickStatusButtonProps) {
  const config = STATUS_CONFIG[status];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
        isSelected
          ? `${config.bgColor} ${config.color} border-current`
          : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:bg-gray-50',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      title={config.label}
    >
      {config.icon}
    </button>
  );
}

// ─── Roll Call Grid Component ────────────────────────────────
interface RollCallGridProps {
  students: StudentAttendance[];
  onStatusChange: (studentId: string, status: AttendanceStatus, reason?: string) => void;
  onBulkStatus: (status: AttendanceStatus) => void;
  isSubmitting: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

function RollCallGrid({
  students,
  onStatusChange,
  onBulkStatus,
  isSubmitting,
  searchTerm,
  onSearchChange,
}: RollCallGridProps) {
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentAttendance | null>(null);
  const [reason, setReason] = useState('');

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const term = searchTerm.toLowerCase();
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(term) ||
        s.admissionNumber.toLowerCase().includes(term)
    );
  }, [students, searchTerm]);

  const handleStatusClick = (student: StudentAttendance, status: AttendanceStatus) => {
    if (status === 'absent' || status === 'excused') {
      setSelectedStudent(student);
      setReason('');
      setShowReasonModal(true);
    } else {
      onStatusChange(student.studentId, status);
    }
  };

  const handleReasonSubmit = () => {
    if (selectedStudent) {
      onStatusChange(
        selectedStudent.studentId,
        selectedStudent.status === 'excused' ? 'excused' : 'absent',
        reason
      );
    }
    setShowReasonModal(false);
    setSelectedStudent(null);
    setReason('');
  };

  const stats = useMemo(() => {
    const present = students.filter((s) => s.status === 'present').length;
    const absent = students.filter((s) => s.status === 'absent').length;
    const late = students.filter((s) => s.status === 'late').length;
    const excused = students.filter((s) => s.status === 'excused').length;
    const unmarked = students.filter((s) => !s.status).length;

    return { present, absent, late, excused, unmarked, total: students.length };
  }, [students]);

  return (
    <div className="space-y-4">
      {/* Header with Search and Quick Actions */}
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

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Mark all:</span>
          {(['present', 'absent', 'late'] as AttendanceStatus[]).map((status) => (
            <Button
              key={status}
              variant="secondary"
              size="sm"
              onClick={() => onBulkStatus(status)}
              disabled={isSubmitting}
              className={cn(
                'gap-1',
                STATUS_CONFIG[status].color
              )}
            >
              {STATUS_CONFIG[status].icon}
              {STATUS_CONFIG[status].label}
            </Button>
          ))}
        </div>
      </div>

      {/* Live Stats */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-gray-50 p-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span className="text-sm">
            Present: <strong>{stats.present}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-sm">
            Absent: <strong>{stats.absent}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-500" />
          <span className="text-sm">
            Late: <strong>{stats.late}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="text-sm">
            Excused: <strong>{stats.excused}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-gray-300" />
          <span className="text-sm">
            Unmarked: <strong>{stats.unmarked}</strong>
          </span>
        </div>
      </div>

      {/* Student Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredStudents.map((student) => (
          <div
            key={student.studentId}
            className={cn(
              'flex items-center gap-3 rounded-lg border-2 p-3 transition-all',
              student.status
                ? STATUS_CONFIG[student.status].bgColor.replace('hover:', '')
                : 'border-gray-200 bg-white'
            )}
          >
            {/* Avatar */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.fullName}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium">
                  {student.fullName.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {student.fullName}
              </p>
              <p className="truncate text-xs text-gray-500">
                {student.admissionNumber}
              </p>
            </div>

            {/* Status Buttons */}
            <div className="flex items-center gap-1">
              {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map(
                (status) => (
                  <QuickStatusButton
                    key={status}
                    status={status}
                    isSelected={student.status === status}
                    onClick={() => handleStatusClick(student, status)}
                    disabled={isSubmitting}
                  />
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">
            {searchTerm ? 'No students match your search.' : 'No students in this class.'}
          </p>
        </div>
      )}

      {/* Reason Modal */}
      <Modal
        open={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        size="sm"
      >
        <ModalHeader>
          <ModalTitle>
            {`${selectedStudent?.status === 'excused' ? 'Excused' : 'Absent'} Reason`}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Optionally provide a reason for{' '}
              <strong>{selectedStudent?.fullName}</strong>&apos;s absence.
            </p>
            <Input
              placeholder="Enter reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowReasonModal(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleReasonSubmit}>
              Save
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// ─── Class Summary Card ──────────────────────────────────────
function ClassSummaryCard({
  summary,
  isSelected,
  onClick,
}: {
  summary: ClassAttendanceSummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border-2 p-4 text-left transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-900">{summary.className}</p>
          <p className="text-sm text-gray-500">{summary.gradeName}</p>
        </div>
        {summary.recorded ? (
          <Badge variant="success">Recorded</Badge>
        ) : (
          <Badge variant="warning">Pending</Badge>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1 text-sm">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-gray-600">{summary.present}</span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-gray-600">{summary.absent}</span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-gray-600">{summary.late}</span>
        </div>
        <div className="ml-auto text-right">
          <span
            className={cn(
              'text-lg font-bold',
              summary.rate >= 90
                ? 'text-green-600'
                : summary.rate >= 75
                  ? 'text-amber-600'
                  : 'text-red-600'
            )}
          >
            {summary.rate.toFixed(0)}%
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Weekly Trend Chart ──────────────────────────────────────
function WeeklyTrendChart({ data }: { data: WeeklyTrend[] }) {
  const maxRate = Math.max(...data.map((d) => d.rate), 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">This Week&apos;s Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2 h-32">
          {data.map((day, idx) => (
            <div
              key={idx}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <span className="text-xs font-medium text-gray-900">
                {day.rate > 0 ? `${day.rate.toFixed(0)}%` : '-'}
              </span>
              <div
                className={cn(
                  'w-full rounded-t transition-all',
                  day.rate >= 90
                    ? 'bg-green-500'
                    : day.rate >= 75
                      ? 'bg-amber-500'
                      : day.rate > 0
                        ? 'bg-red-500'
                        : 'bg-gray-200'
                )}
                style={{
                  height: `${(day.rate / maxRate) * 100}%`,
                  minHeight: day.rate > 0 ? '8px' : '4px',
                }}
              />
              <span className="text-xs text-gray-500">{day.dayName}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page Component ─────────────────────────────────────
export default function AttendancePage() {
  const router = useRouter();
  const { user, checkPermission } = useAuth();
  const { success, error } = useToast();

  // ─── State ─────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [classSummaries, setClassSummaries] = useState<ClassAttendanceSummary[]>([]);
  const [todayStats, setTodayStats] = useState<AttendanceStats | null>(null);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('roll-call');

  // ─── Permissions ───────────────────────────────────────────
  const canRecordAttendance = checkPermission('attendance', 'create');
  const canViewAllClasses = checkPermission('attendance', 'view');

  // ─── Date Navigation ───────────────────────────────────────
  const isToday = formatDateForAPI(selectedDate) === formatDateForAPI(new Date());
  const isFuture = selectedDate > new Date();

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    // Skip weekends
    while (newDate.getDay() === 0 || newDate.getDay() === 6) {
      newDate.setDate(newDate.getDate() - 1);
    }
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    // Skip weekends
    while (newDate.getDay() === 0 || newDate.getDay() === 6) {
      newDate.setDate(newDate.getDate() + 1);
    }
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // ─── Fetch Data ────────────────────────────────────────────
  const fetchClasses = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/classes?hasStudents=true', {
        credentials: 'include',
      });

      if (response.ok) {
        const json = await response.json();
        const classOptions = (json.data || []).map((c: any) => ({
          classId: c.class_id || c.classId,
          name: c.name,
          gradeName: c.grade?.name || c.gradeName || '',
          studentCount: c.studentCount || c.student_count || 0,
        }));

        setClasses(classOptions);

        // Auto-select first class if teacher
        if (classOptions.length > 0 && !selectedClassId) {
          setSelectedClassId(classOptions[0].classId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch classes:', err);
    }
  }, [selectedClassId]);

  const fetchTodayStats = useCallback(async () => {
    try {
      const dateStr = formatDateForAPI(selectedDate);
      const response = await fetch(`/api/attendance/school?date=${dateStr}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const json = await response.json();
        setTodayStats(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [selectedDate]);

  const fetchClassSummaries = useCallback(async () => {
    try {
      const dateStr = formatDateForAPI(selectedDate);
      const response = await fetch(
        `/api/attendance/summary/all-classes?date=${dateStr}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const json = await response.json();
        setClassSummaries(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch class summaries:', err);
    }
  }, [selectedDate]);

  const fetchWeeklyTrend = useCallback(async () => {
    try {
      const weekDates = getWeekDates(selectedDate);
      const trends: WeeklyTrend[] = [];

      for (const date of weekDates) {
        const dateStr = formatDateForAPI(date);
        const response = await fetch(`/api/attendance/school?date=${dateStr}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const json = await response.json();
          trends.push({
            date: dateStr,
            dayName: DAY_NAMES[date.getDay()],
            rate: json.data?.attendanceRate || 0,
            present: json.data?.present || 0,
            total: json.data?.totalStudents || 0,
          });
        } else {
          trends.push({
            date: dateStr,
            dayName: DAY_NAMES[date.getDay()],
            rate: 0,
            present: 0,
            total: 0,
          });
        }
      }

      setWeeklyTrend(trends);
    } catch (err) {
      console.error('Failed to fetch weekly trend:', err);
    }
  }, [selectedDate]);

  const fetchStudents = useCallback(async () => {
    if (!selectedClassId) return;

    setIsLoadingStudents(true);
    try {
      const dateStr = formatDateForAPI(selectedDate);
      const response = await fetch(
        `/api/attendance/class/${selectedClassId}?date=${dateStr}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const json = await response.json();
        setStudents(
          (json.data || []).map((s: any) => ({
            studentId: s.student_id || s.studentId,
            fullName: s.full_name || s.fullName || `${s.first_name} ${s.last_name}`,
            admissionNumber: s.admission_number || s.admissionNumber,
            photoUrl: s.photo_url || s.photoUrl,
            status: s.status || null,
            reason: s.reason || null,
            arrivalTime: s.arrival_time || s.arrivalTime || null,
            recordId: s.record_id || s.recordId || s.id || null,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);
      error('Error', 'Failed to load student attendance.');
    } finally {
      setIsLoadingStudents(false);
    }
  }, [selectedClassId, selectedDate]);

  // ─── Effects ───────────────────────────────────────────────
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchClasses(),
        fetchTodayStats(),
        fetchClassSummaries(),
        fetchWeeklyTrend(),
      ]);
      setIsLoading(false);
    };

    loadInitialData();
  }, [fetchClasses, fetchTodayStats, fetchClassSummaries, fetchWeeklyTrend]);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudents();
    }
  }, [selectedClassId, selectedDate, fetchStudents]);

  useEffect(() => {
    // Refresh stats when date changes
    fetchTodayStats();
    fetchClassSummaries();
  }, [selectedDate, fetchTodayStats, fetchClassSummaries]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleStatusChange = (
    studentId: string,
    status: AttendanceStatus,
    reason?: string
  ) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, status, reason: reason || null }
          : s
      )
    );
    setHasChanges(true);
  };

  const handleBulkStatus = (status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => ({ ...s, status, reason: null }))
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedClassId || students.length === 0) return;

    setIsSaving(true);
    try {
      const dateStr = formatDateForAPI(selectedDate);
      const attendanceData = students
        .filter((s) => s.status)
        .map((s) => ({
          studentId: s.studentId,
          status: s.status,
          reason: s.reason,
          date: dateStr,
        }));

      const response = await fetch('/api/attendance/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          classId: selectedClassId,
          date: dateStr,
          attendance: attendanceData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save attendance');
      }

      success('Attendance Saved', `Attendance for ${students.length} students has been recorded.`);

      setHasChanges(false);

      // Refresh stats
      await Promise.all([fetchTodayStats(), fetchClassSummaries()]);
    } catch (err) {
      error('Error', 'Failed to save attendance. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const dateStr = formatDateForAPI(selectedDate);
      const response = await fetch(
        `/api/attendance/export?date=${dateStr}&classId=${selectedClassId || ''}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      success('Export Complete', 'Attendance report has been downloaded.');
    } catch (err) {
      error('Export Failed', 'Failed to export attendance data.');
    }
  };

  // ─── Render ────────────────────────────────────────────────
  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading attendance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <PageHeader
        title="Attendance"
        description="Record and manage daily student attendance"
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {canRecordAttendance && hasChanges && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Attendance
            </Button>
          )}
        </div>
      </PageHeader>

      {/* ── Date Selector ───────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousDay}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-900">
                  {formatDate(selectedDate.toISOString())}
                </span>
                {isToday && (
                  <Badge variant="primary" className="ml-2">
                    Today
                  </Badge>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextDay}
                disabled={isFuture || isToday}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {!isToday && (
                <Button variant="secondary" size="sm" onClick={goToToday}>
                  Go to Today
                </Button>
              )}
            </div>

            {/* Class Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Class:</label>
              <Select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setHasChanges(false);
                }}
                className="w-48"
              >
                <option value="">Select class</option>
                {classes.map((cls) => (
                  <option key={cls.classId} value={cls.classId}>
                    {cls.name} ({cls.studentCount})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats Cards ─────────────────────────────────────── */}
      {todayStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Students"
            value={todayStats.totalStudents}
            icon={<Users className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            title="Present"
            value={todayStats.present}
            subtitle={`${((todayStats.present / todayStats.totalStudents) * 100 || 0).toFixed(0)}%`}
            icon={<UserCheck className="h-5 w-5" />}
            color="green"
          />
          <StatCard
            title="Absent"
            value={todayStats.absent}
            icon={<UserX className="h-5 w-5" />}
            color="red"
          />
          <StatCard
            title="Late"
            value={todayStats.late}
            icon={<Clock className="h-5 w-5" />}
            color="amber"
          />
          <Card>
            <CardContent className="flex items-center justify-center p-4">
              <AttendanceRateRing rate={todayStats.attendanceRate} size={100} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabTrigger value="roll-call">Roll Call</TabTrigger>
          <TabTrigger value="overview">Class Overview</TabTrigger>
          <TabTrigger value="trends">Trends</TabTrigger>
        </TabsList>

        {/* ── Roll Call Tab ───────────────────────────────── */}
        <TabContent value="roll-call" className="mt-6">
          {selectedClassId ? (
            isLoadingStudents ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {classes.find((c) => c.classId === selectedClassId)?.name} -{' '}
                    {students.length} Students
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RollCallGrid
                    students={students}
                    onStatusChange={handleStatusChange}
                    onBulkStatus={handleBulkStatus}
                    isSubmitting={isSaving}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                  />
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  Select a Class
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Choose a class from the dropdown above to record attendance.
                </p>
              </CardContent>
            </Card>
          )}
        </TabContent>

        {/* ── Overview Tab ────────────────────────────────── */}
        <TabContent value="overview" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classSummaries.map((summary) => (
              <ClassSummaryCard
                key={summary.classId}
                summary={summary}
                isSelected={selectedClassId === summary.classId}
                onClick={() => {
                  setSelectedClassId(summary.classId);
                  setActiveTab('roll-call');
                }}
              />
            ))}
          </div>

          {classSummaries.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  No Data Yet
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Attendance data will appear here once recorded.
                </p>
              </CardContent>
            </Card>
          )}
        </TabContent>

        {/* ── Trends Tab ──────────────────────────────────── */}
        <TabContent value="trends" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <WeeklyTrendChart data={weeklyTrend} />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <span className="text-sm text-gray-600">
                    Week Average Attendance
                  </span>
                  <span className="font-bold text-gray-900">
                    {weeklyTrend.length > 0
                      ? (
                          weeklyTrend.reduce((sum, d) => sum + d.rate, 0) /
                          weeklyTrend.filter((d) => d.rate > 0).length || 0
                        ).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <span className="text-sm text-gray-600">
                    Classes with 100% Attendance
                  </span>
                  <span className="font-bold text-green-600">
                    {classSummaries.filter((c) => c.rate === 100).length}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <span className="text-sm text-gray-600">
                    Classes Below 80%
                  </span>
                  <span className="font-bold text-red-600">
                    {classSummaries.filter((c) => c.rate < 80 && c.rate > 0).length}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <span className="text-sm text-gray-600">
                    Pending Roll Call
                  </span>
                  <span className="font-bold text-amber-600">
                    {classSummaries.filter((c) => !c.recorded).length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabContent>
      </Tabs>

      {/* ── Unsaved Changes Warning ─────────────────────────── */}
      {hasChanges && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform">
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 shadow-lg ring-1 ring-amber-200">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              You have unsaved changes
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
