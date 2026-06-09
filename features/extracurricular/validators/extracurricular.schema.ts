import { z } from 'zod';

export const createClubSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  patronName: z.string().max(100).optional(),
  meetingSchedule: z.string().max(200).optional(),
});

export const addMemberSchema = z.object({
  clubId: z.string().uuid(),
  studentId: z.string().uuid(),
  role: z.enum(['member', 'vice_president', 'president', 'secretary', 'treasurer']).default('member'),
});

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  sport: z.string().min(1).max(100),
  coachName: z.string().max(100).optional(),
  category: z.enum(['boys', 'girls', 'mixed']),
});

export const addTeamMemberSchema = z.object({
  teamId: z.string().uuid(),
  studentId: z.string().uuid(),
  position: z.string().max(100).optional(),
  jerseyNumber: z.number().int().min(1).max(99).optional(),
});
