export const dynamic = 'force-dynamic';

// app/api/settings/logo/route.ts
// POST upload school logo

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { uploadSchoolLogo } from "@/features/settings/services/school.service";

export const POST = withPermission(
  { module: "settings", action: "edit" },
  async (req: NextRequest, user) => {
    try {
      const formData = await req.formData();
      const file = formData.get("logo") as File | null;

      if (!file) {
        return apiError("Logo file is required", 422);
      }

      // Validate file type
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/svg+xml",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        return apiError(
          "Only PNG, JPEG, SVG, and WebP images are allowed",
          422,
        );
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        return apiError("Logo file must be under 2MB", 422);
      }

      const result = await uploadSchoolLogo(user.school_id, file);

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess({ url: result.url }, result.message);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
