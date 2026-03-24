// app/(dashboard)/timetable/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  Copy,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  User,
  BookOpen,
  MapPin,
  AlertCircle,
  CheckCircle,
  X,
  Save,
  Filter,
  Download,
  Printer,
  Grid3X3,
  List,
  Users,
  Layers,
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
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/lib/auth/permissions';

// ─── Types ───────────────────────────────────────────────────
interface TimetableSlot {
  slotId: string;
  classId: string;
  className: string;
  gradeName: string;
  learningAreaId: string;
  learningAreaName: string;
  teacherId: string;
  teacherName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  isActive: boolean;
}

interface ClassOption {
  classId: string;
  name: string;
  gradeName: string;
}

interface TeacherOption {
  staffId: string;
  name: string;
  subjects: string[];
}

interface LearningAreaOption {
  learningAreaId: string;
  name: string;
}

interface WeeklyTimetable {
  monday: TimetableSlot[];
  tuesday: TimetableSlot[];
  wednesday: TimetableSlot[];
  thursday: TimetableSlot[];
  friday: TimetableSlot[];
}

interface TimeSlotConfig {
  startTime: string;
  endTime: string;
  label: string;
  isBreak: boolean;
}

interface ConflictInfo {
  type: 'teacher' | 'class' | 'room';
  message: string;
  slotId: string;
}

// ─── Validation Schema ───────────────────────────────────────
const lessonSchema = z.object({
  classId: z.string().min(1, 'Class is required'),
  learningAreaId: z.string().min(1, 'Learning area is required'),
  teacherId: z.string().min(1, 'Teacher is required'),
  dayOfWeek: z.number().min(1).max(5),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  room: z.string().optional(),
});

type LessonFormData = z.infer<typeof lessonSchema>;

// ─── Constants ───────────────────────────────────────────────
const DAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
];

const DEFAULT_TIME_SLOTS: TimeSlotConfig[] = [
  { startTime: '08:00', endTime: '08:40', label: 'Lesson 1', isBreak: false },
  { startTime: '08:40', endTime: '09:20', label: 'Lesson 2', isBreak: false },
  { startTime: '09:20', endTime: '09:40', label: 'Break', isBreak: true },
  { startTime: '09:40', endTime: '10:20', label: 'Lesson 3', isBreak: false },
  { startTime: '10:20', endTime: '11:00', label: 'Lesson 4', isBreak: false },
  { startTime: '11:00', endTime: '11:40', label: 'Lesson 5', isBreak: false },
  { startTime: '11:40', endTime: '12:20', label: 'Lesson 6', isBreak: false },
  { startTime: '12:20', endTime: '13:00', label: 'Lunch', isBreak: true },
  { startTime: '13:00', endTime: '13:40', label: 'Lesson 7', isBreak: false },
  { startTime: '13:40', endTime: '14:20', label: 'Lesson 8', isBreak: false },
  { startTime: '14:20', endTime: '15:00', label: 'Lesson 9', isBreak: false },
];

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: 'bg-blue-100 border-blue-300 text-blue-800',
  English: 'bg-green-100 border-green-300 text-green-800',
  Kiswahili: 'bg-amber-100 border-amber-300 text-amber-800',
  Science: 'bg-purple-100 border-purple-300 text-purple-800',
  'Social Studies': 'bg-pink-100 border-pink-300 text-pink-800',
  CRE: 'bg-indigo-100 border-indigo-300 text-indigo-800',
  IRE: 'bg-teal-100 border-teal-300 text-teal-800',
  'Creative Arts': 'bg-orange-100 border-orange-300 text-orange-800',
  Music: 'bg-rose-100 border-rose-300 text-rose-800',
  'Physical Education': 'bg-cyan-100 border-cyan-300 text-cyan-800',
  default: 'bg-gray-100 border-gray-300 text-gray-800',
};

