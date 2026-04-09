// app/api/schools/route.ts
// ============================================================
// GET /api/schools — List schools (super_admin only, or own school for others)
// POST /api/schools — Create new school (super_admin only)
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(20).optional(),
  type: z.enum(['primary', 'secondary', 'mixed', 'academy']).default('primary'),
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
});

export const GET = withPermission('settings', 'view', async (request: NextRequest, { user }) => {
  const supabase = await createSupabaseServerClient();

  // Super admins can see all schools; others see only their own
  const query = supabase
    .from('schools')
    .select('*', { count: 'exact' })
    .order('name');

  if (user.role !== 'super_admin') {
    query.eq('id', user.school_id);
  }

  const { data, error, count } = await query;
  if (error) {return errorResponse(error.message, 500);}

  return successResponse(data || [], { total: count || 0 });
});

export const POST = withPermission('settings', 'create', async (request, { user }) => {
  // Only super admins can create schools
  if (user.role !== 'super_admin') {
    return errorResponse('Only super administrators can create schools', 403);
  }

  const validation = await validateBody(request, createSchema);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const data = validation.data!;
  const supabase = await createSupabaseServerClient();

  // Check for duplicate code
  if (data.code) {
    const { data: existing } = await supabase
      .from('schools')
      .select('id')
      .eq('code', data.code)
      .maybeSingle();
    if (existing) {return errorResponse(`A school with code "${data.code}" already exists`, 409);}
  }

  const { data: newSchool, error } = await supabase
    .from('schools')
    .insert({
      name: data.name,
      code: data.code || null,
      type: data.type,
      address: data.address || null,
      county: data.county || null,
      sub_county: data.subCounty || null,
      contact_email: data.contactEmail || null,
      contact_phone: data.contactPhone || null,
      website: data.website || null,
      motto: data.motto || null,
      mission: data.mission || null,
      vision: data.vision || null,
      registration_number: data.registrationNumber || null,
      established_year: data.establishedYear || null,
      logo_url: data.logoUrl || null,
      status: 'active',
    })
    .select()
    .single();

  if (error) {return errorResponse(error.message, 400);}
  return createdResponse({ id: newSchool.id, school: newSchool }, 'School created successfully');
});
