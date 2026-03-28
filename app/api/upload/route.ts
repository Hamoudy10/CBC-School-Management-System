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
import { ensureStorageBucket, STORAGE_BUCKET } from "@/lib/supabase/storage";

const ALLOWED_FOLDERS = new Set([
  "students",
  "staff",
  "teachers",
  "users",
  "exams",
  "uploads",
]);

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
    const normalizedFolder = folder === "teachers" ? "staff" : folder;
    const fileName = `${schoolId}/${normalizedFolder}/${crypto.randomUUID()}.${safeExt}`;

    const storageSetup = await ensureStorageBucket();
    if (!storageSetup.success) {
      return errorResponse(
        `Storage setup failed: ${storageSetup.message}. Please ensure the "${STORAGE_BUCKET}" bucket is available.`,
        500,
      );
    }

    const { client: adminClient } = storageSetup;
    const { error: uploadError } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      return errorResponse(
        /bucket/i.test(uploadError.message)
          ? `Upload failed because the "${STORAGE_BUCKET}" storage bucket is unavailable.`
          : uploadError.message,
        500,
      );
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
