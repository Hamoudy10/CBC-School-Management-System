import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuthUser } from '@/types/auth';
import type { Club, ClubMembership, SportTeam, TeamMember } from '../types';

export async function listClubs(schoolId: string): Promise<Club[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('clubs').select('*').eq('school_id', schoolId).eq('is_active', true).order('name');
  return (data ?? []).map((r) => ({ clubId: r.club_id, schoolId: r.school_id, name: r.name, description: r.description, patronName: r.patron_name, meetingSchedule: r.meeting_schedule, isActive: r.is_active }));
}

export async function createClub(input: any, schoolId: string): Promise<Club> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('clubs').insert({
    school_id: schoolId, name: input.name, description: input.description || null,
    patron_name: input.patronName || null, meeting_schedule: input.meetingSchedule || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return (await listClubs(schoolId)).find((c) => c.clubId === data.club_id)!;
}

export async function listMemberships(clubId: string): Promise<ClubMembership[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('club_memberships')
    .select('*, students!inner(first_name, last_name, classes!inner(name))')
    .eq('club_id', clubId);
  return (data ?? []).map((r: any) => ({
    membershipId: r.membership_id, clubId: r.club_id, clubName: '',
    studentId: r.student_id, studentName: `${r.students?.first_name ?? ''} ${r.students?.last_name ?? ''}`.trim(),
    className: r.students?.classes?.name ?? '', role: r.role, joinedAt: r.joined_at,
  }));
}

export async function addMember(input: any): Promise<ClubMembership> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('club_memberships').insert({
    club_id: input.clubId, student_id: input.studentId, role: input.role || 'member',
  }).select().single();
  if (error) throw new Error(error.message);
  return (await listMemberships(input.clubId)).find((m) => m.membershipId === data.membership_id)!;
}

export async function listTeams(schoolId: string): Promise<SportTeam[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('sport_teams').select('*').eq('school_id', schoolId).eq('is_active', true).order('name');
  return (data ?? []).map((r) => ({ teamId: r.team_id, schoolId: r.school_id, name: r.name, sport: r.sport, coachName: r.coach_name, category: r.category, isActive: r.is_active }));
}

export async function createTeam(input: any, schoolId: string): Promise<SportTeam> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('sport_teams').insert({
    school_id: schoolId, name: input.name, sport: input.sport,
    coach_name: input.coachName || null, category: input.category,
  }).select().single();
  if (error) throw new Error(error.message);
  return (await listTeams(schoolId)).find((t) => t.teamId === data.team_id)!;
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('team_members')
    .select('*, students!inner(first_name, last_name, classes!inner(name))')
    .eq('team_id', teamId);
  return (data ?? []).map((r: any) => ({
    memberId: r.member_id, teamId: r.team_id, teamName: '',
    studentId: r.student_id, studentName: `${r.students?.first_name ?? ''} ${r.students?.last_name ?? ''}`.trim(),
    className: r.students?.classes?.name ?? '', position: r.position,
    jerseyNumber: r.jersey_number, joinedAt: r.joined_at,
  }));
}

export async function addTeamMember(input: any): Promise<TeamMember> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('team_members').insert({
    team_id: input.teamId, student_id: input.studentId,
    position: input.position || null, jersey_number: input.jerseyNumber || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return (await listTeamMembers(input.teamId)).find((m) => m.memberId === data.member_id)!;
}
