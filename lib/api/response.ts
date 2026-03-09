// lib/api/response.ts
// ============================================================
// Standardized API Response Helpers
// All API routes use these for consistent response format:
// { success: boolean, data: any | null, error: string | null, meta?: object }
// ============================================================

import { NextResponse } from "next/server";

// ============================================================
// Response Types
// ============================================================
export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
  message?: string;
  details?: Record<string, string[]>;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

// ============================================================
// Success Responses
// ============================================================
export function successResponse<T>(
  data: T,
  metaOrStatus?: PaginationMeta | number,
  status = 200,
): NextResponse<ApiResponse<T>> {
  const resolvedStatus =
    typeof metaOrStatus === "number" ? metaOrStatus : status;
  const meta = typeof metaOrStatus === "number" ? undefined : metaOrStatus;

  return NextResponse.json(
    {
      success: true,
      data,
      error: null,
      ...(meta && { meta }),
    },
    { status: resolvedStatus },
  );
}

export function createdResponse<T>(
  data: T,
  message?: string,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      error: null,
      message,
    },
    { status: 201 },
  );
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ============================================================
// Error Responses
// ============================================================
export function errorResponse(
  message: string,
  status = 400,
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status },
  );
}

export function unauthorizedResponse(
  message = "Authentication required",
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status: 401 },
  );
}

export function forbiddenResponse(
  message = "Insufficient permissions",
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status: 403 },
  );
}

export function notFoundResponse(
  message = "Resource not found",
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status: 404 },
  );
}

export function validationErrorResponse(
  errors: Record<string, string[]>,
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: "Validation failed",
      details: errors,
    },
    { status: 422 },
  );
}

export function serverErrorResponse(
  message = "Internal server error",
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status: 500 },
  );
}

export function rateLimitResponse(
  message = "Too many requests. Please try again later.",
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status: 429 },
  );
}

// ============================================================
// Legacy compatibility aliases (used across older route files)
// ============================================================
export function apiSuccess<T>(
  data: T,
  message?: string,
  status = 200,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      error: null,
      ...(message ? { message } : {}),
    },
    { status },
  );
}

export function apiError(
  error: unknown,
  status = 400,
): NextResponse<ApiResponse<null>> {
  return errorResponse(String(error ?? "Request failed"), status);
}

export function apiPaginated<T>(
  data: T,
  total: number,
  page: number,
  pageSize: number,
  status = 200,
): NextResponse<ApiResponse<T>> {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return successResponse(
    data,
    {
      page,
      pageSize,
      total,
      totalPages,
    },
    status,
  );
}

export function paginatedResponse<T>(
  data: T,
  metaOrTotal: PaginationMeta | number,
  page?: number,
  pageSize?: number,
  status = 200,
): NextResponse<ApiResponse<T>> {
  if (
    typeof metaOrTotal === "number" &&
    page === undefined &&
    pageSize === undefined &&
    metaOrTotal >= 100 &&
    metaOrTotal <= 599
  ) {
    return successResponse(data, undefined, metaOrTotal);
  }

  if (typeof metaOrTotal === "number") {
    const resolvedPage = page ?? 1;
    const resolvedPageSize = pageSize ?? 20;
    return apiPaginated(data, metaOrTotal, resolvedPage, resolvedPageSize, status);
  }

  return successResponse(
    data,
    {
      page: metaOrTotal.page ?? 1,
      pageSize: metaOrTotal.pageSize ?? 20,
      total: metaOrTotal.total ?? 0,
      totalPages:
        metaOrTotal.totalPages ??
        Math.max(
          1,
          Math.ceil((metaOrTotal.total ?? 0) / Math.max(1, metaOrTotal.pageSize ?? 20)),
        ),
    },
    status,
  );
}
