'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Plus, Upload, FileText, Image, Video, Link, CheckCircle, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useReferenceData } from '@/hooks/useReferenceData';

interface PortfolioEntry {
  entryId: string; title: string; description: string | null;
  studentName: string; className: string;
  learningAreaName: string; strandName: string | null;
  evidenceType: string; evidenceUrl: string | null; evidenceContent: string | null;
  status: string; submittedAt: string;
  assessedScore: number | null; assessedLevel: string | null;
  teacherComment: string | null;
}

const typeIcons: Record<string, any> = { document: FileText, image: Image, video: Video, link: Link, text: FileText };
const statusColors: Record<string, string> = { submitted: 'bg-amber-100 text-amber-800', assessed: 'bg-green-100 text-green-800', returned: 'bg-blue-100 text-blue-800' };
const evidenceTypes = ['document', 'image', 'video', 'link', 'text'];
const performanceLevels = [
  { value: 'exceeding', label: 'Exceeding Expectations (4)' },
  { value: 'meeting', label: 'Meeting Expectations (3)' },
  { value: 'approaching', label: 'Approaching Expectations (2)' },
  { value: 'below_expectation', label: 'Below Expectations (1)' },
];

export default function PortfolioPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { classes: refClasses, learningAreas } = useReferenceData({ enabled: Boolean(user), includeLearningAreas: true });

  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLA, setFilterLA] = useState('');
  const [filterStudent, setFilterStudent] = useState('');

  const [showSubmit, setShowSubmit] = useState(false);
  const [sTitle, setSTitle] = useState(''); const [sStudent, setSStudent] = useState('');
  const [sLA, setSLA] = useState(''); const [sType, setSType] = useState('document');
  const [sContent, setSContent] = useState('');

  const [assessing, setAssessing] = useState<string | null>(null);
  const [aScore, setAScore] = useState('3'); const [aLevel, setALevel] = useState('meeting');
  const [aComment, setAComment] = useState('');

  const fetchEntries = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterStudent) params.set('studentId', filterStudent);
    if (filterLA) params.set('learningAreaId', filterLA);
    try {
      const res = await fetch(`/api/portfolio/entries?${params}`, { credentials: 'include' });
      if (res.ok) { const j = await res.json(); setEntries(j.data ?? []); }
    } catch {} finally { setLoading(false); }
  }, [filterStatus, filterStudent, filterLA]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    if (!filterStudent && refClasses.length > 0) {
      const firstClass = refClasses[0].classId;
      fetch(`/api/students?classId=${firstClass}`, { credentials: 'include' })
        .then((r) => r.json()).then((j) => setStudents(j.data?.data ?? j.data ?? [])).catch(() => {});
    }
  }, [refClasses]);

  const handleSubmit = useCallback(async () => {
    if (!sTitle.trim() || !sStudent || !sLA) { error('Fill required fields'); return; }
    try {
      const res = await fetch('/api/portfolio/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: sStudent, learningAreaId: sLA, title: sTitle.trim(), evidenceType: sType, evidenceContent: sContent.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setEntries((prev) => [json.data, ...prev]);
      setShowSubmit(false); setSTitle(''); setSContent('');
      success('Portfolio entry submitted');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [sTitle, sStudent, sLA, sType, sContent, success, error]);

  const handleAssess = useCallback(async (entryId: string) => {
    try {
      const res = await fetch(`/api/portfolio/entries/${entryId}/assess`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: parseInt(aScore), level: aLevel, comment: aComment || undefined, status: 'assessed' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setEntries((prev) => prev.map((e) => e.entryId === entryId ? { ...e, ...json.data } : e));
      setAssessing(null); setAComment('');
      success('Entry assessed');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [aScore, aLevel, aComment, success, error]);

  const pendingCount = entries.filter((e) => e.status === 'submitted').length;

  return (
    <div className="space-y-6">
      <PageHeader title="CBC Portfolio" description="Student evidence of learning and competency assessment" icon={<FolderOpen className="h-6 w-6" />} />

      <div className="flex items-center gap-3">
        <Select value={filterStudent} onChange={(e) => setFilterStudent(e.target.value)} placeholder="Student">
          <option value="">All students</option>
          {students.map((s: any) => <option key={s.studentId ?? s.student_id} value={s.studentId ?? s.student_id}>{s.firstName ?? s.first_name} {s.lastName ?? s.last_name}</option>)}
        </Select>
        <Select value={filterLA} onChange={(e) => setFilterLA(e.target.value)} placeholder="Learning Area">
          <option value="">All areas</option>
          {learningAreas.map((la) => <option key={la.learningAreaId} value={la.learningAreaId}>{la.name}</option>)}
        </Select>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} placeholder="Status" className="w-36">
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="assessed">Assessed</option>
          <option value="returned">Returned</option>
        </Select>
        <Button variant="outline" leftIcon={<Search className="h-4 w-4" />} onClick={fetchEntries}>Filter</Button>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowSubmit(!showSubmit)}>
          New Entry
        </Button>
      </div>

      {showSubmit && (
        <Card>
          <CardHeader><CardTitle className="text-base">Submit Portfolio Entry</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Student *</label>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={sStudent} onChange={(e) => setSStudent(e.target.value)}>
                  <option value="">Select student</option>
                  {students.map((s: any) => <option key={s.studentId ?? s.student_id} value={s.studentId ?? s.student_id}>{s.firstName ?? s.first_name} {s.lastName ?? s.last_name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Learning Area *</label>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={sLA} onChange={(e) => setSLA(e.target.value)}>
                  <option value="">Select area</option>
                  {learningAreas.map((la) => <option key={la.learningAreaId} value={la.learningAreaId}>{la.name}</option>)}
                </select>
              </div>
            </div>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Title *" value={sTitle} onChange={(e) => setSTitle(e.target.value)} />
            <div className="flex gap-2">
              {evidenceTypes.map((t) => (
                <button key={t} type="button" onClick={() => setSType(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${sType === t ? 'bg-primary-100 text-primary-800 ring-1 ring-primary-500' : 'bg-gray-100 text-gray-600'}`}>{t}</button>
              ))}
            </div>
            <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={4} placeholder="Evidence content or URL..." value={sContent} onChange={(e) => setSContent(e.target.value)} />
            <Button onClick={handleSubmit} leftIcon={<Upload className="h-4 w-4" />}>Submit Entry</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card><CardContent className="py-12 text-center"><Spinner size="lg" /></CardContent></Card>
      ) : entries.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-gray-500">No portfolio entries yet. Submit evidence of student learning.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {pendingCount > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> {pendingCount} entry(ies) awaiting assessment
            </div>
          )}
          {entries.map((entry) => {
            const Icon = typeIcons[entry.evidenceType] || FileText;
            return (
              <Card key={entry.entryId}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="rounded-lg bg-gray-100 p-2"><Icon className="h-5 w-5 text-gray-600" /></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{entry.title}</span>
                          <Badge variant={entry.status as any} size="xs" className={statusColors[entry.status]}>{entry.status}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>{entry.studentName}</span>
                          <span>{entry.learningAreaName}</span>
                          <span>{entry.className}</span>
                          <span>{new Date(entry.submittedAt).toLocaleDateString()}</span>
                        </div>
                        {entry.description && <p className="mt-1 text-sm text-gray-600">{entry.description}</p>}
                        {entry.assessedScore != null && (
                          <div className="mt-2 flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-700">Score: {entry.assessedScore}/4</span>
                            <Badge variant={entry.assessedLevel as any} size="xs">{entry.assessedLevel?.replace('_', ' ')}</Badge>
                            {entry.teacherComment && <span className="text-gray-500">— {entry.teacherComment}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    {entry.status === 'submitted' && (
                      <Button variant="outline" size="sm" onClick={() => { setAssessing(entry.entryId); setAScore('3'); setALevel('meeting'); }}>Assess</Button>
                    )}
                  </div>

                  {assessing === entry.entryId && (
                    <div className="mt-3 rounded-lg border p-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Score (1-4)</label>
                          <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={aScore} onChange={(e) => { setAScore(e.target.value); setALevel(e.target.value === '4' ? 'exceeding' : e.target.value === '3' ? 'meeting' : e.target.value === '2' ? 'approaching' : 'below_expectation'); }}>
                            <option value="4">4 - Exceeding</option>
                            <option value="3">3 - Meeting</option>
                            <option value="2">2 - Approaching</option>
                            <option value="1">1 - Below</option>
                          </select>
                        </div>
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">CBC Level</label>
                          <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={aLevel} onChange={(e) => setALevel(e.target.value)}>
                            {performanceLevels.map((pl) => <option key={pl.value} value={pl.value}>{pl.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} placeholder="Teacher comment..." value={aComment} onChange={(e) => setAComment(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAssess(entry.entryId)} leftIcon={<CheckCircle className="h-4 w-4" />}>Save Assessment</Button>
                        <Button variant="outline" size="sm" onClick={() => setAssessing(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
