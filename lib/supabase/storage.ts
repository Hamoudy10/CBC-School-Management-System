import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || "school-assets";

// Allowed file types by category
export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ],
  report: ["application/pdf"],
  logo: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"],
  avatar: ["image/png", "image/jpeg", "image/webp"],
};

// Max file sizes by category (in bytes)
export const MAX_FILE_SIZES: Record<string, number> = {
  image: 5 * 1024 * 1024, // 5MB
  document: 20 * 1024 * 1024, // 20MB
  report: 10 * 1024 * 1024, // 10MB
  logo: 2 * 1024 * 1024, // 2MB
  avatar: 1 * 1024 * 1024, // 1MB
};

// File extension to MIME type mapping
const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

export function validateFile(
  fileName: string,
  fileSize: number,
  category: keyof typeof ALLOWED_FILE_TYPES = "document",
): { success: boolean; message?: string } {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = EXTENSION_TO_MIME[extension];

  if (!mimeType) {
    return { success: false, message: `Unsupported file type: .${extension}` };
  }

  const allowedTypes = ALLOWED_FILE_TYPES[category];
  if (!allowedTypes.includes(mimeType)) {
    return {
      success: false,
      message: `File type .${extension} is not allowed for ${category}. Allowed: ${allowedTypes.map((t) => t.split("/")[1]).join(", ")}`,
    };
  }

  const maxSize = MAX_FILE_SIZES[category];
  if (fileSize > maxSize) {
    return {
      success: false,
      message: `File size (${(fileSize / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size of ${(maxSize / 1024 / 1024).toFixed(0)}MB for ${category}.`,
    };
  }

  return { success: true };
}

export function generateStoragePath(
  schoolId: string,
  category: string,
  fileName: string,
): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${schoolId}/${category}/${timestamp}_${sanitized}`;
}

export async function ensureStorageBucket() {
  const adminClient = await createSupabaseAdminClient();
  const { data, error } = await adminClient.storage.getBucket(STORAGE_BUCKET);

  if (!error && data) {
    return { success: true as const, client: adminClient };
  }

  const missingBucket =
    !data &&
    (!error ||
      /not found/i.test(error.message) ||
      /does not exist/i.test(error.message));

  if (!missingBucket) {
    return {
      success: false as const,
      message: error?.message || "Failed to inspect storage bucket",
    };
  }

  const { error: createError } = await adminClient.storage.createBucket(
    STORAGE_BUCKET,
    {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024,
    },
  );

  if (
    createError &&
    !/already exists/i.test(createError.message) &&
    !/duplicate/i.test(createError.message)
  ) {
    return {
      success: false as const,
      message: createError.message,
    };
  }

  return { success: true as const, client: adminClient };
}

export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600,
): Promise<{ success: boolean; url?: string; message?: string }> {
  try {
    const adminClient = await createSupabaseAdminClient();
    const { data, error } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, url: data.signedUrl };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to generate signed URL",
    };
  }
}

export async function uploadFile(
  filePath: string,
  file: File | Blob,
  options?: {
    upsert?: boolean;
    contentType?: string;
  },
): Promise<{ success: boolean; path?: string; message?: string }> {
  try {
    const adminClient = await createSupabaseAdminClient();
    const { error } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        upsert: options?.upsert ?? false,
        contentType: options?.contentType,
      });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, path: filePath };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to upload file",
    };
  }
}

export async function deleteFile(
  filePath: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const adminClient = await createSupabaseAdminClient();
    const { error } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to delete file",
    };
  }
}
