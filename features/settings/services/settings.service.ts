// @ts-nocheck
// features/settings/services/settings.service.ts
// System settings key-value store

import { createServerClient } from "@/lib/supabase/server";
import type { SchoolSettings, SettingsCategory, SystemConfig } from "../types";
import { DEFAULT_SETTINGS } from "../types";

export class SettingsService {
  // ── Get all settings for school ──
  static async getAll(
    schoolId: string,
    category?: SettingsCategory,
  ): Promise<SchoolSettings[]> {
    const supabase = await createServerClient();

    let query = supabase
      .from("school_settings")
      .select("*")
      .eq("school_id", schoolId)
      .order("category")
      .order("setting_key");

    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as SchoolSettings[];
  }

  // ── Get single setting ──
  static async get(schoolId: string, key: string): Promise<string | null> {
    const supabase = await createServerClient();

    const { data } = await supabase
      .from("school_settings")
      .select("setting_value")
      .eq("school_id", schoolId)
      .eq("setting_key", key)
      .maybeSingle();

    if (data) return data.setting_value;

    // Return default if exists
    const defaultValue = (DEFAULT_SETTINGS as any)[key];
    return defaultValue !== undefined ? String(defaultValue) : null;
  }

  // ── Set a setting ──
  static async set(
    schoolId: string,
    key: string,
    value: string,
    category: SettingsCategory = "general",
    description?: string,
    updatedBy?: string,
  ): Promise<{ success: boolean; message: string }> {
    const supabase = await createServerClient();

    // Upsert
    const { error } = await supabase.from("school_settings").upsert(
      {
        school_id: schoolId,
        setting_key: key,
        setting_value: value,
        category,
        description: description || null,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || null,
      },
      { onConflict: "school_id,setting_key" },
    );

    if (error) return { success: false, message: error.message };

    // Audit
    if (updatedBy) {
      await supabase.from("audit_logs").insert({
        table_name: "school_settings",
        record_id: key,
        action: "UPDATE",
        performed_by: updatedBy,
        changes_json: { key, value },
      });
    }

    return { success: true, message: "Setting updated" };
  }

  // ── Bulk update settings ──
  static async bulkUpdate(
    schoolId: string,
    settings: { setting_key: string; setting_value: string }[],
    updatedBy: string,
  ): Promise<{ success: boolean; message: string; updated: number }> {
    let updated = 0;

    for (const setting of settings) {
      const result = await this.set(
        schoolId,
        setting.setting_key,
        setting.setting_value,
        "general",
        undefined,
        updatedBy,
      );
      if (result.success) updated++;
    }

    return {
      success: true,
      message: `${updated} of ${settings.length} settings updated`,
      updated,
    };
  }

  // ── Get full config object ──
  static async getConfig(schoolId: string): Promise<SystemConfig> {
    const settings = await this.getAll(schoolId);
    const settingsMap = new Map(
      settings.map((s) => [s.setting_key, s.setting_value]),
    );

    const getVal = (key: string, defaultVal: any): any => {
      const val = settingsMap.get(key);
      if (val === undefined || val === null) return defaultVal;

      if (typeof defaultVal === "number") return Number(val);
      if (typeof defaultVal === "boolean") return val === "true";
      return val;
    };

    return {
      school_name: getVal("school_name", ""),
      school_type: getVal("school_type", "primary"),
      timezone: getVal("timezone", DEFAULT_SETTINGS.timezone),
      date_format: getVal("date_format", DEFAULT_SETTINGS.date_format),
      currency: getVal("currency", DEFAULT_SETTINGS.currency),
      grading_system: "cbc_4_point",
      attendance_threshold: getVal(
        "attendance_threshold",
        DEFAULT_SETTINGS.attendance_threshold,
      ),
      promotion_threshold: getVal(
        "promotion_threshold",
        DEFAULT_SETTINGS.promotion_threshold,
      ),
      max_class_size: getVal("max_class_size", DEFAULT_SETTINGS.max_class_size),
      attendance_cutoff_time: getVal(
        "attendance_cutoff_time",
        DEFAULT_SETTINGS.attendance_cutoff_time,
      ),
      late_threshold_minutes: getVal(
        "late_threshold_minutes",
        DEFAULT_SETTINGS.late_threshold_minutes,
      ),
      auto_notify_absence: getVal(
        "auto_notify_absence",
        DEFAULT_SETTINGS.auto_notify_absence,
      ),
      payment_reminder_days: getVal(
        "payment_reminder_days",
        DEFAULT_SETTINGS.payment_reminder_days,
      ),
      overdue_grace_days: getVal(
        "overdue_grace_days",
        DEFAULT_SETTINGS.overdue_grace_days,
      ),
      receipt_prefix: getVal("receipt_prefix", DEFAULT_SETTINGS.receipt_prefix),
      allow_parent_messaging: getVal(
        "allow_parent_messaging",
        DEFAULT_SETTINGS.allow_parent_messaging,
      ),
      max_broadcast_recipients: getVal(
        "max_broadcast_recipients",
        DEFAULT_SETTINGS.max_broadcast_recipients,
      ),
      notification_retention_days: getVal(
        "notification_retention_days",
        DEFAULT_SETTINGS.notification_retention_days,
      ),
      data_retention_years: getVal(
        "data_retention_years",
        DEFAULT_SETTINGS.data_retention_years,
      ),
      require_parent_consent: getVal(
        "require_parent_consent",
        DEFAULT_SETTINGS.require_parent_consent,
      ),
      audit_log_retention_days: getVal(
        "audit_log_retention_days",
        DEFAULT_SETTINGS.audit_log_retention_days,
      ),
      report_card_template: getVal(
        "report_card_template",
        DEFAULT_SETTINGS.report_card_template,
      ),
      include_attendance_in_report: getVal(
        "include_attendance_in_report",
        DEFAULT_SETTINGS.include_attendance_in_report,
      ),
      include_discipline_in_report: getVal(
        "include_discipline_in_report",
        DEFAULT_SETTINGS.include_discipline_in_report,
      ),
      principal_signature_url: getVal("principal_signature_url", undefined),
    } as SystemConfig;
  }

  // ── Initialize default settings for a new school ──
  static async initializeDefaults(
    schoolId: string,
    createdBy: string,
  ): Promise<void> {
    const categoryMap: Record<string, SettingsCategory> = {
      timezone: "general",
      date_format: "general",
      currency: "general",
      grading_system: "academic",
      attendance_threshold: "academic",
      promotion_threshold: "academic",
      max_class_size: "academic",
      attendance_cutoff_time: "attendance",
      late_threshold_minutes: "attendance",
      auto_notify_absence: "attendance",
      payment_reminder_days: "finance",
      overdue_grace_days: "finance",
      receipt_prefix: "finance",
      allow_parent_messaging: "communication",
      max_broadcast_recipients: "communication",
      notification_retention_days: "communication",
      data_retention_years: "compliance",
      require_parent_consent: "compliance",
      audit_log_retention_days: "compliance",
      report_card_template: "reporting",
      include_attendance_in_report: "reporting",
      include_discipline_in_report: "reporting",
    };

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (value !== undefined) {
        await this.set(
          schoolId,
          key,
          String(value),
          categoryMap[key] || "general",
          undefined,
          createdBy,
        );
      }
    }
  }
}
