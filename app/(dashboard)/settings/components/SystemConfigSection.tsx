"use client";

import {
  useState,
  useEffect,
  useCallback,
  type FormEvent,
  type ReactNode,
} from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";

type SystemConfigFormState = {
  academic: {
    grading_system: "cbc_4point" | "percentage" | "letter_grade";
    allow_teacher_report_comments: boolean;
    require_principal_approval: boolean;
    attendance_threshold_warning: string;
    attendance_threshold_critical: string;
  };
  finance: {
    currency: string;
    currency_symbol: string;
    payment_reminder_days: string;
    allow_partial_payments: boolean;
    generate_receipts: boolean;
    overdue_penalty_enabled: boolean;
    overdue_penalty_rate: string;
  };
  communication: {
    allow_parent_messaging: boolean;
    allow_teacher_parent_messaging: boolean;
    announcement_approval_required: boolean;
    max_message_recipients: string;
  };
  general: {
    timezone: string;
    date_format: string;
    school_days: string[];
    term_dates_visible_to_parents: boolean;
    show_student_rankings: boolean;
  };
};

type SystemConfigOverview = {
  activeYearLabel: string;
  activeTermLabel: string;
  classCount: number;
};

const SYSTEM_DAY_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SYSTEM_TIMEZONE_OPTIONS = [
  "Africa/Nairobi",
  "Africa/Kampala",
  "Africa/Dar_es_Salaam",
  "Europe/London",
  "UTC",
];

const SYSTEM_DATE_FORMAT_OPTIONS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

const SYSTEM_CURRENCY_OPTIONS = [
  { value: "KES", label: "KES" },
  { value: "USD", label: "USD" },
  { value: "GBP", label: "GBP" },
  { value: "EUR", label: "EUR" },
];

const SYSTEM_GRADING_OPTIONS = [
  { value: "cbc_4point", label: "CBC 4-Point" },
  { value: "percentage", label: "Percentage" },
  { value: "letter_grade", label: "Letter Grade" },
];

function createDefaultSystemConfigForm(): SystemConfigFormState {
  return {
    academic: {
      grading_system: "cbc_4point",
      allow_teacher_report_comments: true,
      require_principal_approval: true,
      attendance_threshold_warning: "80",
      attendance_threshold_critical: "60",
    },
    finance: {
      currency: "KES",
      currency_symbol: "KES",
      payment_reminder_days: "7, 14, 30",
      allow_partial_payments: true,
      generate_receipts: true,
      overdue_penalty_enabled: false,
      overdue_penalty_rate: "",
    },
    communication: {
      allow_parent_messaging: true,
      allow_teacher_parent_messaging: true,
      announcement_approval_required: false,
      max_message_recipients: "100",
    },
    general: {
      timezone: "Africa/Nairobi",
      date_format: "DD/MM/YYYY",
      school_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      term_dates_visible_to_parents: true,
      show_student_rankings: false,
    },
  };
}

function normalizeSystemGradingSystem(
  value: unknown,
): SystemConfigFormState["academic"]["grading_system"] {
  if (value === "cbc_4_point") {
    return "cbc_4point";
  }

  if (
    value === "cbc_4point" ||
    value === "percentage" ||
    value === "letter_grade"
  ) {
    return value;
  }

  return "cbc_4point";
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function coerceString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function coerceNumberString(value: unknown, fallback: string): string {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return fallback;
}

function coerceStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const validValues = value.filter(
    (entry): entry is string =>
      typeof entry === "string" && SYSTEM_DAY_OPTIONS.includes(entry),
  );

  return validValues.length > 0 ? validValues : fallback;
}

function parseReminderDays(value: string): number[] | null {
  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => Number(entry));

  if (
    parsed.length === 0 ||
    parsed.some((entry) => !Number.isInteger(entry) || entry < 1 || entry > 90)
  ) {
    return null;
  }

  return Array.from(new Set(parsed));
}

