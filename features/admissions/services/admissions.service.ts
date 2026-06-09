import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuthUser } from '@/types/auth';
import type { AdmissionApplication } from '../types';

export async function submitApplication(input: any): Promise<AdmissionApplication> {
  const supabase = await createSupabaseServerClient();
  const { data: school } = await supabase.from('schools').select('school_id').limit(1).single();
  if (!school) throw new Error('No school found');

  const { data, error } = await supabase.from('admission_applications').insert({
    school_id: school.school_id,
    first_name: input.firstName, last_name: input.lastName,
    date_of_birth: input.dateOfBirth, gender: input.gender,
    grade_applying_for: input.gradeApplyingFor,
    previous_school: input.previousSchool || null,
    parent_name: input.parentName, parent_phone: input.parentPhone,
    parent_email: input.parentEmail || null,
    parent_id_number: input.parentIdNumber || null,
  }).select().single();

  if (error) throw new Error(error.message);
  return mapApplication(data);
}

export async function listApplications(schoolId: string, status?: string): Promise<AdmissionApplication[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from('admission_applications').select('*').eq('school_id', schoolId).order('submitted_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return (data ?? []).map(mapApplication);
}

export async function reviewApplication(id: string, input: any, userId: string, schoolId: string): Promise<AdmissionApplication> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('admission_applications').update({
    status: input.status, notes: input.notes || null,
    reviewed_by: userId, reviewed_at: new Date().toISOString(),
  }).eq('application_id', id).eq('school_id', schoolId).select().single();
  if (error) throw new Error(error.message);
  return mapApplication(data);
}

export async function getApplicationStats(schoolId: string) {
  const supabase = await createSupabaseServerClient();
  const [total, pending, accepted, rejected] = await Promise.all([
    supabase.from('admission_applications').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('admission_applications').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending'),
    supabase.from('admission_applications').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'accepted'),
    supabase.from('admission_applications').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'rejected'),
  ]);
  return { total: total.count ?? 0, pending: pending.count ?? 0, accepted: accepted.count ?? 0, rejected: rejected.count ?? 0 };
}

function mapApplication(r: any): AdmissionApplication {
  return {
    applicationId: r.application_id, schoolId: r.school_id,
    firstName: r.first_name, lastName: r.last_name,
    dateOfBirth: r.date_of_birth, gender: r.gender,
    gradeApplyingFor: r.grade_applying_for,
    previousSchool: r.previous_school, parentName: r.parent_name,
    parentPhone: r.parent_phone, parentEmail: r.parent_email,
    parentIdNumber: r.parent_id_number, status: r.status,
    notes: r.notes, submittedAt: r.submitted_at,
    reviewedAt: r.reviewed_at, reviewedBy: r.reviewed_by,
  };
}
