import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  STUDENT_READ_ROLES,
  STUDENT_WRITE_ROLES,
  errorResponse,
  getStudentRequestContext,
  successResponse,
} from '@/app/api/students/_utils';
import { studentsService } from '@/features/students/services/students.service';

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

const createGuardianSchema = z.object({
  guardianUserId: z.string().uuid().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(3).max(30).optional(),
  relationship: relationshipSchema,
  isPrimaryContact: z.boolean().optional(),
  canPickup: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (!value.guardianUserId && (!value.firstName || !value.lastName || !value.email)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide an existing guardian user or enter first name, last name, and email.',
      path: ['email'],
    });
  }
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const context = await getStudentRequestContext(params.id, STUDENT_READ_ROLES);
  if ('error' in context) {
    return context.error;
  }

  try {
    const guardians = await studentsService.getStudentGuardians(params.id, context.user);
    return successResponse(guardians, 'Guardians retrieved successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch guardians';
    return errorResponse(message, 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const parsed = createGuardianSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0]?.message || 'Invalid guardian payload', 422);
  }

  try {
    const guardian = await studentsService.addGuardian(
      params.id,
      parsed.data,
      context.user,
    );

    return successResponse(guardian, 'Guardian linked successfully', 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add guardian';
    return errorResponse(message, 400);
  }
}