function mapSettingsToSystemConfigForm(
  settingsPayload: any,
): SystemConfigFormState {
  const defaults = createDefaultSystemConfigForm();
  const resolved = settingsPayload?.settings ?? settingsPayload ?? {};
  const academic = resolved?.academic ?? {};
  const finance = resolved?.finance ?? {};
  const communication = resolved?.communication ?? {};
  const general = resolved?.general ?? {};

  return {
    academic: {
      grading_system: normalizeSystemGradingSystem(academic.grading_system),
      allow_teacher_report_comments: coerceBoolean(
        academic.allow_teacher_report_comments,
        defaults.academic.allow_teacher_report_comments,
      ),
      require_principal_approval: coerceBoolean(
        academic.require_principal_approval,
        defaults.academic.require_principal_approval,
      ),
      attendance_threshold_warning: coerceNumberString(
        academic.attendance_threshold_warning,
        defaults.academic.attendance_threshold_warning,
      ),
      attendance_threshold_critical: coerceNumberString(
        academic.attendance_threshold_critical,
        defaults.academic.attendance_threshold_critical,
      ),
    },
    finance: {
      currency: coerceString(finance.currency, defaults.finance.currency),
      currency_symbol: coerceString(
        finance.currency_symbol,
        defaults.finance.currency_symbol,
      ),
      payment_reminder_days: Array.isArray(finance.payment_reminder_days)
        ? finance.payment_reminder_days.join(", ")
        : defaults.finance.payment_reminder_days,
      allow_partial_payments: coerceBoolean(
        finance.allow_partial_payments,
        defaults.finance.allow_partial_payments,
      ),
      generate_receipts: coerceBoolean(
        finance.generate_receipts,
        defaults.finance.generate_receipts,
      ),
      overdue_penalty_enabled: coerceBoolean(
        finance.overdue_penalty_enabled,
        defaults.finance.overdue_penalty_enabled,
      ),
      overdue_penalty_rate: coerceNumberString(
        finance.overdue_penalty_rate,
        defaults.finance.overdue_penalty_rate,
      ),
    },
    communication: {
      allow_parent_messaging: coerceBoolean(
        communication.allow_parent_messaging,
        defaults.communication.allow_parent_messaging,
      ),
      allow_teacher_parent_messaging: coerceBoolean(
        communication.allow_teacher_parent_messaging,
        defaults.communication.allow_teacher_parent_messaging,
      ),
      announcement_approval_required: coerceBoolean(
        communication.announcement_approval_required,
        defaults.communication.announcement_approval_required,
      ),
      max_message_recipients: coerceNumberString(
        communication.max_message_recipients,
        defaults.communication.max_message_recipients,
      ),
    },
    general: {
      timezone: coerceString(general.timezone, defaults.general.timezone),
      date_format: coerceString(
        general.date_format,
        defaults.general.date_format,
      ),
      school_days: coerceStringArray(
        general.school_days,
        defaults.general.school_days,
      ),
      term_dates_visible_to_parents: coerceBoolean(
        general.term_dates_visible_to_parents,
        defaults.general.term_dates_visible_to_parents,
      ),
      show_student_rankings: coerceBoolean(
        general.show_student_rankings,
        defaults.general.show_student_rankings,
      ),
    },
  };
}