// ─── Helper Functions ────────────────────────────────────────
function getSubjectColor(subjectName: string): string {
  return SUBJECT_COLORS[subjectName] || SUBJECT_COLORS.default;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function getSlotForTime(
  slots: TimetableSlot[],
  dayOfWeek: number,
  startTime: string
): TimetableSlot | undefined {
  return slots.find(
    (slot) => slot.dayOfWeek === dayOfWeek && slot.startTime === startTime
  );
}

// ─── Lesson Card Component ───────────────────────────────────
interface LessonCardProps {
  slot: TimetableSlot;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  compact?: boolean;
}

function LessonCard({
  slot,
  onClick,
  onEdit,
  onDelete,
  canEdit,
  compact = false,
}: LessonCardProps) {
  const [showActions, setShowActions] = useState(false);
  const colorClass = getSubjectColor(slot.learningAreaName);

  return (
    <div
      className={cn(
        'group relative rounded-lg border-2 p-2 transition-all cursor-pointer',
        colorClass,
        'hover:shadow-md'
      )}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex flex-col gap-0.5">
        <p className={cn('font-semibold truncate', compact ? 'text-xs' : 'text-sm')}>
          {slot.learningAreaName}
        </p>
        {!compact && (
          <>
            <p className="text-xs opacity-80 truncate">
              {slot.teacherName}
            </p>
            {slot.room && (
              <p className="text-xs opacity-70 truncate">
                <MapPin className="inline h-3 w-3 mr-0.5" />
                {slot.room}
              </p>
            )}
          </>
        )}
      </div>

      {/* Action Buttons */}
      {canEdit && showActions && (
        <div
          className="absolute -top-2 -right-2 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onEdit}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md hover:bg-blue-50"
          >
            <Edit className="h-3 w-3 text-blue-600" />
          </button>
          <button
            onClick={onDelete}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3 text-red-600" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Empty Slot Component ────────────────────────────────────
interface EmptySlotProps {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  onClick: () => void;
  canEdit: boolean;
}

function EmptySlot({ dayOfWeek, startTime, endTime, onClick, canEdit }: EmptySlotProps) {
  if (!canEdit) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-400">—</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-all hover:border-blue-400 hover:bg-blue-50"
    >
      <Plus className="h-4 w-4 text-gray-400" />
    </button>
  );
}

// ─── Break Slot Component ────────────────────────────────────
function BreakSlot({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg bg-gray-100">
      <span className="text-xs font-medium text-gray-500">{label}</span>
    </div>
  );
}

// ─── Timetable Grid Component ────────────────────────────────
interface TimetableGridProps {
  slots: TimetableSlot[];
  timeSlots: TimeSlotConfig[];
  onSlotClick: (slot: TimetableSlot) => void;
  onEmptyClick: (dayOfWeek: number, startTime: string, endTime: string) => void;
  onEditSlot: (slot: TimetableSlot) => void;
  onDeleteSlot: (slot: TimetableSlot) => void;
  canEdit: boolean;
}

function TimetableGrid({
  slots,
  timeSlots,
  onSlotClick,
  onEmptyClick,
  onEditSlot,
  onDeleteSlot,
  canEdit,
}: TimetableGridProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="grid grid-cols-[100px_repeat(5,1fr)] gap-2 mb-2">
          <div className="flex items-center justify-center rounded-lg bg-gray-100 p-2">
            <Clock className="h-4 w-4 text-gray-500" />
          </div>
          {DAYS.map((day) => (
            <div
              key={day.value}
              className="flex items-center justify-center rounded-lg bg-gray-100 p-2"
            >
              <span className="text-sm font-semibold text-gray-700">
                {day.label}
              </span>
            </div>
          ))}
        </div>

        {/* Time Slots */}
        {timeSlots.map((timeSlot) => (
          <div
            key={timeSlot.startTime}
            className={cn(
              'grid grid-cols-[100px_repeat(5,1fr)] gap-2 mb-2',
              timeSlot.isBreak && 'opacity-60'
            )}
          >
            {/* Time Label */}
            <div className="flex flex-col items-center justify-center rounded-lg bg-gray-50 p-2 text-center">
              <span className="text-xs font-medium text-gray-700">
                {formatTime(timeSlot.startTime)}
              </span>
              <span className="text-xs text-gray-400">
                {formatTime(timeSlot.endTime)}
              </span>
            </div>

            {/* Day Cells */}
            {DAYS.map((day) => {
              if (timeSlot.isBreak) {
                return (
                  <div key={`${day.value}-${timeSlot.startTime}`} className="h-16">
                    <BreakSlot label={timeSlot.label} />
                  </div>
                );
              }

              const slot = getSlotForTime(slots, day.value, timeSlot.startTime);

              return (
                <div key={`${day.value}-${timeSlot.startTime}`} className="h-16">
                  {slot ? (
                    <LessonCard
                      slot={slot}
                      onClick={() => onSlotClick(slot)}
                      onEdit={() => onEditSlot(slot)}
                      onDelete={() => onDeleteSlot(slot)}
                      canEdit={canEdit}
                    />
                  ) : (
                    <EmptySlot
                      dayOfWeek={day.value}
                      startTime={timeSlot.startTime}
                      endTime={timeSlot.endTime}
                      onClick={() =>
                        onEmptyClick(day.value, timeSlot.startTime, timeSlot.endTime)
                      }
                      canEdit={canEdit}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Teacher Timetable View ──────────────────────────────────
interface TeacherTimetableProps {
  slots: TimetableSlot[];
  timeSlots: TimeSlotConfig[];
}

function TeacherTimetableView({ slots, timeSlots }: TeacherTimetableProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="grid grid-cols-[100px_repeat(5,1fr)] gap-2 mb-2">
          <div className="flex items-center justify-center rounded-lg bg-gray-100 p-2">
            <Clock className="h-4 w-4 text-gray-500" />
          </div>
          {DAYS.map((day) => (
            <div
              key={day.value}
              className="flex items-center justify-center rounded-lg bg-gray-100 p-2"
            >
              <span className="text-sm font-semibold text-gray-700">
                {day.label}
              </span>
            </div>
          ))}
        </div>

        {/* Time Slots */}
        {timeSlots.map((timeSlot) => (
          <div
            key={timeSlot.startTime}
            className={cn(
              'grid grid-cols-[100px_repeat(5,1fr)] gap-2 mb-2',
              timeSlot.isBreak && 'opacity-60'
            )}
          >
            {/* Time Label */}
            <div className="flex flex-col items-center justify-center rounded-lg bg-gray-50 p-2 text-center">
              <span className="text-xs font-medium text-gray-700">
                {formatTime(timeSlot.startTime)}
              </span>
              <span className="text-xs text-gray-400">
                {formatTime(timeSlot.endTime)}
              </span>
            </div>

            {/* Day Cells */}
            {DAYS.map((day) => {
              if (timeSlot.isBreak) {
                return (
                  <div key={`${day.value}-${timeSlot.startTime}`} className="h-16">
                    <BreakSlot label={timeSlot.label} />
                  </div>
                );
              }

              const slot = getSlotForTime(slots, day.value, timeSlot.startTime);

              return (
                <div key={`${day.value}-${timeSlot.startTime}`} className="h-16">
                  {slot ? (
                    <div
                      className={cn(
                        'h-full rounded-lg border-2 p-2',
                        getSubjectColor(slot.learningAreaName)
                      )}
                    >
                      <p className="text-xs font-semibold truncate">
                        {slot.learningAreaName}
                      </p>
                      <p className="text-xs opacity-80 truncate">
                        {slot.className}
                      </p>
                      {slot.room && (
                        <p className="text-xs opacity-70 truncate">
                          <MapPin className="inline h-3 w-3 mr-0.5" />
                          {slot.room}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
                      <span className="text-xs text-gray-400">Free</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Lesson Form Modal ───────────────────────────────────────
interface LessonFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: LessonFormData) => Promise<void>;
  initialData?: Partial<LessonFormData>;
  classes: ClassOption[];
  teachers: TeacherOption[];
  learningAreas: LearningAreaOption[];
  mode: 'create' | 'edit';
  isSubmitting: boolean;
  conflicts: ConflictInfo[];
}

function LessonFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  classes,
  teachers,
  learningAreas,
  mode,
  isSubmitting,
  conflicts,
}: LessonFormModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<LessonFormData>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      classId: initialData?.classId || '',
      learningAreaId: initialData?.learningAreaId || '',
      teacherId: initialData?.teacherId || '',
      dayOfWeek: initialData?.dayOfWeek || 1,
      startTime: initialData?.startTime || '08:00',
      endTime: initialData?.endTime || '08:40',
      room: initialData?.room || '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        classId: initialData?.classId || '',
        learningAreaId: initialData?.learningAreaId || '',
        teacherId: initialData?.teacherId || '',
        dayOfWeek: initialData?.dayOfWeek || 1,
        startTime: initialData?.startTime || '08:00',
        endTime: initialData?.endTime || '08:40',
        room: initialData?.room || '',
      });
    }
  }, [open, initialData, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
    >
      <ModalHeader>
        <ModalTitle>{mode === 'create' ? 'Add Lesson' : 'Edit Lesson'}</ModalTitle>
      </ModalHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Conflicts Warning */}
        {conflicts.length > 0 && (
          <Alert variant="destructive" title="Scheduling Conflicts">
            <ul className="list-disc list-inside space-y-1">
              {conflicts.map((conflict, idx) => (
                <li key={idx} className="text-sm">{conflict.message}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Class */}
        <Controller
          name="classId"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Class *
              </label>
              <Select
                value={field.value}
                onChange={field.onChange}
                error={errors.classId?.message}
              >
                <option value="">Select class</option>
                {classes.map((cls) => (
                  <option key={cls.classId} value={cls.classId}>
                    {cls.name} ({cls.gradeName})
                  </option>
                ))}
              </Select>
            </div>
          )}
        />

        {/* Learning Area */}
        <Controller
          name="learningAreaId"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Subject / Learning Area *
              </label>
              <Select
                value={field.value}
                onChange={field.onChange}
                error={errors.learningAreaId?.message}
              >
                <option value="">Select subject</option>
                {learningAreas.map((la) => (
                  <option key={la.learningAreaId} value={la.learningAreaId}>
                    {la.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        />

        {/* Teacher */}
        <Controller
          name="teacherId"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Teacher *
              </label>
              <Select
                value={field.value}
                onChange={field.onChange}
                error={errors.teacherId?.message}
              >
                <option value="">Select teacher</option>
                {teachers.map((t) => (
                  <option key={t.staffId} value={t.staffId}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        />

        {/* Day */}
        <Controller
          name="dayOfWeek"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Day *
              </label>
              <Select
                value={field.value.toString()}
                onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
              >
                {DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        />

        {/* Time */}
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="startTime"
            control={control}
            render={({ field }) => (
              <Input
                label="Start Time *"
                type="time"
                error={errors.startTime?.message}
                {...field}
              />
            )}
          />

          <Controller
            name="endTime"
            control={control}
            render={({ field }) => (
              <Input
                label="End Time *"
                type="time"
                error={errors.endTime?.message}
                {...field}
              />
            )}
          />
        </div>

        {/* Room */}
        <Controller
          name="room"
          control={control}
          render={({ field }) => (
            <Input
              label="Room / Venue"
              placeholder="e.g., Room 3A, Science Lab"
              leftIcon={<MapPin className="h-4 w-4" />}
              {...field}
            />
          )}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={conflicts.length > 0}
          >
            <Save className="mr-2 h-4 w-4" />
            {mode === 'create' ? 'Add Lesson' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Slot Detail Modal ───────────────────────────────────────
interface SlotDetailModalProps {
  open: boolean;
  onClose: () => void;
  slot: TimetableSlot | null;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}

function SlotDetailModal({
  open,
  onClose,
  slot,
  onEdit,
  onDelete,
  canEdit,
}: SlotDetailModalProps) {
  if (!slot) {return null;}

  const day = DAYS.find((d) => d.value === slot.dayOfWeek);

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHeader>
        <ModalTitle>Lesson Details</ModalTitle>
      </ModalHeader>
      <div className="space-y-4">
        <div
          className={cn(
            'rounded-lg border-2 p-4',
            getSubjectColor(slot.learningAreaName)
          )}
        >
          <h3 className="text-lg font-bold">{slot.learningAreaName}</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Class</p>
            <p className="font-medium">{slot.className}</p>
            <p className="text-sm text-gray-500">{slot.gradeName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Teacher</p>
            <p className="font-medium">{slot.teacherName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Day</p>
            <p className="font-medium">{day?.label}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Time</p>
            <p className="font-medium">
              {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
            </p>
          </div>
          {slot.room && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Room</p>
              <p className="font-medium">{slot.room}</p>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onDelete}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Main Page Component ─────────────────────────────────────
export default function TimetablePage() {
  const router = useRouter();
  const { user, loading, checkPermission } = useAuth();
  const { success, error, warning, info } = useToast();

  // ─── State ─────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [learningAreas, setLearningAreas] = useState<LearningAreaOption[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formInitialData, setFormInitialData] = useState<Partial<LessonFormData>>({});
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSlot, setDeleteSlot] = useState<TimetableSlot | null>(null);

  // ─── Permissions ───────────────────────────────────────────
  const canEdit = checkPermission('timetable', 'update');

  // ─── Fetch Data ────────────────────────────────────────────
  const fetchOptions = useCallback(async () => {
    try {
      const [referenceDataResponse, teachersResponse] = await Promise.all([
        fetch('/api/settings/reference-data?includeLearningAreas=true', {
          credentials: 'include',
        }),
        fetch('/api/staff?pageSize=200&sortBy=first_name&sortOrder=asc', {
          credentials: 'include',
        }),
      ]);

      if (referenceDataResponse.ok) {
        const json = await referenceDataResponse.json();
        const referenceData = json.data ?? {};

        setClasses(
          (referenceData.classes || []).map((c: any) => ({
            classId: c.classId || c.class_id,
            name: c.name,
            gradeName: c.gradeName || c.grade?.name || '',
          }))
        );

        setLearningAreas(
          (referenceData.learningAreas || []).map((la: any) => ({
            learningAreaId: la.learningAreaId || la.learning_area_id,
            name: la.name,
          }))
        );
      }

      if (teachersResponse.ok) {
        const json = await teachersResponse.json();
        const teacherPositions = new Set(['teacher', 'class_teacher', 'subject_teacher']);

        setTeachers(
          (json.data || [])
            .filter((t: any) => teacherPositions.has(t.position) || teacherPositions.has(t.roleName))
            .map((t: any) => ({
              staffId: t.staffId || t.staff_id,
              name:
                [t.firstName || t.first_name, t.lastName || t.last_name]
                  .filter(Boolean)
                  .join(' ')
                  .trim() || t.name || 'Unknown',
              subjects: t.subjects || [],
            }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch options:', err);
    }
  }, []);

  const fetchTimetable = useCallback(async () => {
    try {
      const params = new URLSearchParams();

      if (viewMode === 'class' && selectedClassId) {
        params.set('class_id', selectedClassId);
      } else if (viewMode === 'teacher' && selectedTeacherId) {
        params.set('teacher_id', selectedTeacherId);
      } else {
        setSlots([]);
        return;
      }

      const response = await fetch(`/api/timetable?${params.toString()}`, {
        credentials: 'include',
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to fetch timetable');
      }

      setSlots(
        (json.data || []).map((s: any) => ({
          slotId: s.slot_id || s.slotId,
          classId: s.class_id || s.classId,
          className: s.className || s.class?.name || '',
          gradeName: s.gradeName || s.class?.grade?.name || '',
          learningAreaId: s.learning_area_id || s.learningAreaId,
          learningAreaName: s.learningAreaName || s.learning_area?.name || '',
          teacherId: s.teacher_id || s.teacherId,
          teacherName:
            s.teacherName ||
            (s.teacher?.user
              ? `${s.teacher.user.first_name} ${s.teacher.user.last_name}`
              : ''),
          dayOfWeek: s.day_of_week || s.dayOfWeek,
          startTime: s.start_time || s.startTime,
          endTime: s.end_time || s.endTime,
          room: s.room,
          isActive: s.is_active ?? s.isActive ?? true,
        }))
      );
    } catch (err) {
      console.error('Failed to fetch timetable:', err);
    }
  }, [viewMode, selectedClassId, selectedTeacherId]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchOptions();
      setIsLoading(false);
    };

    loadData();
  }, [fetchOptions]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTimetable();
    setIsRefreshing(false);
    success('Refreshed', 'Timetable has been updated.');
  };

  const handleAddLesson = (dayOfWeek?: number, startTime?: string, endTime?: string) => {
    setFormMode('create');
    setFormInitialData({
      classId: viewMode === 'class' ? selectedClassId : '',
      teacherId: viewMode === 'teacher' ? selectedTeacherId : '',
      dayOfWeek: dayOfWeek || 1,
      startTime: startTime || '08:00',
      endTime: endTime || '08:40',
    });
    setConflicts([]);
    setShowFormModal(true);
  };

  const handleEditSlot = (slot: TimetableSlot) => {
    setFormMode('edit');
    setFormInitialData({
      classId: slot.classId,
      learningAreaId: slot.learningAreaId,
      teacherId: slot.teacherId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room || '',
    });
    setSelectedSlot(slot);
    setConflicts([]);
    setShowFormModal(true);
    setShowDetailModal(false);
  };

  const handleSlotClick = (slot: TimetableSlot) => {
    setSelectedSlot(slot);
    setShowDetailModal(true);
  };

  const handleDeleteClick = (slot: TimetableSlot) => {
    setDeleteSlot(slot);
    setShowDeleteConfirm(true);
    setShowDetailModal(false);
  };

  const handleFormSubmit = async (data: LessonFormData) => {
    setIsSubmitting(true);

    try {
      const isEdit = formMode === 'edit' && selectedSlot;
      const method = isEdit ? 'PATCH' : 'POST';
      const body = isEdit ? { ...data, slotId: selectedSlot.slotId } : data;

      const response = await fetch('/api/timetable', {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const payload = await response.json();

      if (!response.ok) {
        // Check for conflicts
        if (payload.conflicts && payload.conflicts.length > 0) {
          setConflicts(payload.conflicts);
          return;
        }

        throw new Error(payload.error || payload.message || 'Failed to save lesson');
      }

      success(
        formMode === 'edit' ? 'Lesson Updated' : 'Lesson Added',
        'The timetable has been updated successfully.'
      );

      setShowFormModal(false);
      setSelectedSlot(null);
      setConflicts([]);
      await fetchTimetable();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      error('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteSlot) {return;}

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/timetable?slot_id=${deleteSlot.slotId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete lesson');
      }

      success(
        'Lesson Deleted',
        'The lesson has been removed from the timetable.'
      );

      setShowDeleteConfirm(false);
      setDeleteSlot(null);
      await fetchTimetable();
    } catch (err) {
      error('Error', err instanceof Error ? err.message : 'Failed to delete lesson.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ─── Computed Values ───────────────────────────────────────
  const selectedClassName = classes.find((c) => c.classId === selectedClassId)?.name || '';
  const selectedTeacherName = teachers.find((t) => t.staffId === selectedTeacherId)?.name || '';

  // ─── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading timetable...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Timetable" />
        <Alert variant="destructive">
          Your session has expired. Please sign in again.
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading timetable...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <PageHeader
        title="Timetable"
        description="View and manage class schedules"
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
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {canEdit && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleAddLesson()}
              disabled={!selectedClassId && !selectedTeacherId}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Lesson
            </Button>
          )}
        </div>
      </PageHeader>

      {/* ── View Mode & Selection ───────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">View by:</span>
              <div className="flex rounded-lg border border-gray-200 p-1">
                <button
                  onClick={() => {
                    setViewMode('class');
                    setSelectedTeacherId('');
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    viewMode === 'class'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <GraduationCap className="h-4 w-4" />
                  Class
                </button>
                <button
                  onClick={() => {
                    setViewMode('teacher');
                    setSelectedClassId('');
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    viewMode === 'teacher'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <User className="h-4 w-4" />
                  Teacher
                </button>
              </div>
            </div>

            {/* Selection Dropdown */}
            <div className="flex items-center gap-2">
              {viewMode === 'class' ? (
                <>
                  <label className="text-sm text-gray-500">Class:</label>
                  <Select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-48"
                  >
                    <option value="">Select class</option>
                    {classes.map((cls) => (
                      <option key={cls.classId} value={cls.classId}>
                        {cls.name}
                      </option>
                    ))}
                  </Select>
                </>
              ) : (
                <>
                  <label className="text-sm text-gray-500">Teacher:</label>
                  <Select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-48"
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((t) => (
                      <option key={t.staffId} value={t.staffId}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Timetable Grid ──────────────────────────────────── */}
      {(viewMode === 'class' && selectedClassId) ||
      (viewMode === 'teacher' && selectedTeacherId) ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5" />
              {viewMode === 'class'
                ? `${selectedClassName} Timetable`
                : `${selectedTeacherName}'s Schedule`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {viewMode === 'class' ? (
              <TimetableGrid
                slots={slots}
                timeSlots={DEFAULT_TIME_SLOTS}
                onSlotClick={handleSlotClick}
                onEmptyClick={(dayOfWeek, startTime, endTime) =>
                  handleAddLesson(dayOfWeek, startTime, endTime)
                }
                onEditSlot={handleEditSlot}
                onDeleteSlot={handleDeleteClick}
                canEdit={canEdit}
              />
            ) : (
              <TeacherTimetableView
                slots={slots}
                timeSlots={DEFAULT_TIME_SLOTS}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              Select {viewMode === 'class' ? 'a Class' : 'a Teacher'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Choose {viewMode === 'class' ? 'a class' : 'a teacher'} from the
              dropdown above to view their timetable.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Legend ──────────────────────────────────────────── */}
      {slots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Subject Colors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {learningAreas
                .filter((la) => slots.some((s) => s.learningAreaName === la.name))
                .map((la) => (
                  <span
                    key={la.learningAreaId}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium',
                      getSubjectColor(la.name)
                    )}
                  >
                    {la.name}
                  </span>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Lesson Form Modal ───────────────────────────────── */}
      <LessonFormModal
        open={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedSlot(null);
          setConflicts([]);
        }}
        onSubmit={handleFormSubmit}
        initialData={formInitialData}
        classes={classes}
        teachers={teachers}
        learningAreas={learningAreas}
        mode={formMode}
        isSubmitting={isSubmitting}
        conflicts={conflicts}
      />

      {/* ── Slot Detail Modal ───────────────────────────────── */}
      <SlotDetailModal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSlot(null);
        }}
        slot={selectedSlot}
        onEdit={() => selectedSlot && handleEditSlot(selectedSlot)}
        onDelete={() => selectedSlot && handleDeleteClick(selectedSlot)}
        canEdit={canEdit}
      />

      {/* ── Delete Confirmation ─────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteSlot(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Lesson"
        description={`Are you sure you want to delete ${deleteSlot?.learningAreaName} from the timetable?`}
        confirmLabel="Delete"
        variant="danger"
        loading={isSubmitting}
      />
    </div>
  );
}
