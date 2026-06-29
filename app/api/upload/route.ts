export const dynamic = 'force-dynamic';

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
import { rateLimit } from "@/lib/api/rateLimit";
import {
  ensureStorageBucket,
  STORAGE_BUCKET,
  validateFile,
  generateStoragePath,
  EXTENSION_TO_MIME,
} from "@/lib/supabase/storage";
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
} from "@/lib/uploads/cloudinary";

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

function uploadSuccess(payload: {
  url: string;
  path: string;
  size: number;
  type: string;
  provider: "supabase" | "cloudinary";
}) {
  return NextResponse.json(
    {
      success: true,
      error: null,
      data: payload,
      // Backward compatibility for older clients reading top-level fields.
      ...payload,
    },
    { status: 200 },
  );
}

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const rl = rateLimit(`upload:${user.id}`, 30, 60);
    if (!rl.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rl.retryAfter} seconds.`,
        429,
      );
    }

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

    // Validate file type, size, and content signature
    const category = (FOLDER_TO_CATEGORY[folder] || "document") as Parameters<typeof validateFile>[2];
    const fileBuffer = await file.arrayBuffer();
    const validation = validateFile(file.name, file.size, category, fileBuffer);
    if (!validation.success) {
      return errorResponse(validation.message!, 400);
    }

    const normalizedFolder = folder === "teachers" ? "staff" : folder;
    if (isCloudinaryConfigured()) {
      const cloudinaryResult = await uploadToCloudinary({
        file,
        schoolId,
        folder: normalizedFolder,
      });

      if (cloudinaryResult.success) {
        return uploadSuccess({
          url: cloudinaryResult.url,
          path: cloudinaryResult.publicId,
          size: cloudinaryResult.bytes,
          type: file.type,
          provider: "cloudinary",
        });
      }
    }

    const fileName = generateStoragePath(schoolId, normalizedFolder, file.name);
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = EXTENSION_TO_MIME[extension] || "application/octet-stream";

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
        contentType: contentType || "application/octet-stream",
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

    return uploadSuccess({
      url: urlData.publicUrl,
      path: fileName,
      size: file.size,
      type: contentType,
      provider: "supabase",
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return errorResponse("Internal server error", 500);
  }
});