function buildSystemConfigPayload(form: SystemConfigFormState) {
  const warningThreshold = Number(form.academic.attendance_threshold_warning);
  const criticalThreshold = Number(form.academic.attendance_threshold_critical);
  const reminderDays = parseReminderDays(form.finance.payment_reminder_days);
  const maxRecipients = Number(form.communication.max_message_recipients);
  const penaltyRate = form.finance.overdue_penalty_rate.trim()
    ? Number(form.finance.overdue_penalty_rate)
    : undefined;

  if (
    !Number.isInteger(warningThreshold) ||
    warningThreshold < 50 ||
    warningThreshold > 100
  ) {
    return {
      error:
        "Attendance warning threshold must be a whole number between 50 and 100.",
    };
  }

  if (
    !Number.isInteger(criticalThreshold) ||
    criticalThreshold < 30 ||
    criticalThreshold > 100
  ) {
    return {
      error:
        "Attendance critical threshold must be a whole number between 30 and 100.",
    };
  }

  if (criticalThreshold >= warningThreshold) {
    return {
      error:
        "Attendance critical threshold should be lower than the warning threshold.",
    };
  }

  if (!reminderDays) {
    return {
      error:
        "Payment reminder days must be comma-separated whole numbers between 1 and 90.",
    };
  }

  if (!form.finance.currency.trim() || !form.finance.currency_symbol.trim()) {
    return {
      error: "Finance settings require both a currency and currency symbol.",
    };
  }

  if (
    !Number.isInteger(maxRecipients) ||
    maxRecipients < 1 ||
    maxRecipients > 500
  ) {
    return {
      error:
        "Maximum message recipients must be a whole number between 1 and 500.",
    };
  }

  if (!SYSTEM_DATE_FORMAT_OPTIONS.includes(form.general.date_format)) {
    return { error: "Select a supported date format before saving." };
  }

  if (!form.general.timezone.trim()) {
    return { error: "Timezone is required." };
  }

  if (form.general.school_days.length === 0) {
    return { error: "Select at least one school day." };
  }

  if (
    form.finance.overdue_penalty_enabled &&
    (penaltyRate === undefined ||
      Number.isNaN(penaltyRate) ||
      penaltyRate < 0 ||
      penaltyRate > 100)
  ) {
    return {
      error:
        "Overdue penalty rate must be a number between 0 and 100 when penalties are enabled.",
    };
  }

  return {
    payload: {
      academic: {
        grading_system: form.academic.grading_system,
        allow_teacher_report_comments:
          form.academic.allow_teacher_report_comments,
        require_principal_approval: form.academic.require_principal_approval,
        attendance_threshold_warning: warningThreshold,
        attendance_threshold_critical: criticalThreshold,
      },
      finance: {
        currency: form.finance.currency.trim(),
        currency_symbol: form.finance.currency_symbol.trim(),
        payment_reminder_days: reminderDays,
        allow_partial_payments: form.finance.allow_partial_payments,
        generate_receipts: form.finance.generate_receipts,
        overdue_penalty_enabled: form.finance.overdue_penalty_enabled,
        overdue_penalty_rate: form.finance.overdue_penalty_enabled
          ? penaltyRate
          : undefined,
      },
      communication: {
        allow_parent_messaging: form.communication.allow_parent_messaging,
        allow_teacher_parent_messaging:
          form.communication.allow_teacher_parent_messaging,
        announcement_approval_required:
          form.communication.announcement_approval_required,
        max_message_recipients: maxRecipients,
      },
      general: {
        timezone: form.general.timezone.trim(),
        date_format: form.general.date_format,
        school_days: form.general.school_days,
        term_dates_visible_to_parents:
          form.general.term_dates_visible_to_parents,
        show_student_rankings: form.general.show_student_rankings,
      },
    },
  };
}

function SettingsCategoryCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="h-full">
      <div className="border-b border-gray-100 p-6 pb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="space-y-5 p-6 pt-5">{children}</div>
    </Card>
  );
}

function BooleanSettingField({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={value ? "primary" : "outline"}
          disabled={disabled}
          onClick={() => onChange(true)}
        >
          Enabled
        </Button>
        <Button
          type="button"
          size="sm"
          variant={!value ? "primary" : "outline"}
          disabled={disabled}
          onClick={() => onChange(false)}
        >
          Disabled
        </Button>
      </div>
    </div>
  );
}

