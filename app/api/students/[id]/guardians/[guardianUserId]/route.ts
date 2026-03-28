import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  STUDENT_WRITE_ROLES,
  errorResponse,
  getStudentRequestContext,
  successResponse,
} from '@/app/api/students/_utils';
import { studentsService } from '@/features/students/services/students.service';

const paramsSchema = z.object({
  id: z.string().uuid(),
  guardianUserId: z.string().uuid(),
});

const relationshipSchema = z.enum([
  'father',
  'mother',
  'guardian',
  'grandparent',
  'uncle',
  'aunt',
  'sibling',
  'other',
]);

const updateGuardianSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(3).max(30).optional().or(z.literal('')),
  relationship: relationshipSchema.optional(),
  isPrimaryContact: z.boolean().optional(),
  canPickup: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one guardian field must be provided',
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; guardianUserId: string } },
) {
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return errorResponse('Invalid guardian identifier', 400);
  }

  const context = await getStudentRequestContext(params.id, STUDENT_WRITE_ROLES);
  if ('error' in context) {
    return context.error;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const parsed = updateGuardianSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0]?.message || 'Invalid guardian payload', 422);
  }

  try {
    const guardian = await studentsService.updateGuardian(
      parsedParams.data.id,
      parsedParams.data.guardianUserId,
      {
        ...parsed.data,
        email: parsed.data.email === '' ? undefined : parsed.data.email,
        phone: parsed.data.phone === '' ? undefined : parsed.data.phone,
      },
      context.user,
    );

    return successResponse(guardian, 'Guardian updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update guardian';
    return errorResponse(message, 400);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; guardianUserId: string } },
) {
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return errorResponse('Invalid guardian identifier', 400);
  }

  const context = await getStudentRequestContext(params.id, STUDENT_WRITE_ROLES);
  if ('error' in context) {
    return context.error;
  }

  try {
    await studentsService.removeGuardian(
      parsedParams.data.id,
      parsedParams.data.guardianUserId,
      context.user,
    );

    return successResponse(null, 'Guardian removed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove guardian';
    return errorResponse(message, 400);
  }
}
