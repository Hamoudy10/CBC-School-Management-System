// app/api/staff/[id]/leaves/[leaveId]/route.ts
// ============================================================
// GET /api/staff/[id]/leaves/[leaveId] - Get single leave request
// PATCH /api/staff/[id]/leaves/[leaveId] - Update leave status (approve/reject/cancel)
// ============================================================

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody, validateUuid } from '@/lib/api/validation';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import {
  listLeaves,
  updateLeaveStatus,
  updateLeaveStatusSchema,
} from '@/features/staff/server';

// ============================================================
// GET Handler - Get Single Leave Request
// ============================================================
export const GET = withPermission(
  'teachers',
  'view',
  async (request: NextRequest, { user, params }) => {
    try {
      const { id, leaveId } = params;

      // Validate UUID formats
      const staffIdValidation = validateUuid(id);
      if (!staffIdValidation.success) {
        return validationErrorResponse({ staffId: ['Invalid staff ID format'] });
      }

      const leaveIdValidation = validateUuid(leaveId);
      if (!leaveIdValidation.success) {
        return validationErrorResponse({ leaveId: ['Invalid leave ID format'] });
      }

      // Fetch the specific leave by filtering
      const result = await listLeaves(
        {
          staffId: id,
          page: 1,
          pageSize: 100, // Fetch enough to find the leave
        },
        user
      );

      // Find the specific leave
      const leave = result.data.find((l) => l.leaveId === leaveId);

      if (!leave) {
        return notFoundResponse('Leave request not found');
      }

      return successResponse(leave);
    } catch (error) {
      console.error('Error fetching leave:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to fetch leave request',
        500
      );
    }
  }
);

// ============================================================
// PATCH Handler - Update Leave Status
// ============================================================
export const PATCH = withPermission(
  'teachers',
  'update',
  async (request: NextRequest, { user, params }) => {
    try {
      const { id, leaveId } = params;

      // Validate UUID formats
      const staffIdValidation = validateUuid(id);
      if (!staffIdValidation.success) {
        return validationErrorResponse({ staffId: ['Invalid staff ID format'] });
      }

      const leaveIdValidation = validateUuid(leaveId);
      if (!leaveIdValidation.success) {
        return validationErrorResponse({ leaveId: ['Invalid leave ID format'] });
      }

      // Validate request body
      const validation = await validateBody(request, updateLeaveStatusSchema);
      if (!validation.success) {
        return validationErrorResponse(validation.errors!);
      }

      const data = validation.data!;

      // Call service function
      const result = await updateLeaveStatus(leaveId, data, user);

      if (!result.success) {
        // Determine appropriate status code
        let statusCode = 400;
        if (result.message.includes('not found')) {
          statusCode = 404;
        } else if (
          result.message.includes('Only administrators') ||
          result.message.includes('only cancel')
        ) {
          statusCode = 403;
        }
        return errorResponse(result.message, statusCode);
      }

      return successResponse({
        leaveId,
        status: data.status,
        message: result.message,
      });
    } catch (error) {
      console.error('Error updating leave status:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to update leave status',
        500
      );
    }
  }
);

// ============================================================
// PUT Handler - Alias for PATCH (full update of status)
// ============================================================
export const PUT = withPermission(
  'teachers',
  'update',
  async (request: NextRequest, { user, params }) => {
    try {
      const { id, leaveId } = params;

      // Validate UUID formats
      const staffIdValidation = validateUuid(id);
      if (!staffIdValidation.success) {
        return validationErrorResponse({ staffId: ['Invalid staff ID format'] });
      }

      const leaveIdValidation = validateUuid(leaveId);
      if (!leaveIdValidation.success) {
        return validationErrorResponse({ leaveId: ['Invalid leave ID format'] });
      }

      // Validate request body
      const validation = await validateBody(request, updateLeaveStatusSchema);
      if (!validation.success) {
        return validationErrorResponse(validation.errors!);
      }

      const data = validation.data!;

      // Call service function
      const result = await updateLeaveStatus(leaveId, data, user);

      if (!result.success) {
        let statusCode = 400;
        if (result.message.includes('not found')) {
          statusCode = 404;
        } else if (
          result.message.includes('Only administrators') ||
          result.message.includes('only cancel')
        ) {
          statusCode = 403;
        }
        return errorResponse(result.message, statusCode);
      }

      return successResponse({
        leaveId,
        status: data.status,
        message: result.message,
      });
    } catch (error) {
      console.error('Error updating leave status:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to update leave status',
        500
      );
    }
  }
);

