// features/settings/services/school.service.ts
// School profile and settings management

import { createClient } from "@/lib/supabase/client";
import type { SchoolProfile, SchoolSettings, SystemConfig } from "../types";
import type {
  UpdateSchoolProfileInput,
  UpdateSettingsInput,
} from "../validators/settings.schema";

const supabase = createClient();

// ============================================================
// SCHOOL PROFILE
// ============================================================

export async function getSchoolProfile(
  schoolId: string,
): Promise<{ success: boolean; data?: SchoolProfile; message?: string }> {
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
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      updateData[key] = value === "" ? null : value;
    }
  });

  const { error } = await (supabase
    .from("schools") as any)
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
  const { data, error } = await supabase
    .from("school_settings")
    .select("*")
    .eq("school_id", schoolId)
    .single();

  if (error) {
    // Return defaults if no settings exist
    if (error.code === "PGRST116") {
      const defaults = getDefaultSettings(schoolId);
      // Create default settings
      await (supabase.from("school_settings") as any).insert(defaults);
      return { success: true, data: defaults };
    }
    return { success: false, message: error.message };
  }

  return { success: true, data: data as SchoolSettings };
}

export async function updateSchoolSettings(
  schoolId: string,
  input: UpdateSettingsInput,
): Promise<{ success: boolean; message: string }> {
  // Get current settings
  const current = await getSchoolSettings(schoolId);
  if (!current.success || !current.data) {
    return { success: false, message: "Failed to fetch current settings" };
  }

  // Deep merge
  const merged = {
    ...current.data,
    settings: {
      academic: { ...current.data.settings.academic, ...input.academic },
      finance: { ...current.data.settings.finance, ...input.finance },
      communication: {
        ...current.data.settings.communication,
        ...input.communication,
      },
      general: { ...current.data.settings.general, ...input.general },
    },
  };

  const { error } = await (supabase
    .from("school_settings") as any)
    .update({
      settings: merged.settings,
      updated_at: new Date().toISOString(),
    })
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Settings updated" };
}

function getDefaultSettings(schoolId: string): SchoolSettings {
  return {
    school_id: schoolId,
    settings: {
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
    },
  };
}

// ============================================================
// LOGO UPLOAD
// ============================================================

export async function uploadSchoolLogo(
  schoolId: string,
  file: File,
): Promise<{ success: boolean; url?: string; message: string }> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${schoolId}/logo.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("school-assets")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { data: urlData } = supabase.storage
    .from("school-assets")
    .getPublicUrl(fileName);

  // Update school profile with logo URL
  await (supabase
    .from("schools") as any)
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
