// @ts-nocheck
// app/api/staff/[id]/assignments/[assignmentId]/route.ts
// ============================================================
// GET /api/staff/[id]/assignments/[assignmentId] - Get single assignment
// DELETE /api/staff/[id]/assignments/[assignmentId] - Remove assignment (soft delete)
// ============================================================

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateUuid } from '@/lib/api/validation';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  noContentResponse,
} from '@/lib/api/response';
import {
  listAssignments,
  deleteAssignment,
} from '@/features/staff';

// ============================================================
// GET Handler - Get Single Assignment
// ============================================================
export const GET = withPermission(
  'teachers',
  'view',
  async (request: NextRequest, { user, params }) => {
    try {
      const { id, assignmentId } = params;

      // Validate UUID formats
      const staffIdValidation = validateUuid(id);
      if (!staffIdValidation.success) {
        return validationErrorResponse({ staffId: ['Invalid staff ID format'] });
      }

      const assignmentIdValidation = validateUuid(assignmentId);
      if (!assignmentIdValidation.success) {
        return validationErrorResponse({ assignmentId: ['Invalid assignment ID format'] });
      }

      // Fetch all assignments for the staff member
      const assignments = await listAssignments(id, user);

      // Find the specific assignment
      const assignment = assignments.find((a) => a.id === assignmentId);

      if (!assignment) {
        return notFoundResponse('Subject assignment not found');
      }

      return successResponse(assignment);
    } catch (error) {
      console.error('Error fetching assignment:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to fetch subject assignment',
        500
      );
    }
  }
);

// ============================================================
// DELETE Handler - Remove Assignment (Soft Delete)
// ============================================================
export const DELETE = withPermission(
  'teachers',
  'update',
  async (request: NextRequest, { user, params }) => {
    try {
      const { id, assignmentId } = params;

      // Validate UUID formats
      const staffIdValidation = validateUuid(id);
      if (!staffIdValidation.success) {
        return validationErrorResponse({ staffId: ['Invalid staff ID format'] });
      }

      const assignmentIdValidation = validateUuid(assignmentId);
      if (!assignmentIdValidation.success) {
        return validationErrorResponse({ assignmentId: ['Invalid assignment ID format'] });
      }

      // Verify the assignment belongs to this staff member
      const assignments = await listAssignments(id, user);
      const assignment = assignments.find((a) => a.id === assignmentId);

      if (!assignment) {
        return notFoundResponse('Subject assignment not found');
      }

      // Call service function
      const result = await deleteAssignment(assignmentId, user);

      if (!result.success) {
        const statusCode = result.message.includes('not found') ? 404 : 400;
        return errorResponse(result.message, statusCode);
      }

      // Return 204 No Content for successful deletion
      return noContentResponse();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to delete subject assignment',
        500
      );
    }
  }
);

