// @ts-nocheck
// app/api/staff/[id]/assignments/route.ts
// ============================================================
// GET /api/staff/[id]/assignments - List subject assignments for a teacher
// POST /api/staff/[id]/assignments - Create new subject assignment
// ============================================================

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody, validateUuid } from '@/lib/api/validation';
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import {
  listAssignments,
  createAssignment,
  createAssignmentSchema,
  bulkAssignmentSchema,
} from '@/features/staff';

// ============================================================
// GET Handler - List Subject Assignments
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

      // Call service function
      const assignments = await listAssignments(id, user);

      return successResponse(assignments, {
        page: 1,
        pageSize: assignments.length,
        total: assignments.length,
        totalPages: 1,
      });
    } catch (error) {
      console.error('Error listing assignments:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to list subject assignments',
        500
      );
    }
  }
);

// ============================================================
// POST Handler - Create Subject Assignment(s)
// ============================================================
export const POST = withPermission(
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

      // Parse request body
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return validationErrorResponse({ body: ['Invalid JSON'] });
      }

      // Check if this is a bulk assignment or single assignment
      const isBulk = body && typeof body === 'object' && 'assignments' in body;

      if (isBulk) {
        // Validate bulk assignment schema
        const validation = validateBody(body, bulkAssignmentSchema);
        if (!validation.success) {
          return validationErrorResponse(validation.errors!);
        }

        const { assignments } = validation.data!;

        // Process each assignment
        const results: Array<{
          success: boolean;
          assignmentId?: string;
          error?: string;
          input: typeof assignments[0];
        }> = [];

        let successCount = 0;
        let errorCount = 0;

        for (const assignment of assignments) {
          const result = await createAssignment(id, assignment, user);

          if (result.success) {
            successCount++;
            results.push({
              success: true,
              assignmentId: result.assignmentId,
              input: assignment,
            });
          } else {
            errorCount++;
            results.push({
              success: false,
              error: result.message,
              input: assignment,
            });
          }
        }

        // Determine overall status
        if (errorCount === 0) {
          return createdResponse({
            message: `All ${successCount} assignment(s) created successfully.`,
            totalCreated: successCount,
            totalFailed: 0,
            results,
          });
        } else if (successCount === 0) {
          return errorResponse(
            `All ${errorCount} assignment(s) failed to create.`,
            400
          );
        } else {
          // Partial success - return 207 Multi-Status equivalent
          return successResponse(
            {
              message: `${successCount} assignment(s) created, ${errorCount} failed.`,
              totalCreated: successCount,
              totalFailed: errorCount,
              results,
            },
            207
          );
        }
      } else {
        // Single assignment
        const validation = validateBody(body, createAssignmentSchema);
        if (!validation.success) {
          return validationErrorResponse(validation.errors!);
        }

        const data = validation.data!;

        // Call service function
        const result = await createAssignment(id, data, user);

        if (!result.success) {
          // Determine appropriate status code
          let statusCode = 400;
          if (result.message.includes('not found')) {
            statusCode = 404;
          } else if (result.message.includes('Only teaching')) {
            statusCode = 422;
          }
          return errorResponse(result.message, statusCode);
        }

        return createdResponse({
          assignmentId: result.assignmentId,
          message: result.message,
        });
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to create subject assignment',
        500
      );
    }
  }
);

