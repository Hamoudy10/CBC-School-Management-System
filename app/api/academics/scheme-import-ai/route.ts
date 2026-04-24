export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { parseSchemeWithAI } from "@/features/academics/services/schemeImportAi.service";

const importSchema = z.object({
  textContent: z
    .string()
    .min(100, "Scheme text must contain at least 100 characters"),
  importToDatabase: z.boolean().optional().default(true),
});

export const POST = withPermission(
  "academics",
  "create",
  async (request: NextRequest, { user }) => {
    const validation = await validateBody(request, importSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await parseSchemeWithAI({
      textContent: validation.data!.textContent,
      importToDatabase: validation.data!.importToDatabase,
      user,
    });

    if (!result.success) {
      return errorResponse(result.error ?? "Failed to parse scheme.", result.status);
    }

    return successResponse(result.data!);
  },
);
