// app/api/upload/route.ts
// ============================================================
// POST /api/upload - Uploads a file to Supabase storage
// Expects multipart/form-data with fields:
// - file: File
// - folder: string (optional, default: "uploads")
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { errorResponse } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const ALLOWED_FOLDERS = new Set(["students", "staff", "users", "exams", "uploads"]);
const STORAGE_BUCKET = "school-assets";

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const schoolId = user.schoolId || user.school_id;
    if (!schoolId) {
      return errorResponse("No school context available", 400);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const folderValue = formData.get("folder");
    const folder =
      typeof folderValue === "string" && ALLOWED_FOLDERS.has(folderValue)
        ? folderValue
        : "uploads";

    if (!file || !(file instanceof File)) {
      return errorResponse("No file uploaded", 400);
    }

    const fileExt = file.name.split(".").pop() || "bin";
    const safeExt = fileExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "bin";
    const fileName = `${schoolId}/${folder}/${crypto.randomUUID()}.${safeExt}`;

    const adminClient = await createSupabaseAdminClient();
    const { error: uploadError } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      return errorResponse(uploadError.message, 500);
    }

    const { data: urlData } = adminClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    return NextResponse.json(
      { success: true, data: { url: urlData.publicUrl }, url: urlData.publicUrl, error: null },
      { status: 200 },
    );
  } catch (error) {
    console.error("Upload API error:", error);
    return errorResponse("Internal server error", 500);
  }
});
