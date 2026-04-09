export const dynamic = 'force-dynamic';

// app/api/users/route.ts
// ============================================================
// GET /api/users - List users (paginated, filtered)
// POST /api/users - Create new user
// ============================================================

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  listUsers,
  createUser,
  userListFiltersSchema,
  createUserSchema,
} from "@/features/users";

// ============================================================
// GET Handler - List Users
// ============================================================
export const GET = withPermission(
  "users",
  "view",
  async (request, { user }) => {
    const { searchParams } = new URL(request.url);

    // Validate query params
    const validation = validateQuery(searchParams, userListFiltersSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const filters = validation.data!;
    const result = await listUsers(filters, user);

    return successResponse(result.data, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  },
);

// ============================================================
// POST Handler - Create User
// ============================================================
export const POST = withPermission(
  "users",
  "create",
  async (request, { user }) => {
    // Validate body
    const validation = await validateBody(request, createUserSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await createUser(validation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return createdResponse({
      userId: result.userId,
      message: result.message,
    });
  },
);
