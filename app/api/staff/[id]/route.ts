// app/api/staff/[id]/route.ts
// ============================================================
// GET /api/staff/[id] - Get single staff member
// PUT /api/staff/[id] - Update staff member
// DELETE /api/staff/[id] - Deactivate staff member (soft delete)
// ============================================================

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody, validateUuid } from '@/lib/api/validation';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  noContentResponse,
} from '@/lib/api/response';
import {
  getStaffById,
  getStaffDetail,
  updateStaff,
  deactivateStaff,
  updateStaffSchema,
} from '@/features/staff/server';

// ============================================================
// GET Handler - Get Single Staff Member
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

      // Check if detailed view is requested
      const { searchParams } = new URL(request.url);
      const detailed = searchParams.get('detailed') === 'true';

      // Call appropriate service function
      const staff = detailed
        ? await getStaffDetail(id, user)
        : await getStaffById(id, user);

      if (!staff) {
        return notFoundResponse('Staff member not found');
      }

      return successResponse(staff);
    } catch (error) {
      console.error('Error fetching staff:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to fetch staff member',
        500
      );
    }
  }
);

// ============================================================
// PUT Handler - Update Staff Member
// ============================================================
export const PUT = withPermission(
  'teachers',
  'update',
  async (request: NextRequest, { user, params }) => {
    try {
      const { id } = params;

      // Validate UUID format
      const uuidValidation = validateUuid(id);
      if (!uuidValidation.success) {
        return validationErrorResponse(uuidValidation.errors!);
      }

      // Validate request body
      const validation = await validateBody(request, updateStaffSchema);
      if (!validation.success) {
        return validationErrorResponse(validation.errors!);
      }

      const data = validation.data!;

      // Check if there's anything to update
      if (Object.keys(data).length === 0) {
        return errorResponse('No fields provided for update', 400);
      }

      // Call service function
      const result = await updateStaff(id, data, user);

      if (!result.success) {
        // Determine appropriate status code
        const statusCode = result.message.includes('not found') ? 404 : 400;
        return errorResponse(result.message, statusCode);
      }

      return successResponse({
        staffId: id,
        message: result.message,
      });
    } catch (error) {
      console.error('Error updating staff:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to update staff member',
        500
      );
    }
  }
);

// ============================================================
// PATCH Handler - Partial Update (alias for PUT)
// ============================================================
export const PATCH = withPermission(
  'teachers',
  'update',
  async (request: NextRequest, { user, params }) => {
    try {
      const { id } = params;

      // Validate UUID format
      const uuidValidation = validateUuid(id);
      if (!uuidValidation.success) {
        return validationErrorResponse(uuidValidation.errors!);
      }

      // Validate request body
      const validation = await validateBody(request, updateStaffSchema);
      if (!validation.success) {
        return validationErrorResponse(validation.errors!);
      }

      const data = validation.data!;

      // Call service function
      const result = await updateStaff(id, data, user);

      if (!result.success) {
        const statusCode = result.message.includes('not found') ? 404 : 400;
        return errorResponse(result.message, statusCode);
      }

      return successResponse({
        staffId: id,
        message: result.message,
      });
    } catch (error) {
      console.error('Error updating staff:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to update staff member',
        500
      );
    }
  }
);

// ============================================================
// DELETE Handler - Deactivate Staff Member (Soft Delete)
// ============================================================
export const DELETE = withPermission(
  'teachers',
  'delete',
  async (request: NextRequest, { user, params }) => {
    try {
      const { id } = params;

      // Validate UUID format
      const uuidValidation = validateUuid(id);
      if (!uuidValidation.success) {
        return validationErrorResponse(uuidValidation.errors!);
      }

      // Call service function
      const result = await deactivateStaff(id, user);

      if (!result.success) {
        // Determine appropriate status code
        const statusCode = result.message.includes('not found')
          ? 404
          : result.message.includes('cannot')
            ? 403
            : 400;
        return errorResponse(result.message, statusCode);
      }

      // Return 204 No Content for successful deletion
      return noContentResponse();
    } catch (error) {
      console.error('Error deactivating staff:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to deactivate staff member',
        500
      );
    }
  }
);

