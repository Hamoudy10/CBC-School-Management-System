// features/settings/services/school.service.ts
// School profile and settings management

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { ensureStorageBucket, STORAGE_BUCKET } from "@/lib/supabase/storage";
import type { SchoolProfile, SchoolSettings } from "../types";
import type {
  UpdateSchoolProfileInput,
  UpdateSettingsInput,
} from "../validators/settings.schema";

type SettingsPayload = SchoolSettings["settings"];
type SettingType = "string" | "number" | "boolean" | "json";
type GradingSystem = SettingsPayload["academic"]["grading_system"];

type SchoolSettingRow = {
  school_id: string;
  setting_key: string;
  setting_value: string;
  setting_type: SettingType;
  category: keyof SettingsPayload;
};

const DEFAULT_SETTINGS_PAYLOAD: SettingsPayload = {
  academic: {
    grading_system: "cbc_4point",
    allow_teacher_report_comments: true,
    require_principal_approval: true,
    attendance_threshold_warning: 80,
    attendance_threshold_critical: 60,
  },
  finance: {
    currency: "KES",
    currency_symbol: "KES",
    payment_reminder_days: [7, 14, 30],
    allow_partial_payments: true,
    generate_receipts: true,
    overdue_penalty_enabled: false,
  },
  communication: {
    allow_parent_messaging: true,
    allow_teacher_parent_messaging: true,
    announcement_approval_required: false,
    max_message_recipients: 100,
  },
  general: {
    timezone: "Africa/Nairobi",
    date_format: "DD/MM/YYYY",
    school_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    term_dates_visible_to_parents: true,
    show_student_rankings: false,
  },
};

function cloneSettingsPayload(): SettingsPayload {
  return JSON.parse(
    JSON.stringify(DEFAULT_SETTINGS_PAYLOAD),
  ) as SettingsPayload;
}

function inferSettingType(value: unknown): SettingType {
  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (Array.isArray(value) || (value !== null && typeof value === "object")) {
    return "json";
  }

  return "string";
}

function serializeSettingValue(value: unknown): string {
  const type = inferSettingType(value);
  return type === "json" ? JSON.stringify(value) : String(value);
}

function deserializeSettingValue(
  raw: string,
  type: SettingType,
  fallback: unknown,
): unknown {
  if (type === "boolean") {
    return raw === "true";
  }

  if (type === "number") {
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  if (type === "json") {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  return raw;
}

function flattenSettingsPayload(
  schoolId: string,
  settings: SettingsPayload,
): SchoolSettingRow[] {
  const rows: SchoolSettingRow[] = [];

  (
    Object.entries(settings) as [
      keyof SettingsPayload,
      Record<string, unknown>,
    ][]
  ).forEach(([category, values]) => {
    Object.entries(values).forEach(([key, value]) => {
      rows.push({
        school_id: schoolId,
        setting_key: `${category}.${key}`,
        setting_value: serializeSettingValue(value),
        setting_type: inferSettingType(value),
        category,
      });
    });
  });

  return rows;
}

function buildSettingsFromRows(
  rows: Array<{
    setting_key: string;
    setting_value: string;
    setting_type?: string | null;
    category: string;
  }>,
): SettingsPayload {
  const settings = cloneSettingsPayload();

  rows.forEach((row) => {
    const inferredCategory = row.category as keyof SettingsPayload;
    const [pathCategory, pathKey] = row.setting_key.includes(".")
      ? (row.setting_key.split(".", 2) as [keyof SettingsPayload, string])
      : [inferredCategory, row.setting_key];
    const category = pathCategory in settings ? pathCategory : inferredCategory;
    const key = pathKey;

    if (!(category in settings) || !key) {
      return;
    }

    const fallback = (settings[category] as Record<string, unknown>)[key];
    const type =
      (row.setting_type as SettingType | null) ?? inferSettingType(fallback);

    (settings[category] as Record<string, unknown>)[key] =
      deserializeSettingValue(row.setting_value, type, fallback);
  });

  return normalizeSettingsPayload(settings);
}

function mergeSettingsPayload(
  current: SettingsPayload,
  input: UpdateSettingsInput,
): SettingsPayload {
  return normalizeSettingsPayload({
    academic: {
      ...current.academic,
      ...input.academic,
      grading_system: normalizeGradingSystem(
        input.academic?.grading_system ?? current.academic.grading_system,
      ),
    },
    finance: { ...current.finance, ...input.finance },
    communication: { ...current.communication, ...input.communication },
    general: { ...current.general, ...input.general },
  });
}

function normalizeGradingSystem(value: unknown): GradingSystem {
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

  return DEFAULT_SETTINGS_PAYLOAD.academic.grading_system;
}

function normalizeSettingsPayload(settings: SettingsPayload): SettingsPayload {
  return {
    ...settings,
    academic: {
      ...settings.academic,
      grading_system: normalizeGradingSystem(settings.academic.grading_system),
    },
  };
}

function getDefaultSettings(schoolId: string): SchoolSettings {
  return {
    school_id: schoolId,
    settings: cloneSettingsPayload(),
  } as unknown as SchoolSettings;
}

// ============================================================
// SCHOOL PROFILE
// ============================================================

export async function getSchoolProfile(
  schoolId: string,
): Promise<{ success: boolean; data?: SchoolProfile; message?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("school_id", schoolId)
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, data: data as SchoolProfile };
}

export async function updateSchoolProfile(
  schoolId: string,
  input: UpdateSchoolProfileInput,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      updateData[key] = value === "" ? null : value;
    }
  });

  const { error } = await (supabase.from("schools") as any)
    .update(updateData)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "School profile updated" };
}

