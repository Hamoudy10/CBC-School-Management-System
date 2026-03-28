// app/(dashboard)/students/[id]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  Edit,
  Trash2,
  Plus,
  MoreHorizontal,
  User,
  Calendar,
  MapPin,
  Phone,
  Mail,
  GraduationCap,
  Heart,
  Users,
  DollarSign,
  ClipboardList,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  Printer,
  History,
  Shield,
  BookOpen,
  Award,
  BarChart3,
  ChevronRight,
  UserMinus,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useReferenceData } from "@/hooks/useReferenceData";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ConfirmDialog,
} from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  StudentWithDetails,
  StudentGuardian,
  StudentClassHistory,
  StudentAttendanceSummary,
  StudentFeeSummary,
  StudentPerformanceSummary,
  EnrollmentStatus,
  ENROLLMENT_STATUS_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "@/features/students";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

// ─── Types ───────────────────────────────────────────────────
interface PaymentRecord {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  receiptNumber: string;
  feeName: string;
}

interface AttendanceRecord {
  date: string;
  status: "present" | "absent" | "late" | "excused";
  reason?: string;
}

interface DisciplinaryRecord {
  id: string;
  incidentDate: string;
  incidentType: string;
  severity: "minor" | "moderate" | "major" | "critical";
  description: string;
  actionTaken?: string;
  status: string;
}

type GuardianFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: (typeof RELATIONSHIP_OPTIONS)[number];
  isPrimaryContact: boolean;
  canPickup: boolean;
};

const emptyGuardianForm: GuardianFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  relationship: "guardian",
  isPrimaryContact: false,
  canPickup: true,
};

type LifecycleAction = "promote" | "transfer";

// ─── Status Badge Component ──────────────────────────────────
function StatusBadge({ status }: { status: EnrollmentStatus }) {
  const config: Record<
    EnrollmentStatus,
    {
      label: string;
      variant: "success" | "warning" | "error" | "default" | "info";
    }
  > = {
    active: { label: "Active", variant: "success" },
    transferred: { label: "Transferred", variant: "info" },
    graduated: { label: "Graduated", variant: "default" },
    withdrawn: { label: "Withdrawn", variant: "warning" },
    suspended: { label: "Suspended", variant: "error" },
  };

  const { label, variant } = config[status] ?? {
    label: status,
    variant: "default",
  };

  return <Badge variant={variant}>{label}</Badge>;
}

// ─── Info Row Component ──────────────────────────────────────
interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}

function InfoRow({ icon, label, value, className }: InfoRowProps) {
  return (
    <div className={cn("flex items-start gap-3 py-2", className)}>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="mt-0.5 text-sm text-gray-900">{value || "—"}</p>
      </div>
    </div>
  );
}

// ─── Stat Card Component ─────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "amber" | "red" | "purple";
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
}

