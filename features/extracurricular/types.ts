export interface Club {
  clubId: string;
  schoolId: string;
  name: string;
  description: string | null;
  patronName: string | null;
  meetingSchedule: string | null;
  isActive: boolean;
}

export interface ClubMembership {
  membershipId: string;
  clubId: string;
  clubName?: string;
  studentId: string;
  studentName?: string;
  className?: string;
  role: 'member' | 'vice_president' | 'president' | 'secretary' | 'treasurer';
  joinedAt: string;
}

export interface SportTeam {
  teamId: string;
  schoolId: string;
  name: string;
  sport: string;
  coachName: string | null;
  category: 'boys' | 'girls' | 'mixed';
  isActive: boolean;
}

export interface TeamMember {
  memberId: string;
  teamId: string;
  teamName?: string;
  studentId: string;
  studentName?: string;
  className?: string;
  position: string | null;
  jerseyNumber: number | null;
  joinedAt: string;
}