// ============================================================
// SCHOOL SETTINGS
// ============================================================

export async function getSchoolSettings(
  schoolId: string,
): Promise<{ success: boolean; data?: SchoolSettings; message?: string }> {
  const supabase = await createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("school_settings")
    .select("setting_key, setting_value, setting_type, category")
    .eq("school_id", schoolId)
    .order("category")
    .order("setting_key");

  if (error) {
    return { success: false, message: error.message };
  }

  if (!data || data.length === 0) {
    const defaults = getDefaultSettings(schoolId);
    const rows = flattenSettingsPayload(schoolId, defaults.settings);

    const { error: insertError } = await supabase
      .from("school_settings")
      .upsert(rows as any[], { onConflict: "school_id,setting_key" });

    if (insertError) {
      return { success: false, message: insertError.message };
    }

    return { success: true, data: defaults };
  }

  return {
    success: true,
    data: {
      school_id: schoolId,
      settings: buildSettingsFromRows(data as any[]),
    } as unknown as SchoolSettings,
  };
}

export async function updateSchoolSettings(
  schoolId: string,
  input: UpdateSettingsInput,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseAdminClient();
  const current = await getSchoolSettings(schoolId);
  if (!current.success || !current.data) {
    return { success: false, message: "Failed to fetch current settings" };
  }

  const merged = mergeSettingsPayload(current.data.settings, input);
  const rows = flattenSettingsPayload(schoolId, merged);

  const { error } = await supabase
    .from("school_settings")
    .upsert(rows as any[], { onConflict: "school_id,setting_key" });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Settings updated" };
}

// ============================================================
// LOGO UPLOAD
// ============================================================

export async function uploadSchoolLogo(
  schoolId: string,
  file: File,
): Promise<{ success: boolean; url?: string; message: string }> {
  const storageSetup = await ensureStorageBucket();
  if (!storageSetup.success) {
    return {
      success: false,
      message: `Storage setup failed: ${storageSetup.message}. Please ensure the "${STORAGE_BUCKET}" bucket exists.`,
    };
  }

  const supabase = storageSetup.client;
  const fileExt = file.name.split(".").pop();
  const fileName = `${schoolId}/logo.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  const serverClient = await createSupabaseServerClient();
  await (serverClient.from("schools") as any)
    .update({
      logo_url: urlData.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("school_id", schoolId);

  return {
    success: true,
    url: urlData.publicUrl,
    message: "Logo uploaded successfully",
  };
}
