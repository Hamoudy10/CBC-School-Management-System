// @ts-nocheck
// app/api/staff/route.ts
// ============================================================
// GET /api/staff - List staff members (paginated, filtered)
// POST /api/staff - Create new staff member
// ============================================================

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody, validateQuery } from '@/lib/api/validation';
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import {
  listStaff,
  createStaff,
  staffListFiltersSchema,
  createStaffSchema,
} from '@/features/staff';

// ============================================================
// GET Handler - List Staff
// ============================================================
export const GET = withPermission(
  'staff',
  'view',
  async (request: NextRequest, { user }) => {
    try {
      const { searchParams } = new URL(request.url);

      // Validate query parameters
      const validation = validateQuery(searchParams, staffListFiltersSchema);
      if (!validation.success) {
        return validationErrorResponse(validation.errors!);
      }

      const filters = validation.data!;

      // Call service function
      const result = await listStaff(filters, user);

      return successResponse(result.data, {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      console.error('Error listing staff:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to list staff members',
        500
      );
    }
  }
);

// ============================================================
// POST Handler - Create Staff
// ============================================================
export const POST = withPermission(
  'staff',
  'create',
  async (request: NextRequest, { user }) => {
    try {
      // Validate request body
      const validation = await validateBody(request, createStaffSchema);
      if (!validation.success) {
        return validationErrorResponse(validation.errors!);
      }

      const data = validation.data!;

      // Call service function
      const result = await createStaff(data, user);

      if (!result.success) {
        return errorResponse(result.message, 400);
      }

      return createdResponse({
        staffId: result.staffId,
        message: result.message,
      });
    } catch (error) {
      console.error('Error creating staff:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to create staff member',
        500
      );
    }
  }
);
