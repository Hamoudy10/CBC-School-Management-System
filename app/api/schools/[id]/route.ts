// app/api/schools/[id]/route.ts
// ============================================================
// GET /api/schools/[id] — Get single school
// PUT /api/schools/[id] — Update school
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody, validateUuid } from '@/lib/api/validation';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(20).optional(),
  type: z.enum(['primary', 'secondary', 'mixed', 'academy']).optional(),
  address: z.string().max(500).optional(),
  county: z.string().max(100).optional(),
  subCounty: z.string().max(100).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(20).optional(),
  website: z.string().url().optional(),
  motto: z.string().max(200).optional(),
  mission: z.string().max(1000).optional(),
  vision: z.string().max(1000).optional(),
  registrationNumber: z.string().max(50).optional(),
  establishedYear: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  logoUrl: z.string().url().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const GET = withPermission('settings', 'view', async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('School ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const supabase = await createSupabaseServerClient();

  // Users can only access their own school unless they're super_admin
  const query = supabase.from('schools').select('*').eq('id', id);
  if (user.role !== 'super_admin') {
    query.eq('id', user.school_id);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {return errorResponse(error.message, 500);}
  if (!data) {return notFoundResponse('School not found');}

  return successResponse(data);
});

export const PUT = withPermission('settings', 'update', async (request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('School ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const bodyValidation = await validateBody(request, updateSchema);
  if (!bodyValidation.success) {return validationErrorResponse(bodyValidation.errors!);}

  const updateData = bodyValidation.data!;
  if (Object.keys(updateData).length === 0) {return errorResponse('No fields provided', 400);}

  const supabase = await createSupabaseServerClient();

  // Non-super-admins can only update their own school
  const updatePayload = {
    ...updateData,
    sub_county: updateData.subCounty,
    contact_email: updateData.contactEmail,
    contact_phone: updateData.contactPhone,
    registration_number: updateData.registrationNumber,
    established_year: updateData.establishedYear,
    logo_url: updateData.logoUrl,
    updated_at: new Date().toISOString(),
  };

  let query = supabase
    .from('schools')
    .update(updatePayload)
    .eq('id', id);

  if (user.role !== 'super_admin') {
    query = query.eq('id', user.school_id);
  }

  const { error } = await query;

  if (error) {return errorResponse(error.message, 400);}
  return successResponse({ id, message: 'School updated successfully' });
});
