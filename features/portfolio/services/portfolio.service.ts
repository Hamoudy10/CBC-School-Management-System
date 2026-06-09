import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuthUser } from '@/types/auth';
import type { PortfolioEntry, PortfolioStats } from '../types';

export async function submitEntry(input: any, schoolId: string): Promise<PortfolioEntry> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('student_portfolios').insert({
    school_id: schoolId, student_id: input.studentId,
    learning_area_id: input.learningAreaId, strand_id: input.strandId || null,
    title: input.title, description: input.description || null,
    evidence_type: input.evidenceType, evidence_url: input.evidenceUrl || null,
    evidence_content: input.evidenceContent || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return mapEntry(data);
}

export async function listEntries(schoolId: string, filters?: { studentId?: string; learningAreaId?: string; status?: string }): Promise<PortfolioEntry[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from('student_portfolios')
    .select('*, students!inner(first_name, last_name, classes!inner(name)), learning_areas!inner(name)')
    .eq('school_id', schoolId)
    .order('submitted_at', { ascending: false });
  if (filters?.studentId) query = query.eq('student_id', filters.studentId);
  if (filters?.learningAreaId) query = query.eq('learning_area_id', filters.learningAreaId);
  if (filters?.status) query = query.eq('status', filters.status);
  const { data } = await query;
  return (data ?? []).map((r: any) => ({
    ...mapEntry(r),
    studentName: `${r.students?.first_name ?? ''} ${r.students?.last_name ?? ''}`.trim(),
    className: r.students?.classes?.name ?? '',
    learningAreaName: r.learning_areas?.name ?? '',
  }));
}

export async function assessEntry(entryId: string, input: any, userId: string, schoolId: string): Promise<PortfolioEntry> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('student_portfolios').update({
    assessed_score: input.score, assessed_level: input.level,
    teacher_comment: input.comment || null, status: input.status,
    assessed_by: userId, assessed_at: new Date().toISOString(),
  }).eq('entry_id', entryId).eq('school_id', schoolId).select('*, students!inner(first_name, last_name), learning_areas!inner(name)').single();
  if (error) throw new Error(error.message);
  return { ...mapEntry(data), studentName: `${data.students.first_name} ${data.students.last_name}`, learningAreaName: data.learning_areas.name };
}

export async function getPortfolioStats(schoolId: string): Promise<PortfolioStats> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('student_portfolios').select('status, assessed_score').eq('school_id', schoolId);
  const entries = data ?? [];
  const assessed = entries.filter((e) => e.assessed_score != null);
  return {
    total: entries.length, submitted: entries.filter((e) => e.status === 'submitted').length,
    assessed: entries.filter((e) => e.status === 'assessed').length,
    returned: entries.filter((e) => e.status === 'returned').length,
    averageScore: assessed.length > 0 ? assessed.reduce((s, e) => s + (e.assessed_score ?? 0), 0) / assessed.length : null,
  };
}

function mapEntry(r: any): PortfolioEntry {
  return {
    entryId: r.entry_id, schoolId: r.school_id, studentId: r.student_id,
    learningAreaId: r.learning_area_id, strandId: r.strand_id ?? null,
    title: r.title, description: r.description ?? null,
    evidenceType: r.evidence_type, evidenceUrl: r.evidence_url ?? null,
    evidenceContent: r.evidence_content ?? null,
    submittedAt: r.submitted_at, status: r.status,
    assessedScore: r.assessed_score ?? null, assessedLevel: r.assessed_level ?? null,
    teacherComment: r.teacher_comment ?? null, assessedBy: r.assessed_by ?? null,
    assessedAt: r.assessed_at ?? null,
  };
}
