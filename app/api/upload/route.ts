// app/api/upload/route.ts
// ============================================================
// POST /api/upload - Uploads a file to Supabase storage
// Expects multipart/form-data with fields:
// - file: File
// - folder: string (optional, default: "uploads")
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { errorResponse, successResponse } from "@/lib/api/response";
import {
  ensureStorageBucket,
  STORAGE_BUCKET,
  validateFile,
  generateStoragePath,
  getSignedUrl,
} from "@/lib/supabase/storage";

const ALLOWED_FOLDERS = new Set([
  "students",
  "staff",
  "teachers",
  "users",
  "exams",
  "uploads",
  "reports",
  "logos",
]);

const FOLDER_TO_CATEGORY: Record<string, string> = {
  students: "image",
  staff: "image",
  teachers: "image",
  users: "avatar",
  exams: "document",
  uploads: "document",
  reports: "report",
  logos: "logo",
};

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

    // Validate file type and size
    const category = (FOLDER_TO_CATEGORY[folder] || "document") as Parameters<typeof validateFile>[2];
    const validation = validateFile(file.name, file.size, category);
    if (!validation.success) {
      return errorResponse(validation.message!, 400);
    }

    const normalizedFolder = folder === "teachers" ? "staff" : folder;
    const fileName = generateStoragePath(schoolId, normalizedFolder, file.name);

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

    // Generate signed URL for secure access
    const { url: signedUrl } = await getSignedUrl(fileName, 86400);
    const { data: urlData } = adminClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    return successResponse({
      url: urlData.publicUrl,
      signedUrl,
      path: fileName,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return errorResponse("Internal server error", 500);
  }
});