const colorConfig = {
  blue: { bg: "bg-blue-50", icon: "bg-blue-100 text-blue-600" },
  green: { bg: "bg-green-50", icon: "bg-green-100 text-green-600" },
  amber: { bg: "bg-amber-50", icon: "bg-amber-100 text-amber-600" },
  red: { bg: "bg-red-50", icon: "bg-red-100 text-red-600" },
  purple: { bg: "bg-purple-50", icon: "bg-purple-100 text-purple-600" },
};

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
  onClick,
}: StatCardProps) {
  const colors = colorConfig[color];

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md",
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
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend.isPositive ? "text-green-600" : "text-red-600",
                  )}
                >
                  {trend.value}%
                </span>
              </div>
            )}
          </div>
          <div className={cn("rounded-xl p-2.5", colors.icon)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Guardian Card Component ─────────────────────────────────
function GuardianCard({
  guardian,
  canManage = false,
  onEdit,
  onRemove,
}: {
  guardian: StudentGuardian;
  canManage?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const fullName = guardian.guardian
    ? `${guardian.guardian.firstName} ${guardian.guardian.lastName}`
    : "Unknown";

  return (
    <div className="flex items-start gap-4 rounded-lg border border-gray-200 p-4">
      <Avatar name={fullName} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-900">{fullName}</h4>
          {guardian.isPrimaryContact && (
            <Badge variant="primary" className="text-xs">
              Primary
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm capitalize text-gray-500">
          {guardian.relationship}
        </p>
        <div className="mt-2 space-y-1">
          {guardian.guardian?.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-3.5 w-3.5" />
              <a
                href={`tel:${guardian.guardian.phone}`}
                className="hover:text-blue-600"
              >
                {guardian.guardian.phone}
              </a>
            </div>
          )}
          {guardian.guardian?.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-3.5 w-3.5" />
              <a
                href={`mailto:${guardian.guardian.email}`}
                className="hover:text-blue-600"
              >
                {guardian.guardian.email}
              </a>
            </div>
          )}
        </div>
        {guardian.canPickup && (
          <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3.5 w-3.5" />
            Authorized for pickup
          </div>
        )}
        {canManage && (
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Performance Level Badge ─────────────────────────────────
function PerformanceBadge({
  level,
}: {
  level: "below_expectation" | "approaching" | "meeting" | "exceeding";
}) {
  const config = {
    exceeding: { label: "Exceeding", variant: "success" as const, score: "4" },
    meeting: { label: "Meeting", variant: "info" as const, score: "3" },
    approaching: {
      label: "Approaching",
      variant: "warning" as const,
      score: "2",
    },
    below_expectation: {
      label: "Below Expectation",
      variant: "error" as const,
      score: "1",
    },
  };

  const { label, variant, score } = config[level];

  return (
    <Badge variant={variant}>
      {label} ({score})
    </Badge>
  );
}

// ─── Attendance Status Badge ─────────────────────────────────
function AttendanceStatusBadge({
  status,
}: {
  status: "present" | "absent" | "late" | "excused";
}) {
  const config = {
    present: { label: "Present", variant: "success" as const },
    absent: { label: "Absent", variant: "error" as const },
    late: { label: "Late", variant: "warning" as const },
    excused: { label: "Excused", variant: "info" as const },
  };

  const { label, variant } = config[status];

  return <Badge variant={variant}>{label}</Badge>;
}

// ─── Severity Badge ──────────────────────────────────────────
function SeverityBadge({
  severity,
}: {
  severity: "minor" | "moderate" | "major" | "critical";
}) {
  const config = {
    minor: { label: "Minor", variant: "default" as const },
    moderate: { label: "Moderate", variant: "warning" as const },
    major: { label: "Major", variant: "error" as const },
    critical: { label: "Critical", variant: "error" as const },
  };

  const { label, variant } = config[severity];

  return <Badge variant={variant}>{label}</Badge>;
}

// ─── Actions Menu ────────────────────────────────────────────
interface ActionsMenuProps {
  onEdit: () => void;
  onArchive: (status: EnrollmentStatus) => void;
  onDelete: () => void;
  onPrintReport: () => void;
  currentStatus: EnrollmentStatus;
  canEdit: boolean;
  canDelete: boolean;
}

function ActionsMenu({
  onEdit,
  onArchive,
  onDelete,
  onPrintReport,
  currentStatus,
  canEdit,
  canDelete,
}: ActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(!isOpen)}>
        <MoreHorizontal className="mr-2 h-4 w-4" />
        Actions
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {canEdit && (
              <button
                onClick={() => {
                  onEdit();
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <Edit className="h-4 w-4" />
                Edit Student
              </button>
            )}

            <button
              onClick={() => {
                onPrintReport();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <Printer className="h-4 w-4" />
              Print Report Card
            </button>

            <button
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Download Records
            </button>

            {canEdit && currentStatus === "active" && (
              <>
                <div className="my-1 border-t border-gray-100" />

                <button
                  onClick={() => {
                    onArchive("transferred");
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50"
                >
                  <UserMinus className="h-4 w-4" />
                  Mark as Transferred
                </button>

                <button
                  onClick={() => {
                    onArchive("withdrawn");
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50"
                >
                  <UserMinus className="h-4 w-4" />
                  Mark as Withdrawn
                </button>

                <button
                  onClick={() => {
                    onArchive("graduated");
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-purple-600 hover:bg-purple-50"
                >
                  <GraduationCap className="h-4 w-4" />
                  Mark as Graduated
                </button>
              </>
            )}

            {canDelete && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={() => {
                    onDelete();
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Student
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────
export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, checkPermission } = useAuth();
  const { success, error: toastError } = useToast();

  const studentId = params.id as string;

  // ─── State ─────────────────────────────────────────────────
  const [student, setStudent] = useState<StudentWithDetails | null>(null);
  const [classHistory, setClassHistory] = useState<StudentClassHistory[]>([]);
  const [attendanceSummary, setAttendanceSummary] =
    useState<StudentAttendanceSummary | null>(null);
  const [feeSummary, setFeeSummary] = useState<StudentFeeSummary | null>(null);
  const [performanceSummary, setPerformanceSummary] =
    useState<StudentPerformanceSummary | null>(null);
  const [recentPayments, setRecentPayments] = useState<PaymentRecord[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>(
    [],
  );
  const [disciplinaryRecords, setDisciplinaryRecords] = useState<
    DisciplinaryRecord[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] =
    useState<EnrollmentStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [guardianForm, setGuardianForm] =
    useState<GuardianFormState>(emptyGuardianForm);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [isGuardianSaving, setIsGuardianSaving] = useState(false);
  const [guardianToEdit, setGuardianToEdit] =
    useState<StudentGuardian | null>(null);
  const [guardianToRemove, setGuardianToRemove] =
    useState<StudentGuardian | null>(null);
  const [isLifecycleModalOpen, setIsLifecycleModalOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] =
    useState<LifecycleAction | null>(null);
  const [targetClassId, setTargetClassId] = useState("");
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [isLifecycleSubmitting, setIsLifecycleSubmitting] = useState(false);

  // ─── Permissions ───────────────────────────────────────────
  const canEdit = checkPermission("students", "update");
  const canDelete = checkPermission("students", "delete");
  const canViewFinance = checkPermission("finance", "view");
  const canCreatePayments = checkPermission("finance", "create");
  const canViewDiscipline = checkPermission("compliance", "view");
  const canViewAttendance = checkPermission("attendance", "view");
  const canViewAcademics =
    checkPermission("academics", "view") ||
    checkPermission("assessments", "view");
  const { classes: referenceClasses } = useReferenceData({
    enabled: Boolean(user),
  });

  const availableTabs = useMemo(
    () =>
      [
        { key: "overview", allowed: true },
        { key: "academics", allowed: canViewAcademics },
        { key: "attendance", allowed: canViewAttendance },
        { key: "finance", allowed: canViewFinance },
        { key: "guardians", allowed: true },
        { key: "discipline", allowed: canViewDiscipline },
        { key: "history", allowed: true },
      ]
        .filter((tab) => tab.allowed)
        .map((tab) => tab.key),
    [canViewAcademics, canViewAttendance, canViewFinance, canViewDiscipline],
  );
  const lifecycleClassOptions = useMemo(
    () =>
      referenceClasses
        .filter((classOption) => classOption.classId !== student?.currentClassId)
        .map((classOption) => ({
          value: classOption.classId,
          label: `${classOption.name}${
            classOption.gradeName ? ` - ${classOption.gradeName}` : ""
          }`,
        })),
    [referenceClasses, student?.currentClassId],
  );

  // ─── Fetch Student Data ────────────────────────────────────
  const fetchStudent = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/students/${studentId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Student not found");
        }
        throw new Error("Failed to fetch student");
      }

      const json = await response.json();
      const payload = json.data ?? {};
      setStudent(payload.student ?? payload);
      if (payload.attendanceSummary) {
        setAttendanceSummary(payload.attendanceSummary);
      }
      if (payload.feeSummary) {
        setFeeSummary(payload.feeSummary);
      }
      if (payload.assessmentSummary) {
        const learningAreas = payload.assessmentSummary.map(
          (item: any, index: number) => ({
            learningAreaId: String(index),
            name: item.learningArea,
            averageScore: item.averageScore,
            level: item.performanceLevel ?? "below_expectation",
          }),
        );
        const overallAverage =
          learningAreas.length > 0
            ? learningAreas.reduce(
                (sum: number, area: any) => sum + area.averageScore,
                0,
              ) / learningAreas.length
            : 0;

        setPerformanceSummary({
          studentId,
          academicYearId: "",
          termId: payload.attendanceSummary?.termId ?? "",
          overallAverage,
          overallLevel:
            overallAverage >= 3.5
              ? "exceeding"
              : overallAverage >= 2.5
                ? "meeting"
                : overallAverage >= 1.5
                  ? "approaching"
                  : "below_expectation",
          learningAreas,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  // ─── Fetch Related Data ────────────────────────────────────
  const fetchRelatedData = useCallback(async () => {
    if (!student) {
      return;
    }

    try {
      const requests: Array<Promise<Response>> = [
        fetch(`/api/students/${studentId}/class-history`, {
          credentials: "include",
        }),
      ];

      if (canViewAttendance) {
        requests.push(
          fetch(`/api/students/${studentId}/attendance-summary`, {
            credentials: "include",
          }),
          fetch(`/api/students/${studentId}/attendance?limit=10`, {
            credentials: "include",
          }),
        );
      }

      if (canViewFinance) {
        requests.push(
          fetch(`/api/students/${studentId}/fee-summary`, {
            credentials: "include",
          }),
          fetch(`/api/students/${studentId}/payments?limit=5`, {
            credentials: "include",
          }),
        );
      }

      if (canViewAcademics) {
        requests.push(
          fetch(`/api/students/${studentId}/performance-summary`, {
            credentials: "include",
          }),
        );
      }

      if (canViewDiscipline) {
        requests.push(
          fetch(`/api/students/${studentId}/discipline`, {
            credentials: "include",
          }),
        );
      }

      const responses = await Promise.allSettled(requests);
      const fulfilled = await Promise.all(
        responses.map(async (result) => {
          if (result.status !== "fulfilled" || !result.value.ok) {
            return null;
          }

          const json = await result.value.json();
          return {
            url: result.value.url,
            data: json.data,
          };
        }),
      );

      fulfilled.forEach((result) => {
        if (!result) {
          return;
        }

        if (result.url.includes("/class-history")) {
          setClassHistory(result.data || []);
        } else if (result.url.includes("/attendance-summary")) {
          setAttendanceSummary(result.data);
        } else if (result.url.includes("/attendance?")) {
          setRecentAttendance(result.data || []);
        } else if (result.url.includes("/fee-summary")) {
          setFeeSummary(result.data);
        } else if (result.url.includes("/payments?")) {
          setRecentPayments(result.data || []);
        } else if (result.url.includes("/performance-summary")) {
          setPerformanceSummary(result.data);
        } else if (result.url.includes("/discipline")) {
          setDisciplinaryRecords(result.data || []);
        }
      });
    } catch (err) {
      console.error("Failed to fetch related data:", err);
    }
  }, [
    studentId,
    student,
    canViewFinance,
    canViewDiscipline,
    canViewAttendance,
    canViewAcademics,
  ]);

  // ─── Effects ───────────────────────────────────────────────
  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  useEffect(() => {
    if (student) {
      fetchRelatedData();
    }
  }, [student, fetchRelatedData]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? "overview");
    }
  }, [availableTabs, activeTab]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleEdit = () => {
    router.push(`/students/${studentId}/edit`);
  };

  const openCreateGuardianModal = useCallback(() => {
    setGuardianToEdit(null);
    setGuardianForm({
      ...emptyGuardianForm,
      isPrimaryContact: !student?.guardians?.length,
    });
    setGuardianError(null);
    setIsGuardianModalOpen(true);
  }, [student]);

  const openEditGuardianModal = useCallback((guardian: StudentGuardian) => {
    setGuardianToEdit(guardian);
    setGuardianForm({
      firstName: guardian.guardian?.firstName ?? "",
      lastName: guardian.guardian?.lastName ?? "",
      email: guardian.guardian?.email ?? "",
      phone: guardian.guardian?.phone ?? "",
      relationship: (guardian.relationship as GuardianFormState["relationship"]) || "guardian",
      isPrimaryContact: guardian.isPrimaryContact,
      canPickup: guardian.canPickup,
    });
    setGuardianError(null);
    setIsGuardianModalOpen(true);
  }, []);

  const closeGuardianModal = useCallback(() => {
    setIsGuardianModalOpen(false);
    setGuardianToEdit(null);
    setGuardianForm(emptyGuardianForm);
    setGuardianError(null);
    setIsGuardianSaving(false);
  }, []);

  const openLifecycleModal = useCallback((action: LifecycleAction) => {
    setLifecycleAction(action);
    setTargetClassId("");
    setLifecycleError(null);
    setIsLifecycleModalOpen(true);
  }, []);

  const closeLifecycleModal = useCallback(() => {
    setIsLifecycleModalOpen(false);
    setLifecycleAction(null);
    setTargetClassId("");
    setLifecycleError(null);
    setIsLifecycleSubmitting(false);
  }, []);

  const handleGuardianFieldChange = useCallback(
    (field: keyof GuardianFormState, value: string | boolean) => {
      setGuardianForm((current) => ({
        ...current,
        [field]: value,
      }));
    },
    [],
  );

  const handleSaveGuardian = useCallback(async () => {
    const firstName = guardianForm.firstName.trim();
    const lastName = guardianForm.lastName.trim();
    const email = guardianForm.email.trim();
    const phone = guardianForm.phone.trim();

    if (!firstName || !lastName || !email) {
      setGuardianError("First name, last name, and email are required.");
      return;
    }

    setIsGuardianSaving(true);
    setGuardianError(null);

    try {
      const endpoint = guardianToEdit
        ? `/api/students/${studentId}/guardians/${guardianToEdit.guardianUserId}`
        : `/api/students/${studentId}/guardians`;
      const method = guardianToEdit ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          relationship: guardianForm.relationship,
          isPrimaryContact: guardianForm.isPrimaryContact,
          canPickup: guardianForm.canPickup,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || "Failed to save guardian.");
      }

      success(
        guardianToEdit ? "Guardian Updated" : "Guardian Added",
        guardianToEdit
          ? "Guardian details were updated successfully."
          : "Guardian linked successfully.",
      );

      closeGuardianModal();
      await fetchStudent();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save guardian.";
      setGuardianError(message);
      setIsGuardianSaving(false);
    }
  }, [closeGuardianModal, fetchStudent, guardianForm, guardianToEdit, studentId, success]);

  const handleRemoveGuardian = useCallback(async () => {
    if (!guardianToRemove) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(
        `/api/students/${studentId}/guardians/${guardianToRemove.guardianUserId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || "Failed to remove guardian.");
      }

      success("Guardian Removed", "Guardian link removed successfully.");
      setGuardianToRemove(null);
      await fetchStudent();
    } catch (err) {
      toastError(
        "Guardian Removal Failed",
        err instanceof Error ? err.message : "Failed to remove guardian.",
      );
    } finally {
      setIsProcessing(false);
    }
  }, [fetchStudent, guardianToRemove, studentId, success, toastError]);

  const handleLifecycleSubmit = useCallback(async () => {
    if (!lifecycleAction) {
      return;
    }

    if (!targetClassId) {
      setLifecycleError("Choose the destination class before continuing.");
      return;
    }

    setIsLifecycleSubmitting(true);
    setLifecycleError(null);

    try {
      const response = await fetch(`/api/students/${studentId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: lifecycleAction,
          targetClassId,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          json?.message ||
            `Failed to ${lifecycleAction === "promote" ? "promote" : "transfer"} student.`,
        );
      }

      success(
        lifecycleAction === "promote"
          ? "Student Promoted"
          : "Student Transferred",
        json?.message ||
          (lifecycleAction === "promote"
            ? "Student promotion completed successfully."
            : "Student transfer completed successfully."),
      );

      closeLifecycleModal();
      await fetchStudent();
    } catch (err) {
      setLifecycleError(
        err instanceof Error
          ? err.message
          : `Failed to ${lifecycleAction} student.`,
      );
      setIsLifecycleSubmitting(false);
    }
  }, [
    closeLifecycleModal,
    fetchStudent,
    lifecycleAction,
    studentId,
    success,
    targetClassId,
  ]);

  const handleArchive = async (status: EnrollmentStatus) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update student status");
      }

      success("Status Updated", `Student has been marked as ${status}.`);

      fetchStudent();
    } catch (err) {
      toastError("Error", "Failed to update student status.");
    } finally {
      setIsProcessing(false);
      setShowArchiveConfirm(null);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete student");
      }

      success("Student Updated", "The student has been withdrawn.");

      router.push("/students");
    } catch (err) {
      toastError("Error", "Failed to delete student.");
    } finally {
      setIsProcessing(false);
      setShowDeleteConfirm(false);
    }
  };

  const handlePrintReport = () => {
    router.push(`/reports/print/${studentId}`);
  };

  // ─── Loading State ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading student details...</p>
        </div>
      </div>
    );
  }

  // ─── Error State ───────────────────────────────────────────
  if (error || !student) {
    return (
      <div className="space-y-6">
        <PageHeader title="Student Details">
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </PageHeader>
        <Alert variant="destructive">
          {error || "Student not found"}
          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/students")}
            >
              Return to Students List
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <PageHeader
        title={student.fullName}
        description={`Admission No: ${student.admissionNumber}`}
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {canEdit && student.status === "active" && (
            <>
              <Button
                variant="secondary"
                onClick={() => openLifecycleModal("promote")}
                disabled={!student.currentClassId}
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                Promote Student
              </Button>
              <Button
                variant="secondary"
                onClick={() => openLifecycleModal("transfer")}
                disabled={!student.currentClassId}
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer Student
              </Button>
            </>
          )}
          <ActionsMenu
            onEdit={handleEdit}
            onArchive={(status) => setShowArchiveConfirm(status)}
            onDelete={() => setShowDeleteConfirm(true)}
            onPrintReport={handlePrintReport}
            currentStatus={student.status}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      </PageHeader>

      {/* ── Student Header Card ─────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Avatar & Status */}
            <div className="flex flex-col items-center gap-3">
              <Avatar
                src={student.photoUrl ?? undefined}
                alt={student.fullName}
                name={`${student.firstName} ${student.lastName}`}
                size="xl"
                className="h-24 w-24 text-2xl"
              />
              <StatusBadge status={student.status} />
            </div>

            {/* Basic Info */}
            <div className="flex-1 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Full Name"
                value={student.fullName}
              />
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Date of Birth"
                value={`${formatDate(student.dateOfBirth)} (${student.age} years)`}
              />
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Gender"
                value={<span className="capitalize">{student.gender}</span>}
              />
              <InfoRow
                icon={<GraduationCap className="h-4 w-4" />}
                label="Current Class"
                value={
                  student.currentClass ? (
                    <span>
                      {student.currentClass.name}
                      <span className="ml-1 text-xs text-gray-500">
                        ({student.currentClass.gradeName})
                      </span>
                    </span>
                  ) : (
                    "Not assigned"
                  )
                }
              />
              <InfoRow
                icon={<FileText className="h-4 w-4" />}
                label="NEMIS Number"
                value={student.nemisNumber}
              />
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Enrollment Date"
                value={formatDate(student.enrollmentDate)}
              />
              {student.hasSpecialNeeds && (
                <InfoRow
                  icon={<Heart className="h-4 w-4" />}
                  label="Special Needs"
                  value={<Badge variant="warning">Requires Support</Badge>}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats Cards ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canViewAttendance && (
          <StatCard
            title="Attendance Rate"
            value={
              attendanceSummary
                ? `${attendanceSummary.attendanceRate.toFixed(0)}%`
                : "—"
            }
            subtitle={
              attendanceSummary
                ? `${attendanceSummary.presentDays} of ${attendanceSummary.totalDays} days`
                : "No data"
            }
            icon={<Clock className="h-5 w-5" />}
            color={
              attendanceSummary && attendanceSummary.attendanceRate >= 90
                ? "green"
                : attendanceSummary && attendanceSummary.attendanceRate >= 75
                  ? "amber"
                  : "red"
            }
            onClick={() => setActiveTab("attendance")}
          />
        )}

        {canViewFinance && (
          <StatCard
            title="Fee Balance"
            value={feeSummary ? formatCurrency(feeSummary.balance) : "—"}
            subtitle={
              feeSummary
                ? `${formatCurrency(feeSummary.totalPaid)} paid`
                : "No data"
            }
            icon={<DollarSign className="h-5 w-5" />}
            color={
              feeSummary && feeSummary.balance <= 0
                ? "green"
                : feeSummary && feeSummary.balance > 0
                  ? "red"
                  : "blue"
            }
            onClick={() => setActiveTab("finance")}
          />
        )}

        {canViewAcademics && (
          <StatCard
            title="Overall Performance"
            value={
              performanceSummary
                ? `${performanceSummary.overallAverage.toFixed(1)} / 4.0`
                : "—"
            }
            subtitle={
              performanceSummary
                ? performanceSummary.overallLevel.replace("_", " ")
                : "No assessments"
            }
            icon={<Award className="h-5 w-5" />}
            color={
              performanceSummary && performanceSummary.overallAverage >= 3
                ? "green"
                : performanceSummary && performanceSummary.overallAverage >= 2
                  ? "amber"
                  : "purple"
            }
            onClick={() => setActiveTab("academics")}
          />
        )}

        {canViewDiscipline && (
          <StatCard
            title="Discipline"
            value={disciplinaryRecords.length}
            subtitle={
              disciplinaryRecords.length === 0
                ? "No incidents"
                : `${disciplinaryRecords.filter((d) => d.status === "open").length} open`
            }
            icon={<Shield className="h-5 w-5" />}
            color={disciplinaryRecords.length === 0 ? "green" : "amber"}
            onClick={() => setActiveTab("discipline")}
          />
        )}
      </div>

      {/* ── Tabs Content ────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabTrigger value="overview">Overview</TabTrigger>
          {canViewAcademics && (
            <TabTrigger value="academics">Academics</TabTrigger>
          )}
          {canViewAttendance && (
            <TabTrigger value="attendance">Attendance</TabTrigger>
          )}
          {canViewFinance && <TabTrigger value="finance">Finance</TabTrigger>}
          <TabTrigger value="guardians">Guardians</TabTrigger>
          {canViewDiscipline && (
            <TabTrigger value="discipline">Discipline</TabTrigger>
          )}
          <TabTrigger value="history">History</TabTrigger>
        </TabsList>

        {/* ── Overview Tab ────────────────────────────────── */}
        <TabContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Personal Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="Birth Certificate No."
                  value={student.birthCertificateNo}
                />
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Previous School"
                  value={student.previousSchool}
                />
                {student.hasSpecialNeeds && (
                  <InfoRow
                    icon={<Heart className="h-4 w-4" />}
                    label="Special Needs Details"
                    value={student.specialNeedsDetails}
                  />
                )}
                {student.medicalInfo && (
                  <InfoRow
                    icon={<Heart className="h-4 w-4" />}
                    label="Medical Information"
                    value={student.medicalInfo}
                  />
                )}
              </CardContent>
            </Card>

            {/* Primary Guardian */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Primary Guardian</CardTitle>
              </CardHeader>
              <CardContent>
                {student.guardians && student.guardians.length > 0 ? (
                  <GuardianCard
                    guardian={
                      student.guardians.find(
                        (g: StudentGuardian) => g.isPrimaryContact,
                      ) || student.guardians[0]
                    }
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Users className="h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">
                      No guardians linked
                    </p>
                    {canEdit && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={openCreateGuardianModal}
                      >
                        Add Guardian
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          {canViewAttendance && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Recent Attendance</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("attendance")}
                >
                  View All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {recentAttendance.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {recentAttendance.slice(0, 14).map((record, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg text-xs font-medium",
                          record.status === "present" &&
                            "bg-green-100 text-green-700",
                          record.status === "absent" &&
                            "bg-red-100 text-red-700",
                          record.status === "late" &&
                            "bg-amber-100 text-amber-700",
                          record.status === "excused" &&
                            "bg-blue-100 text-blue-700",
                        )}
                        title={`${formatDate(record.date)} - ${record.status}`}
                      >
                        {new Date(record.date).getDate()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No attendance records</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabContent>

        {/* ── Academics Tab ───────────────────────────────── */}
        {canViewAcademics && (
          <TabContent value="academics" className="mt-6 space-y-6">
            {performanceSummary ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Performance Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow">
                        <span className="text-2xl font-bold text-gray-900">
                          {performanceSummary.overallAverage.toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Overall Average</p>
                        <PerformanceBadge
                          level={performanceSummary.overallLevel}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Learning Areas Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Learning Area</TableHead>
                          <TableHead className="text-center">Average</TableHead>
                          <TableHead className="text-center">Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {performanceSummary.learningAreas.map((area: any) => (
                          <TableRow key={area.learningAreaId}>
                            <TableCell className="font-medium">
                              {area.name}
                            </TableCell>
                            <TableCell className="text-center">
                              {area.averageScore.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center">
                              <PerformanceBadge level={area.level as any} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="h-12 w-12 text-gray-300" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    No Academic Data
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Assessment data will appear here once available.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabContent>
        )}

        {canViewAttendance && (
          <TabContent value="attendance" className="mt-6 space-y-6">
            {attendanceSummary && (
              <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {attendanceSummary.presentDays}
                    </p>
                    <p className="text-sm text-gray-500">Present</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {attendanceSummary.absentDays}
                    </p>
                    <p className="text-sm text-gray-500">Absent</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">
                      {attendanceSummary.lateDays}
                    </p>
                    <p className="text-sm text-gray-500">Late</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {attendanceSummary.excusedDays}
                    </p>
                    <p className="text-sm text-gray-500">Excused</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attendance History</CardTitle>
              </CardHeader>
              <CardContent>
                {recentAttendance.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentAttendance.map((record, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{formatDate(record.date)}</TableCell>
                          <TableCell>
                            <AttendanceStatusBadge status={record.status} />
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {record.reason || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500">
                    No attendance records available
                  </p>
                )}
              </CardContent>
            </Card>
          </TabContent>
        )}

        {/* ── Finance Tab ─────────────────────────────────── */}
        {canViewFinance && (
          <TabContent value="finance" className="mt-6 space-y-6">
            {feeSummary && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-500">Total Due</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(feeSummary.totalDue)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-500">Total Paid</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(feeSummary.totalPaid)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-500">Balance</p>
                    <p
                      className={cn(
                        "text-2xl font-bold",
                        feeSummary.balance > 0
                          ? "text-red-600"
                          : "text-green-600",
                      )}
                    >
                      {formatCurrency(feeSummary.balance)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Recent Payments</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/finance/ledger/${studentId}`)}
                  >
                    Full Ledger
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                  {canCreatePayments && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/finance/payments/new?studentId=${studentId}`,
                        )
                      }
                    >
                      Record Payment
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {recentPayments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Fee Type</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {formatDate(payment.paymentDate)}
                          </TableCell>
                          <TableCell>{payment.feeName}</TableCell>
                          <TableCell className="capitalize">
                            {payment.paymentMethod.replace("_", " ")}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {payment.receiptNumber}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500">
                    No payment records available
                  </p>
                )}
              </CardContent>
            </Card>
          </TabContent>
        )}

        {/* ── Guardians Tab ───────────────────────────────── */}
        <TabContent value="guardians" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Guardians ({student.guardians?.length || 0})
              </CardTitle>
              {canEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={openCreateGuardianModal}
                >
                  <Plus className="h-4 w-4" />
                  Add Guardian
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {student.guardians && student.guardians.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {student.guardians.map((guardian: StudentGuardian) => (
                    <GuardianCard
                      key={guardian.id}
                      guardian={guardian}
                      canManage={canEdit}
                      onEdit={() => openEditGuardianModal(guardian)}
                      onRemove={() => setGuardianToRemove(guardian)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-gray-300" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    No Guardians
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No guardians have been linked to this student.
                  </p>
                  {canEdit && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4"
                      onClick={openCreateGuardianModal}
                    >
                      <Plus className="h-4 w-4" />
                      Add First Guardian
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabContent>

        {/* ── Discipline Tab ──────────────────────────────── */}
        {canViewDiscipline && (
          <TabContent value="discipline" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Disciplinary Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                {disciplinaryRecords.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Incident Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action Taken</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disciplinaryRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {formatDate(record.incidentDate)}
                          </TableCell>
                          <TableCell>{record.incidentType}</TableCell>
                          <TableCell>
                            <SeverityBadge severity={record.severity} />
                          </TableCell>
                          <TableCell className="capitalize">
                            {record.status}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-gray-500">
                            {record.actionTaken || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-300" />
                    <h3 className="mt-4 text-lg font-semibold text-gray-900">
                      No Incidents
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      This student has no disciplinary records.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabContent>
        )}

        {/* ── History Tab ─────────────────────────────────── */}
        <TabContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Class History</CardTitle>
            </CardHeader>
            <CardContent>
              {classHistory.length > 0 ? (
                <div className="space-y-4">
                  {classHistory.map((record, idx) => (
                    <div
                      key={record.id}
                      className="flex items-start gap-4 border-l-2 border-blue-200 pl-4"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <History className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {record.className}
                        </p>
                        <p className="text-sm text-gray-500">
                          {record.gradeName} • {record.termName} •{" "}
                          {record.academicYear}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {formatDate(record.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-gray-500">
                  No class history available
                </p>
              )}
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>

      <Modal open={isLifecycleModalOpen} onClose={closeLifecycleModal} size="md">
        <ModalHeader>
          <ModalTitle>
            {lifecycleAction === "promote"
              ? "Promote Student"
              : "Transfer Student"}
          </ModalTitle>
          <ModalDescription>
            {lifecycleAction === "promote"
              ? "Move this student into a new class for the active academic period and record the change in class history."
              : "Reassign this student to another class while keeping the record active in the school."}
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <Alert variant="info">
            Current class:{" "}
            <span className="font-medium text-gray-900">
              {student.currentClass
                ? `${student.currentClass.name}${
                    student.currentClass.gradeName
                      ? ` - ${student.currentClass.gradeName}`
                      : ""
                  }`
                : "Not assigned"}
            </span>
          </Alert>

          {lifecycleError && (
            <Alert variant="destructive">{lifecycleError}</Alert>
          )}

          <Select
            label="Destination class"
            value={targetClassId}
            onChange={(event) => setTargetClassId(event.target.value)}
            disabled={isLifecycleSubmitting || lifecycleClassOptions.length === 0}
            helperText={
              lifecycleAction === "promote"
                ? "Use this when the student is advancing into a new class for the current active term."
                : "Use this when the student should move operationally into a different class."
            }
          >
            <option value="">Select a class</option>
            {lifecycleClassOptions.map((classOption) => (
              <option key={classOption.value} value={classOption.value}>
                {classOption.label}
              </option>
            ))}
          </Select>

          {lifecycleClassOptions.length === 0 && (
            <Alert variant="warning">
              No alternate active classes are available for this student right now.
            </Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={closeLifecycleModal}
            disabled={isLifecycleSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleLifecycleSubmit}
            loading={isLifecycleSubmitting}
            disabled={lifecycleClassOptions.length === 0}
          >
            {lifecycleAction === "promote"
              ? "Confirm Promotion"
              : "Confirm Transfer"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={isGuardianModalOpen} onClose={closeGuardianModal} size="md">
        <ModalHeader>
          <ModalTitle>
            {guardianToEdit ? "Edit Guardian" : "Add Guardian"}
          </ModalTitle>
          <ModalDescription>
            {guardianToEdit
              ? "Update guardian contact details and student relationship settings."
              : "Link a guardian to this student and define the contact relationship."}
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-4">
          {guardianError && <Alert variant="destructive">{guardianError}</Alert>}
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="First Name"
              value={guardianForm.firstName}
              onChange={(event) =>
                handleGuardianFieldChange("firstName", event.target.value)
              }
              disabled={isGuardianSaving}
              required
            />
            <Input
              label="Last Name"
              value={guardianForm.lastName}
              onChange={(event) =>
                handleGuardianFieldChange("lastName", event.target.value)
              }
              disabled={isGuardianSaving}
              required
            />
            <Input
              label="Email"
              type="email"
              value={guardianForm.email}
              onChange={(event) =>
                handleGuardianFieldChange("email", event.target.value)
              }
              disabled={isGuardianSaving}
              required
            />
            <Input
              label="Phone"
              value={guardianForm.phone}
              onChange={(event) =>
                handleGuardianFieldChange("phone", event.target.value)
              }
              disabled={isGuardianSaving}
            />
          </div>

          <Select
            label="Relationship"
            value={guardianForm.relationship}
            onChange={(event) =>
              handleGuardianFieldChange(
                "relationship",
                event.target.value as GuardianFormState["relationship"],
              )
            }
            disabled={isGuardianSaving}
          >
            {RELATIONSHIP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </Select>

          <div className="space-y-3 rounded-lg border border-gray-200 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={guardianForm.isPrimaryContact}
                onChange={(event) =>
                  handleGuardianFieldChange(
                    "isPrimaryContact",
                    event.target.checked,
                  )
                }
                disabled={isGuardianSaving}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Primary contact
                </p>
                <p className="text-xs text-gray-500">
                  Use this guardian as the main school contact for the student.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={guardianForm.canPickup}
                onChange={(event) =>
                  handleGuardianFieldChange("canPickup", event.target.checked)
                }
                disabled={isGuardianSaving}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Authorized for pickup
                </p>
                <p className="text-xs text-gray-500">
                  Mark this guardian as allowed to pick up the student.
                </p>
              </div>
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={closeGuardianModal}
            disabled={isGuardianSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSaveGuardian}
            loading={isGuardianSaving}
          >
            {guardianToEdit ? "Save Guardian" : "Add Guardian"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ── Delete Confirmation ─────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Student"
        description={`Are you sure you want to delete ${student.fullName}? This action cannot be undone and will remove all associated records.`}
        confirmLabel="Delete"
        variant="danger"
        loading={isProcessing}
      />

      {/* ── Archive Confirmation ────────────────────────────── */}
      <ConfirmDialog
        open={!!showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(null)}
        onConfirm={() =>
          showArchiveConfirm && handleArchive(showArchiveConfirm)
        }
        title={`Mark as ${showArchiveConfirm ? showArchiveConfirm.charAt(0).toUpperCase() + showArchiveConfirm.slice(1) : ""}`}
        description={`Are you sure you want to mark ${student.fullName} as ${showArchiveConfirm}?`}
        confirmLabel="Confirm"
        variant="primary"
        loading={isProcessing}
      />

      <ConfirmDialog
        open={!!guardianToRemove}
        onClose={() => setGuardianToRemove(null)}
        onConfirm={handleRemoveGuardian}
        title="Remove Guardian"
        description={`Remove ${
          guardianToRemove?.guardian
            ? `${guardianToRemove.guardian.firstName} ${guardianToRemove.guardian.lastName}`
            : "this guardian"
        } from this student?`}
        confirmLabel="Remove"
        variant="danger"
        loading={isProcessing}
      />
    </div>
  );
}
