'use client';

import React, { useState, useCallback } from 'react';
import { Calendar, Sparkles, CheckCircle, Clock, BookOpen, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';
import { useReferenceData } from '@/hooks/useReferenceData';

interface StudySession {
  day: number;
  date: string;
  topic: string;
  subject: string;
  durationMinutes: number;
  activity: string;
  resources: string[];
  completed: boolean;
}

interface StudyPlanData {
  plan: {
    title: string;
    startDate: string;
    endDate: string;
    targetExam: string;
    totalDays: number;
    totalStudyHours: number;
    sessions: StudySession[];
    recommendations: string[];
  };
  confidence: number;
  warnings: string[];
  generatedAt: string;
}

interface StudentOption {
  studentId: string;
  name: string;
  admissionNumber: string;
}

export default function StudyPlannerPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { classes: referenceClasses } = useReferenceData({ enabled: Boolean(user) });

  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState('');
  const [targetExam, setTargetExam] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [hoursPerDay, setHoursPerDay] = useState('3');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<StudyPlanData | null>(null);
  const [completedSessions, setCompletedSessions] = useState<Set<number>>(new Set());

  const loadStudents = useCallback(async (cId: string) => {
    if (!cId) { setStudents([]); return; }
    try {
      const res = await fetch(`/api/students?classId=${cId}`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok) {
        setStudents((json.data?.data ?? json.data ?? []).map((s: any) => ({
          studentId: s.studentId ?? s.student_id,
          name: `${s.firstName ?? s.first_name ?? ''} ${s.lastName ?? s.last_name ?? ''}`.trim(),
          admissionNumber: s.admissionNumber ?? s.admission_number ?? '',
        })));
      }
    } catch {}
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!classId || !targetExam.trim()) {
      error('Select class and enter target exam');
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/study-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          studentId: studentId || undefined,
          targetExam: targetExam.trim(),
          startDate,
          endDate,
          hoursPerDay: parseInt(hoursPerDay) || 3,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      setResult(json.data);
      success('Study plan generated');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to generate study plan');
    } finally { setGenerating(false); }
  }, [classId, studentId, targetExam, startDate, endDate, hoursPerDay, success, error]);

  const toggleSession = (idx: number) => {
    setCompletedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const subjectColors: Record<string, string> = {
    Mathematics: 'bg-blue-100 text-blue-800',
    English: 'bg-green-100 text-green-800',
    Kiswahili: 'bg-yellow-100 text-yellow-800',
    Science: 'bg-purple-100 text-purple-800',
    default: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Plan Generator"
        description="Create personalized revision timetables for exams"
        icon={<Calendar className="h-6 w-6" />}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Plan Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select value={classId} onChange={(e) => { setClassId(e.target.value); loadStudents(e.target.value); setStudentId(''); }} placeholder="Class *">
              <option value="">Select class</option>
              {referenceClasses.map((c) => <option key={c.classId} value={c.classId}>{c.name}</option>)}
            </Select>
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student (optional)">
              <option value="">All students in class</option>
              {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.name} ({s.admissionNumber})</option>)}
            </Select>
          </div>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Target exam (e.g., End of Term 1 Exam 2026) *"
            value={targetExam}
            onChange={(e) => setTargetExam(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hours per Day</label>
              <input type="number" min={1} max={12} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} />
            </div>
          </div>
          <Button leftIcon={<Sparkles className="h-4 w-4" />} onClick={handleGenerate} loading={generating}>
            Generate Study Plan
          </Button>
        </CardContent>
      </Card>

      {generating && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Spinner size="lg" />
            <span className="ml-3 text-sm text-gray-500">Creating personalized study plan...</span>
          </CardContent>
        </Card>
      )}

      {result && !generating && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5" />
                {result.plan.title}
                <Badge variant="info" size="sm">{result.plan.totalDays} days</Badge>
                <Badge variant="info" size="sm">{result.plan.totalStudyHours}h total</Badge>
                <Badge variant="primary" size="sm">Confidence: {result.confidence}%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span><strong>Target:</strong> {result.plan.targetExam}</span>
                <span><strong>Period:</strong> {result.plan.startDate} → {result.plan.endDate}</span>
                <span><strong>Progress:</strong> {completedSessions.size}/{result.plan.sessions.length} sessions</span>
              </div>
            </CardContent>
          </Card>

          {result.warnings?.length > 0 && (
            <Alert variant="warning">
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>{result.warnings.join(', ')}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="timetable">
            <TabsList>
              <TabsTrigger value="timetable"><Calendar className="h-4 w-4 mr-1" /> Revision Timetable</TabsTrigger>
              <TabsTrigger value="recommendations"><CheckCircle className="h-4 w-4 mr-1" /> Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="timetable" className="space-y-3">
              {(result.plan?.sessions ?? []).map((session, idx) => (
                <Card key={idx} className={`transition-opacity ${completedSessions.has(idx) ? 'opacity-60' : ''}`}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <button
                      type="button"
                      onClick={() => toggleSession(idx)}
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        completedSessions.has(idx)
                          ? 'border-green-500 bg-green-50 text-green-600'
                          : 'border-gray-300 text-gray-400 hover:border-primary-400'
                      }`}
                    >
                      {completedSessions.has(idx) ? <CheckCircle className="h-4 w-4" /> : <span className="text-xs font-bold">{session.day}</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${subjectColors[session.subject] || subjectColors.default}`}>
                          {session.subject}
                        </span>
                        <span className="text-xs font-medium text-gray-500">{session.topic}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {session.date}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {session.durationMinutes} min</span>
                        <span>{session.activity}</span>
                      </div>
                      {session.resources?.length > 0 && (
                        <p className="mt-0.5 text-xs text-gray-400">Resources: {session.resources.join(', ')}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={handleGenerate} loading={generating}>
                Regenerate Plan
              </Button>
            </TabsContent>

            <TabsContent value="recommendations">
              <Card>
                <CardHeader><CardTitle className="text-base">Study Recommendations</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(result.plan?.recommendations ?? []).map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
