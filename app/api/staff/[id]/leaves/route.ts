// @ts-nocheck
// app/api/staff/[id]/leaves/route.ts
// ============================================================
// GET /api/staff/[id]/leaves - List leave requests for a staff member
// POST /api/staff/[id]/leaves - Create a new leave request
// ============================================================

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody, validateQuery, validateUuid } from '@/lib/api/validation';
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import {
  listLeaves,
  createLeave,
  leaveListFiltersSchema,
  createLeaveSchema,
} from '@/features/staff/server';

// ============================================================
// GET Handler - List Leaves for Staff Member
// ============================================================
export const GET = withPermission(
  'teachers',
  'view',
  async (request: NextRequest, { user, params }) => {
    try {
      const { id } = params;

      // Validate UUID format
      const uuidValidation = validateUuid(id);
      if (!uuidValidation.success) {
        return validationErrorResponse(uuidValidation.errors!);
      }

      const { searchParams } = new URL(request.url);

      // Validate query parameters
      const validation = validateQuery(searchParams, leaveListFiltersSchema);
      if (!validation.success) {
        return validationErrorResponse(validation.errors!);
      }

      // Merge staffId from path into filters
      const filters = {
        ...validation.data!,
        staffId: id,
      };

      // Call service function
      const result = await listLeaves(filters, user);

      return successResponse(result.data, {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      console.error('Error listing leaves:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to list leave requests',
        500
      );
    }
  }
);

// ============================================================
// POST Handler - Create Leave Request
// ============================================================
export const POST = withPermission(
  'teachers',
  'view', // Staff can view themselves and create their own leaves
  async (request: NextRequest, { user, params }) => {
    try {
      const { id } = params;

      // Validate UUID format
      const uuidValidation = validateUuid(id);
      if (!uuidValidation.success) {
        return validationErrorResponse(uuidValidation.errors!);
      }

      // Validate request body
      const validation = await validateBody(request, createLeaveSchema);
      if (!validation.success) {
        return validationErrorResponse(validation.errors!);
      }

      const data = validation.data!;

      // Call service function
      const result = await createLeave(id, data, user);

      if (!result.success) {
        // Determine appropriate status code
        const statusCode = result.message.includes('not found')
          ? 404
          : result.message.includes('only submit')
            ? 403
            : 400;
        return errorResponse(result.message, statusCode);
      }

      return createdResponse({
        leaveId: result.leaveId,
        message: result.message,
      });
    } catch (error) {
      console.error('Error creating leave:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to create leave request',
        500
      );
    }
  }
);

