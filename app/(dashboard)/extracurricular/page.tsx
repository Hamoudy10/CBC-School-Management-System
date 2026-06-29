'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Trophy, Plus, UserPlus, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';

interface Club { clubId: string; name: string; description: string | null; patronName: string | null; meetingSchedule: string | null; }
interface Member { membershipId: string; studentName: string; className: string; role: string; }
interface Team { teamId: string; name: string; sport: string; coachName: string | null; category: string; }
interface TMember { memberId: string; studentName: string; className: string; position: string | null; jerseyNumber: number | null; }

export default function ExtracurricularPage() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tmembers, setTmembers] = useState<TMember[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClub, setSelectedClub] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');

  const [cName, setCName] = useState(''); const [cPatron, setCPatron] = useState(''); const [cMeeting, setCMeeting] = useState('');
  const [tName, setTName] = useState(''); const [tSport, setTSport] = useState(''); const [tCoach, setTCoach] = useState(''); const [tCat, setTCat] = useState('boys');
  const [mStudent, setMStudent] = useState(''); const [mRole, setMRole] = useState('member');
  const [tmStudent, setTmStudent] = useState(''); const [tmPos, setTmPos] = useState(''); const [tmJersey, setTmJersey] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, tRes, sRes] = await Promise.all([
        fetch('/api/extracurricular/clubs', { credentials: 'include' }),
        fetch('/api/extracurricular/teams', { credentials: 'include' }),
        fetch('/api/students', { credentials: 'include' }),
      ]);
      if (cRes.ok) { const j = await cRes.json(); setClubs(j.data ?? []); }
      if (tRes.ok) { const j = await tRes.json(); setTeams(j.data ?? []); }
      if (sRes.ok) { const j = await sRes.json(); setStudents(j.data?.data ?? j.data ?? []); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!selectedClub) { setMembers([]); return; }
    fetch(`/api/extracurricular/clubs/${selectedClub}/members`, { credentials: 'include' })
      .then((r) => r.json()).then((j) => setMembers(j.data ?? [])).catch(() => {});
  }, [selectedClub]);

  useEffect(() => {
    if (!selectedTeam) { setTmembers([]); return; }
    fetch(`/api/extracurricular/teams/${selectedTeam}/members`, { credentials: 'include' })
      .then((r) => r.json()).then((j) => setTmembers(j.data ?? [])).catch(() => {});
  }, [selectedTeam]);

  const addClub = useCallback(async () => {
    if (!cName.trim()) { error('Enter club name'); return; }
    try {
      const res = await fetch('/api/extracurricular/clubs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cName.trim(), patronName: cPatron.trim() || undefined, meetingSchedule: cMeeting.trim() || undefined }) });
      const json = await res.json(); if (!res.ok) {throw new Error(json.error || 'Failed');}
      setClubs((prev) => [...prev, json.data]); setCName(''); setCPatron(''); setCMeeting(''); success('Club created');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [cName, cPatron, cMeeting, success, error]);

  const addTeam = useCallback(async () => {
    if (!tName.trim() || !tSport.trim()) { error('Enter team name and sport'); return; }
    try {
      const res = await fetch('/api/extracurricular/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: tName.trim(), sport: tSport.trim(), coachName: tCoach.trim() || undefined, category: tCat }) });
      const json = await res.json(); if (!res.ok) {throw new Error(json.error || 'Failed');}
      setTeams((prev) => [...prev, json.data]); setTName(''); setTSport(''); setTCoach(''); success('Team created');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [tName, tSport, tCoach, tCat, success, error]);

  const addClubMember = useCallback(async () => {
    if (!selectedClub || !mStudent) { error('Select club and student'); return; }
    try {
      const res = await fetch(`/api/extracurricular/clubs/${selectedClub}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clubId: selectedClub, studentId: mStudent, role: mRole }) });
      const json = await res.json(); if (!res.ok) {throw new Error(json.error || 'Failed');}
      setMembers((prev) => [...prev, json.data]); setMStudent(''); success('Member added');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [selectedClub, mStudent, mRole, success, error]);

  const addTeamMember = useCallback(async () => {
    if (!selectedTeam || !tmStudent) { error('Select team and student'); return; }
    try {
      const res = await fetch(`/api/extracurricular/teams/${selectedTeam}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId: selectedTeam, studentId: tmStudent, position: tmPos.trim() || undefined, jerseyNumber: tmJersey ? parseInt(tmJersey) : undefined }) });
      const json = await res.json(); if (!res.ok) {throw new Error(json.error || 'Failed');}
      setTmembers((prev) => [...prev, json.data]); setTmStudent(''); setTmPos(''); setTmJersey(''); success('Player added');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [selectedTeam, tmStudent, tmPos, tmJersey, success, error]);

  return (
    <div className="space-y-6">
      <PageHeader title="Extracurricular" description="Manage clubs, sports teams, and student participation" icon={<Trophy className="h-6 w-6" />} />

      {loading ? (
        <Card><CardContent className="py-12 text-center"><Spinner size="lg" /></CardContent></Card>
      ) : (
        <Tabs defaultValue="clubs">
          <TabsList>
            <TabsTrigger value="clubs"><Users className="h-4 w-4 mr-1" /> Clubs ({clubs.length})</TabsTrigger>
            <TabsTrigger value="sports"><Trophy className="h-4 w-4 mr-1" /> Sports ({teams.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="clubs" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Create Club</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="w-56"><label className="block text-xs font-medium text-gray-600 mb-1">Club Name *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., Debate Club" value={cName} onChange={(e) => setCName(e.target.value)} /></div>
                <div className="w-44"><label className="block text-xs font-medium text-gray-600 mb-1">Patron</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Teacher name" value={cPatron} onChange={(e) => setCPatron(e.target.value)} /></div>
                <div className="w-52"><label className="block text-xs font-medium text-gray-600 mb-1">Meeting Schedule</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., Every Friday 4pm" value={cMeeting} onChange={(e) => setCMeeting(e.target.value)} /></div>
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={addClub}>Create</Button>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Select value={selectedClub} onChange={(e) => setSelectedClub(e.target.value)} placeholder="Select club">
                  <option value="">Select club to view members</option>
                  {clubs.map((c) => <option key={c.clubId} value={c.clubId}>{c.name}</option>)}
                </Select>
                {selectedClub && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={mStudent} onChange={(e) => setMStudent(e.target.value)}>
                          <option value="">Add student...</option>
                          {students.filter((s: any) => !members.find((m) => m.studentName === `${s.firstName ?? s.first_name} ${s.lastName ?? s.last_name}`)).map((s: any) => (
                            <option key={s.studentId ?? s.student_id} value={s.studentId ?? s.student_id}>{s.firstName ?? s.first_name} {s.lastName ?? s.last_name}</option>
                          ))}
                        </select>
                      </div>
                      <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={mRole} onChange={(e) => setMRole(e.target.value)}>
                        <option value="member">Member</option>
                        <option value="vice_president">V. President</option>
                        <option value="president">President</option>
                        <option value="secretary">Secretary</option>
                        <option value="treasurer">Treasurer</option>
                      </select>
                      <Button size="sm" leftIcon={<UserPlus className="h-3 w-3" />} onClick={addClubMember}>Add</Button>
                    </div>
                    {members.length > 0 && (
                      <div className="space-y-1">
                        {members.map((m) => (
                          <div key={m.membershipId} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{m.studentName}</span>
                              <span className="text-xs text-gray-500">{m.className}</span>
                            </div>
                            <Badge variant="default" size="xs">{m.role.replace('_', ' ')}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {clubs.map((c) => (
                  <button key={c.clubId} type="button" onClick={() => setSelectedClub(c.clubId)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${selectedClub === c.clubId ? 'border-primary-500 bg-primary-50' : 'hover:bg-gray-50'}`}>
                    <p className="font-medium text-gray-900">{c.name}</p>
                    {c.patronName && <p className="text-xs text-gray-500">Patron: {c.patronName}</p>}
                    {c.meetingSchedule && <p className="text-xs text-gray-500">{c.meetingSchedule}</p>}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sports" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Create Team</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="w-52"><label className="block text-xs font-medium text-gray-600 mb-1">Team Name *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., Falcons" value={tName} onChange={(e) => setTName(e.target.value)} /></div>
                <div className="w-44"><label className="block text-xs font-medium text-gray-600 mb-1">Sport *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., Football" value={tSport} onChange={(e) => setTSport(e.target.value)} /></div>
                <div className="w-40"><label className="block text-xs font-medium text-gray-600 mb-1">Coach</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Coach name" value={tCoach} onChange={(e) => setTCoach(e.target.value)} /></div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={tCat} onChange={(e) => setTCat(e.target.value)}>
                    <option value="boys">Boys</option>
                    <option value="girls">Girls</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={addTeam}>Create</Button>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} placeholder="Select team">
                  <option value="">Select team to view players</option>
                  {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name} ({t.sport})</option>)}
                </Select>
                {selectedTeam && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={tmStudent} onChange={(e) => setTmStudent(e.target.value)}>
                          <option value="">Add player...</option>
                          {students.filter((s: any) => !tmembers.find((m) => m.studentName === `${s.firstName ?? s.first_name} ${s.lastName ?? s.last_name}`)).map((s: any) => (
                            <option key={s.studentId ?? s.student_id} value={s.studentId ?? s.student_id}>{s.firstName ?? s.first_name} {s.lastName ?? s.last_name}</option>
                          ))}
                        </select>
                      </div>
                      <input className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Pos" value={tmPos} onChange={(e) => setTmPos(e.target.value)} />
                      <input className="w-16 rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="#No" value={tmJersey} onChange={(e) => setTmJersey(e.target.value)} />
                      <Button size="sm" leftIcon={<UserPlus className="h-3 w-3" />} onClick={addTeamMember}>Add</Button>
                    </div>
                    {tmembers.length > 0 && (
                      <div className="space-y-1">
                        {tmembers.map((m) => (
                          <div key={m.memberId} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">{m.jerseyNumber ?? '-'}</span>
                              <span className="font-medium text-gray-900">{m.studentName}</span>
                              <span className="text-xs text-gray-500">{m.className}</span>
                            </div>
                            {m.position && <Badge variant="default" size="xs">{m.position}</Badge>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {teams.map((t) => (
                  <button key={t.teamId} type="button" onClick={() => setSelectedTeam(t.teamId)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${selectedTeam === t.teamId ? 'border-primary-500 bg-primary-50' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <Badge variant="info" size="xs">{t.category}</Badge>
                    </div>
                    <p className="text-xs text-gray-500">{t.sport}{t.coachName ? ` • Coach: ${t.coachName}` : ''}</p>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
