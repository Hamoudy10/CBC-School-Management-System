export const dynamic = 'force-dynamic';
// app/api/schools/route.ts
// ============================================================
// GET /api/schools — List schools (super_admin only, or own school for others)
// POST /api/schools — Create new school (super_admin only)
// ============================================================

;

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
  type: z.enum(['primary', 'secondary', 'mixed', 'academy']).default('primary'),
  address: z.string().max(500).optional(),
  county: z.string().max(100).optional(),
  subCounty: z.string().max(100).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(20).optional(),
  motto: z.string().max(200).optional(),
  registrationNumber: z.string().max(50).optional(),
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
    query.eq('school_id', user.school_id);
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
      .select('school_id')
      .eq('registration_number', data.code)
      .maybeSingle();
    if (existing) {return errorResponse(`A school with registration number "${data.code}" already exists`, 409);}
  }

  const { data: newSchool, error } = await supabase
    .from('schools')
    .insert({
      name: data.name,
      type: data.type,
      address: data.address || null,
      county: data.county || null,
      sub_county: data.subCounty || null,
      contact_email: data.contactEmail || null,
      contact_phone: data.contactPhone || null,
      motto: data.motto || null,
      registration_number: data.registrationNumber || null,
      logo_url: data.logoUrl || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {return errorResponse(error.message, 400);}
  return createdResponse({ school_id: newSchool.school_id, school: newSchool }, 'School created successfully');
});
