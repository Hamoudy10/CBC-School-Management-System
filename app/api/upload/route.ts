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
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    let storageClient: any;
    if (storageSetup.success) {
      storageClient = storageSetup.client;
    } else {
      // Fall back to server client if admin client (service role key) unavailable
      storageClient = await createSupabaseServerClient();
    }

    const { error: uploadError } = await storageClient.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: contentType || "application/octet-stream",
      });

    if (uploadError) {
      console.error("[upload] Storage upload error:", uploadError);
      return errorResponse(
        /bucket/i.test(uploadError.message)
          ? `Upload failed: the "${STORAGE_BUCKET}" bucket may not exist. Create it in Supabase dashboard (Storage -> New Bucket -> Name: "${STORAGE_BUCKET}", Public).`
          : uploadError.message,
        500,
      );
    }

    const { data: urlData } = storageClient.storage
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