export default function SystemConfigSection() {
  const { success, error: toastError } = useToast();
  const { checkPermission } = useAuth();
  const [form, setForm] = useState<SystemConfigFormState>(
    createDefaultSystemConfigForm,
  );
  const [savedForm, setSavedForm] = useState<SystemConfigFormState>(
    createDefaultSystemConfigForm,
  );
  const [overview, setOverview] = useState<SystemConfigOverview>({
    activeYearLabel: "Not set",
    activeTermLabel: "Not set",
    classCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canViewSettings = checkPermission("settings", "view");
  const canUpdateSettings = checkPermission("settings", "update");

  const fetchSettings = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }

      const res = await fetch("/api/settings/config");
      if (!res.ok) {
        throw new Error("Failed to fetch settings");
      }

      const json = await res.json();
      const data = json.data ?? {};
      const nextForm = mapSettingsToSystemConfigForm(data.settings);

      setForm(nextForm);
      setSavedForm(nextForm);
      setOverview({
        activeYearLabel: data.active_year?.year || "Not set",
        activeTermLabel: data.active_term?.name || "Not set",
        classCount: Array.isArray(data.classes) ? data.classes.length : 0,
      });
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load system configuration",
      );
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!canViewSettings) {
      setLoading(false);
      return;
    }

    fetchSettings();
  }, [canViewSettings, fetchSettings]);

  const updateSectionField = (
    section: keyof SystemConfigFormState,
    key: string,
    value: string | boolean | string[],
  ) => {
    setForm(
      (prev) =>
        ({
          ...prev,
          [section]: {
            ...(prev as any)[section],
            [key]: value,
          },
        }) as SystemConfigFormState,
    );
  };

  const toggleSchoolDay = (day: string) => {
    setForm((prev) => {
      const exists = prev.general.school_days.includes(day);

      return {
        ...prev,
        general: {
          ...prev.general,
          school_days: exists
            ? prev.general.school_days.filter((entry) => entry !== day)
            : [...prev.general.school_days, day],
        },
      };
    });
  };

  const handleReset = () => {
    setForm(savedForm);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!canUpdateSettings) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }

    const prepared = buildSystemConfigPayload(form);
    if ("error" in prepared) {
      toastError("Invalid configuration", prepared.error);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(prepared.payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to update system settings");
      }

      setSavedForm(form);
      await fetchSettings(false);
      success(
        "System configuration updated",
        result?.message || "Operational settings were saved successfully.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update system settings";
      toastError("Error", message);
    } finally {
      setIsSaving(false);
    }
  };

  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(savedForm);

  if (!canViewSettings) {
    return (
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Access denied</h2>
          <p className="mt-2 text-sm text-gray-500">
            You do not have permission to view settings.
          </p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="mt-2 text-sm text-gray-500">
            Loading system configuration...
          </p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="space-y-4 p-6">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchSettings()}
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSave}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            System Configuration
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Configure the operational defaults used across academics, finance,
            communication, and the parent-facing experience.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="warning">Unsaved changes</Badge>
          )}
          {!canUpdateSettings && <Badge variant="outline">View only</Badge>}
          <Button
            type="button"
            variant="outline"
            disabled={!hasUnsavedChanges || isSaving}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            type="submit"
            loading={isSaving}
            disabled={!canUpdateSettings || !hasUnsavedChanges}
          >
            Save settings
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">
            Active academic year
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {overview.activeYearLabel}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">Active term</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {overview.activeTermLabel}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">Active classes</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {overview.classCount}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SettingsCategoryCard
          title="Academic Settings"
          description="Control report-comment policy, approval workflow, and attendance alert thresholds."
        >
          <Select
            label="Grading system"
            value={form.academic.grading_system}
            disabled={!canUpdateSettings || isSaving}
            onChange={(event) =>
              updateSectionField(
                "academic",
                "grading_system",
                event.target.value,
              )
            }
          >
            {SYSTEM_GRADING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Attendance warning threshold (%)"
              type="number"
              min="50"
              max="100"
              value={form.academic.attendance_threshold_warning}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField(
                  "academic",
                  "attendance_threshold_warning",
                  event.target.value,
                )
              }
            />
            <Input
              label="Attendance critical threshold (%)"
              type="number"
              min="30"
              max="100"
              value={form.academic.attendance_threshold_critical}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField(
                  "academic",
                  "attendance_threshold_critical",
                  event.target.value,
                )
              }
            />
          </div>

          <BooleanSettingField
            label="Allow teacher report comments"
            description="Let teachers add narrative comments directly to report cards."
            value={form.academic.allow_teacher_report_comments}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "academic",
                "allow_teacher_report_comments",
                value,
              )
            }
          />

          <BooleanSettingField
            label="Require principal approval"
            description="Keep a principal sign-off step before reports or academic outputs are finalized."
            value={form.academic.require_principal_approval}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "academic",
                "require_principal_approval",
                value,
              )
            }
          />
        </SettingsCategoryCard>

        <SettingsCategoryCard
          title="Finance Settings"
          description="Define billing defaults, receipt behavior, reminder cadence, and overdue handling."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Currency"
              value={form.finance.currency}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField("finance", "currency", event.target.value)
              }
            >
              {SYSTEM_CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Currency symbol"
              value={form.finance.currency_symbol}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField(
                  "finance",
                  "currency_symbol",
                  event.target.value.toUpperCase(),
                )
              }
            />
          </div>

          <Input
            label="Payment reminder days"
            value={form.finance.payment_reminder_days}
            helperText="Use comma-separated day offsets, for example 7, 14, 30."
            disabled={!canUpdateSettings || isSaving}
            onChange={(event) =>
              updateSectionField(
                "finance",
                "payment_reminder_days",
                event.target.value,
              )
            }
          />

          <BooleanSettingField
            label="Allow partial payments"
            description="Permit finance staff to record payments that do not clear the full balance."
            value={form.finance.allow_partial_payments}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField("finance", "allow_partial_payments", value)
            }
          />

          <BooleanSettingField
            label="Generate receipts automatically"
            description="Issue receipts as part of the default payment workflow."
            value={form.finance.generate_receipts}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField("finance", "generate_receipts", value)
            }
          />

          <BooleanSettingField
            label="Enable overdue penalties"
            description="Apply a configurable penalty rate to overdue balances."
            value={form.finance.overdue_penalty_enabled}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField("finance", "overdue_penalty_enabled", value)
            }
          />

          <Input
            label="Overdue penalty rate (%)"
            type="number"
            min="0"
            max="100"
            value={form.finance.overdue_penalty_rate}
            helperText="Leave blank if overdue penalties are disabled."
            disabled={
              !canUpdateSettings ||
              isSaving ||
              !form.finance.overdue_penalty_enabled
            }
            onChange={(event) =>
              updateSectionField(
                "finance",
                "overdue_penalty_rate",
                event.target.value,
              )
            }
          />

          <p className="text-sm text-gray-500">
            Fee structures and charge schedules remain in{" "}
            <a
              href="/finance/fee-structures"
              className="font-medium text-blue-600 hover:text-blue-800"
            >
              Finance
            </a>
            .
          </p>
        </SettingsCategoryCard>

        <SettingsCategoryCard
          title="Communication Settings"
          description="Define who can message guardians and how large operational broadcasts may be."
        >
          <Input
            label="Maximum message recipients"
            type="number"
            min="1"
            max="500"
            value={form.communication.max_message_recipients}
            disabled={!canUpdateSettings || isSaving}
            onChange={(event) =>
              updateSectionField(
                "communication",
                "max_message_recipients",
                event.target.value,
              )
            }
          />

          <BooleanSettingField
            label="Allow parent messaging"
            description="Let guardians send and receive messages through the communication module."
            value={form.communication.allow_parent_messaging}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "communication",
                "allow_parent_messaging",
                value,
              )
            }
          />

          <BooleanSettingField
            label="Allow teacher-to-parent messaging"
            description="Enable direct teacher conversations with guardians when needed."
            value={form.communication.allow_teacher_parent_messaging}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "communication",
                "allow_teacher_parent_messaging",
                value,
              )
            }
          />

          <BooleanSettingField
            label="Require announcement approval"
            description="Add an approval step before staff announcements are sent broadly."
            value={form.communication.announcement_approval_required}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "communication",
                "announcement_approval_required",
                value,
              )
            }
          />
        </SettingsCategoryCard>

        <SettingsCategoryCard
          title="General Settings"
          description="Set the school calendar display defaults and the operational profile used across the app."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Timezone"
              value={form.general.timezone}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField("general", "timezone", event.target.value)
              }
            >
              {SYSTEM_TIMEZONE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>

            <Select
              label="Date format"
              value={form.general.date_format}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField("general", "date_format", event.target.value)
              }
            >
              {SYSTEM_DATE_FORMAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900">School days</p>
              <p className="text-sm text-gray-500">
                Choose the weekdays that count toward attendance and routine
                operations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_DAY_OPTIONS.map((day) => {
                const selected = form.general.school_days.includes(day);

                return (
                  <Button
                    key={day}
                    type="button"
                    size="sm"
                    variant={selected ? "primary" : "outline"}
                    disabled={!canUpdateSettings || isSaving}
                    onClick={() => toggleSchoolDay(day)}
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
          </div>

          <BooleanSettingField
            label="Show term dates to parents"
            description="Expose the configured term schedule in guardian-facing views."
            value={form.general.term_dates_visible_to_parents}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "general",
                "term_dates_visible_to_parents",
                value,
              )
            }
          />

          <BooleanSettingField
            label="Show student rankings"
            description="Display ranking-related outputs where reporting features support them."
            value={form.general.show_student_rankings}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField("general", "show_student_rankings", value)
            }
          />
        </SettingsCategoryCard>
      </div>
    </form>
  );
}
