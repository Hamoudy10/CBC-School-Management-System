import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { waiveFee } from "@/features/finance";

const paramsSchema = z.object({
  id: z.string().uuid("Invalid student fee ID"),
});

const waiveFeeRequestSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500),
});

export const POST = withPermission(
  "finance",
  "approve",
  async (
    request: NextRequest,
    { user, params }: { user: any; params: { id: string } },
  ) => {
    const parsedParams = paramsSchema.safeParse(params);

    if (!parsedParams.success) {
      return errorResponse("Invalid student fee ID", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const parsedBody = waiveFeeRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return validationErrorResponse(
        parsedBody.error.errors.reduce<Record<string, string[]>>(
          (acc, error) => {
            const key = error.path.join(".") || "reason";
            acc[key] = [...(acc[key] ?? []), error.message];
            return acc;
          },
          {},
        ),
      );
    }

    const result = await waiveFee(parsedParams.data.id, parsedBody.data.reason, user);

    if (!result.success) {
      return errorResponse(result.message, 400);
    }

    return successResponse(
      {
        studentFeeId: parsedParams.data.id,
      },
      200,
    );
  },
);
