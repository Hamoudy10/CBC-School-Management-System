import { createHash } from "node:crypto";

type CloudinaryUploadInput = {
  file: File;
  schoolId: string;
  folder: string;
};

export type CloudinaryUploadResult =
  | {
      success: true;
      url: string;
      publicId: string;
      bytes: number;
      format?: string;
      resourceType?: string;
    }
  | {
      success: false;
      message: string;
    };

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

function sanitizeFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  const baseName = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
  return baseName.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildCloudinarySignature(params: Record<string, string>, apiSecret: string) {
  const sortedKeys = Object.keys(params).sort();
  const toSign = sortedKeys.map((key) => `${key}=${params[key]}`).join("&");
  return createHash("sha1")
    .update(`${toSign}${apiSecret}`)
    .digest("hex");
}

export function isCloudinaryConfigured() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

export async function uploadToCloudinary(
  input: CloudinaryUploadInput,
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    return {
      success: false,
      message: "Cloudinary is not configured.",
    };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = `${Date.now()}_${sanitizeFileName(input.file.name)}`;
    const folder = `school-management/${input.schoolId}/${input.folder}`;
    const signature = buildCloudinarySignature(
      {
        folder,
        public_id: publicId,
        timestamp,
      },
      CLOUDINARY_API_SECRET!,
    );

    const formData = new FormData();
    formData.append("file", input.file);
    formData.append("api_key", CLOUDINARY_API_KEY!);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);
    formData.append("folder", folder);
    formData.append("public_id", publicId);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        message:
          payload?.error?.message ||
          payload?.message ||
          "Failed to upload to Cloudinary.",
      };
    }

    if (!payload?.secure_url) {
      return {
        success: false,
        message: "Cloudinary upload did not return a public URL.",
      };
    }

    return {
      success: true,
      url: payload.secure_url,
      publicId: payload.public_id,
      bytes: payload.bytes ?? input.file.size,
      format: payload.format,
      resourceType: payload.resource_type,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unexpected Cloudinary upload error.",
    };
  }
}
