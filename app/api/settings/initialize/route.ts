export const dynamic = 'force-dynamic';

// app/api/settings/initialize/route.ts
// GET /api/settings/initialize — Returns default/seed settings for a school
// Useful for populating settings forms with sensible defaults
// POST deprecated — use POST /api/settings/batch to actually update settings

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getSchoolSettings } from "@/features/settings/services/school.service";

export const GET = withPermission(
  "settings",
  "view",
  async (_req: NextRequest, user: any) => {
    try {
      const result = await getSchoolSettings(user.school_id);
      if (!result.success) {
        return errorResponse(result.message || "Failed to fetch school settings", 400);
      }

      return successResponse(
        { settings: result.data, message: "School settings retrieved" },
      );
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);

// POST is now a deprecation alias — redirects to GET
export const POST = withPermission(
  "settings",
  "create",
  async (req: NextRequest, user: any) => {
    // Redirect to GET — use /api/settings/batch for actual updates
    const url = new URL(req.url);
    url.pathname = "/api/settings/initialize";
    return Response.redirect(url, 307);
  },
);
