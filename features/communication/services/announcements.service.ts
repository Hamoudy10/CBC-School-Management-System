// features/communication/services/announcements.service.ts
// School announcements service

import { createClient } from "@/lib/supabase/client";
import type { Announcement } from "../types";
import type {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from "../validators/communication.schema";

const supabase = createClient();

export async function createAnnouncement(
  input: CreateAnnouncementInput,
  createdBy: string,
  schoolId: string,
): Promise<{ success: boolean; id?: string; message: string }> {
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      title: input.title,
      body: input.body,
      category: input.category || "general",
      priority: input.priority || "normal",
      target_roles: input.target_roles || null,
      target_classes: input.target_classes || null,
      publish_date: input.publish_date,
      expiry_date: input.expiry_date || null,
      is_active: true,
      created_by: createdBy,
      school_id: schoolId,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, id: data.id, message: "Announcement created" };
}

export async function updateAnnouncement(
  announcementId: string,
  input: UpdateAnnouncementInput,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.body !== undefined) updateData.body = input.body;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.target_roles !== undefined)
    updateData.target_roles = input.target_roles;
  if (input.target_classes !== undefined)
    updateData.target_classes = input.target_classes;
  if (input.publish_date !== undefined)
    updateData.publish_date = input.publish_date;
  if (input.expiry_date !== undefined)
    updateData.expiry_date = input.expiry_date;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;

  const { error } = await supabase
    .from("announcements")
    .update(updateData)
    .eq("id", announcementId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Announcement updated" };
}

export async function deleteAnnouncement(
  announcementId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("announcements")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", announcementId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Announcement deactivated" };
}

export async function getAnnouncements(
  schoolId: string,
  filters?: {
    category?: string;
    is_active?: boolean;
    target_role?: string;
  },
  page: number = 1,
  pageSize: number = 20,
): Promise<{
  success: boolean;
  data: Announcement[];
  total: number;
  message?: string;
}> {
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("announcements")
    .select(
      `
      *,
      author:users!created_by(first_name, last_name)
    `,
      { count: "exact" },
    )
    .eq("school_id", schoolId);

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  if (filters?.is_active !== undefined) {
    query = query.eq("is_active", filters.is_active);
  } else {
    query = query.eq("is_active", true);
  }

  // Filter by publish date - only show published
  const today = new Date().toISOString().split("T")[0];
  query = query.lte("publish_date", today);

  // Exclude expired
  query = query.or(`expiry_date.is.null,expiry_date.gte.${today}`);

  if (filters?.target_role) {
    query = query.or(
      `target_roles.is.null,target_roles.cs.{${filters.target_role}}`,
    );
  }

  const { data, error, count } = await query
    .order("priority", { ascending: true })
    .order("publish_date", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return { success: false, data: [], total: 0, message: error.message };
  }

  return {
    success: true,
    data: (data || []) as unknown as Announcement[],
    total: count || 0,
  };
}

export async function getAnnouncementById(
  announcementId: string,
  schoolId: string,
): Promise<{ success: boolean; data?: Announcement; message?: string }> {
  const { data, error } = await supabase
    .from("announcements")
    .select(
      `
      *,
      author:users!created_by(first_name, last_name)
    `,
    )
    .eq("id", announcementId)
    .eq("school_id", schoolId)
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, data: data as unknown as Announcement };
}
