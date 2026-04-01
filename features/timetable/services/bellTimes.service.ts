// features/timetable/services/bellTimes.service.ts
// ============================================================
// Bell Times CRUD service
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";

export interface BellTime {
  bellTimeId: string;
  schoolId: string;
  name: string;
  startTime: string;
  endTime: string;
  periodOrder: number;
  isBreak: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBellTimeInput {
  name: string;
  startTime: string;
  endTime: string;
  periodOrder: number;
  isBreak?: boolean;
}

export interface UpdateBellTimeInput {
  name?: string;
  startTime?: string;
  endTime?: string;
  periodOrder?: number;
  isBreak?: boolean;
  isActive?: boolean;
}

function normalizeRow(row: any): BellTime {
  return {
    bellTimeId: row.bell_time_id,
    schoolId: row.school_id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    periodOrder: row.period_order,
    isBreak: row.is_break,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBellTimes(currentUser: AuthUser): Promise<BellTime[]> {
  if (!currentUser.schoolId) {
    throw new Error("School context is required.");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("bell_times")
    .select("*")
    .eq("school_id", currentUser.schoolId)
    .eq("is_active", true)
    .order("period_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load bell times: ${error.message}`);
  }

  return (data ?? []).map(normalizeRow);
}

export async function getBellTimeById(
  id: string,
  currentUser: AuthUser,
): Promise<BellTime | null> {
  if (!currentUser.schoolId) {
    throw new Error("School context is required.");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("bell_times")
    .select("*")
    .eq("bell_time_id", id)
    .eq("school_id", currentUser.schoolId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeRow(data);
}

export async function createBellTime(
  payload: CreateBellTimeInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; bellTimeId?: string }> {
  if (!currentUser.schoolId) {
    return { success: false, message: "School context is required." };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("bell_times")
    .insert({
      school_id: currentUser.schoolId,
      name: payload.name,
      start_time: payload.startTime,
      end_time: payload.endTime,
      period_order: payload.periodOrder,
      is_break: payload.isBreak ?? false,
      is_active: true,
    })
    .select("bell_time_id")
    .single();

  if (error) {
    return { success: false, message: `Failed to create bell time: ${error.message}` };
  }

  return {
    success: true,
    message: "Bell time created successfully.",
    bellTimeId: data.bell_time_id,
  };
}

export async function updateBellTime(
  id: string,
  payload: UpdateBellTimeInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  if (!currentUser.schoolId) {
    return { success: false, message: "School context is required." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("bell_times")
    .select("bell_time_id")
    .eq("bell_time_id", id)
    .eq("school_id", currentUser.schoolId)
    .maybeSingle();

  if (!existing) {
    return { success: false, message: "Bell time not found." };
  }

  const updateData: Record<string, unknown> = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.startTime !== undefined) updateData.start_time = payload.startTime;
  if (payload.endTime !== undefined) updateData.end_time = payload.endTime;
  if (payload.periodOrder !== undefined) updateData.period_order = payload.periodOrder;
  if (payload.isBreak !== undefined) updateData.is_break = payload.isBreak;
  if (payload.isActive !== undefined) updateData.is_active = payload.isActive;

  const { error } = await supabase
    .from("bell_times")
    .update(updateData)
    .eq("bell_time_id", id)
    .eq("school_id", currentUser.schoolId);

  if (error) {
    return { success: false, message: `Failed to update bell time: ${error.message}` };
  }

  return { success: true, message: "Bell time updated successfully." };
}

export async function deleteBellTime(
  id: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  if (!currentUser.schoolId) {
    return { success: false, message: "School context is required." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("bell_times")
    .select("bell_time_id")
    .eq("bell_time_id", id)
    .eq("school_id", currentUser.schoolId)
    .maybeSingle();

  if (!existing) {
    return { success: false, message: "Bell time not found." };
  }

  const { error } = await supabase
    .from("bell_times")
    .update({ is_active: false })
    .eq("bell_time_id", id)
    .eq("school_id", currentUser.schoolId);

  if (error) {
    return { success: false, message: `Failed to delete bell time: ${error.message}` };
  }

  return { success: true, message: "Bell time deactivated successfully." };
}

export async function resetToDefaults(
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  if (!currentUser.schoolId) {
    return { success: false, message: "School context is required." };
  }

  const supabase = await createSupabaseServerClient();

  // Deactivate all existing bell times
  await supabase
    .from("bell_times")
    .update({ is_active: false })
    .eq("school_id", currentUser.schoolId);

  // Insert default bell times
  const defaults = [
    { name: "Assembly", start_time: "07:45", end_time: "08:00", period_order: 1, is_break: false },
    { name: "Period 1", start_time: "08:00", end_time: "08:40", period_order: 2, is_break: false },
    { name: "Period 2", start_time: "08:40", end_time: "09:20", period_order: 3, is_break: false },
    { name: "Break Time", start_time: "09:20", end_time: "09:40", period_order: 4, is_break: true },
    { name: "Period 3", start_time: "09:40", end_time: "10:20", period_order: 5, is_break: false },
    { name: "Period 4", start_time: "10:20", end_time: "11:00", period_order: 6, is_break: false },
    { name: "Lunch Break", start_time: "11:00", end_time: "11:40", period_order: 7, is_break: true },
    { name: "Period 5", start_time: "11:40", end_time: "12:20", period_order: 8, is_break: false },
    { name: "Period 6", start_time: "12:20", end_time: "13:00", period_order: 9, is_break: false },
    { name: "Period 7", start_time: "13:00", end_time: "13:40", period_order: 10, is_break: false },
    { name: "End of Day", start_time: "13:40", end_time: "14:00", period_order: 11, is_break: false },
  ];

  const { error } = await supabase
    .from("bell_times")
    .insert(
      defaults.map((d) => ({
        school_id: currentUser.schoolId,
        ...d,
        is_active: true,
      })),
    );

  if (error) {
    return { success: false, message: `Failed to reset bell times: ${error.message}` };
  }

  return { success: true, message: "Bell times reset to defaults." };
}
