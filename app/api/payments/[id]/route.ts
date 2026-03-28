import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  getPaymentReceiptDetails,
  refundPayment,
  refundPaymentSchema,
  updatePayment,
  updatePaymentSchema,
} from "@/features/finance";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const GET = withAuth(
  async (
    _request: NextRequest,
    { user, params }: { user: any; params: { id: string } },
  ) => {
    const parsedParams = paramsSchema.safeParse(params);

    if (!parsedParams.success) {
      return errorResponse("Invalid payment ID", 400);
    }

    const payment = await getPaymentReceiptDetails(parsedParams.data.id, user);

    if (!payment) {
      return errorResponse("Payment not found", 404);
    }

    return successResponse(payment);
  },
);

export const PUT = withPermission(
  "finance",
  "update",
  async (
    request: NextRequest,
    { user, params }: { user: any; params: { id: string } },
  ) => {
    const parsedParams = paramsSchema.safeParse(params);

    if (!parsedParams.success) {
      return errorResponse("Invalid payment ID", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const parsedBody = updatePaymentSchema.safeParse(body);

    if (!parsedBody.success) {
      return validationErrorResponse(
        parsedBody.error.errors.reduce<Record<string, string[]>>(
          (acc, error) => {
            const key = error.path.join(".") || "payment";
            acc[key] = [...(acc[key] ?? []), error.message];
            return acc;
          },
          {},
        ),
      );
    }

    const result = await updatePayment(parsedParams.data.id, parsedBody.data, user);

    if (!result.success) {
      return errorResponse(result.message, 400);
    }

    return successResponse({ paymentId: parsedParams.data.id });
  },
);

export const POST = withPermission(
  "finance",
  "approve",
  async (
    request: NextRequest,
    { user, params }: { user: any; params: { id: string } },
  ) => {
    const parsedParams = paramsSchema.safeParse(params);

    if (!parsedParams.success) {
      return errorResponse("Invalid payment ID", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const parsedBody = refundPaymentSchema.safeParse(body);

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

    const result = await refundPayment(parsedParams.data.id, parsedBody.data.reason, user);

    if (!result.success) {
      return errorResponse(result.message, 400);
    }

    return successResponse({ paymentId: parsedParams.data.id });
  },
);
