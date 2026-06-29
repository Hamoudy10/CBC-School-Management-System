'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { BookOpen, RefreshCw, Download, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';
import { useReferenceData } from '@/hooks/useReferenceData';

interface StudentOption {
  studentId: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
}

interface WorksheetQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface WorksheetResult {
  studentName: string;
  grade: string;
  subject: string;
  strand: string;
  questions: WorksheetQuestion[];
  generatedAt: string;
}

export default function AdaptiveHomeworkPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { classes: referenceClasses } = useReferenceData({ enabled: Boolean(user) });

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStrand, setSelectedStrand] = useState('');
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<WorksheetResult | null>(null);

  const classes = (referenceClasses || []).map((c: any) => ({
    classId: c.classId || c.id,
    name: c.name,
    gradeName: c.gradeName || c.grade_level || '',
  }));

  const strands = ['Numbers', 'Measurements', 'Algebra', 'Data Handling', 'Geometry', 'Fractions', 'Decimals', 'Time'];

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setSelectedStudentId('');
      return;
    }
    setLoadingStudents(true);
    setSelectedStudentId('');
    fetch(`/api/students?classId=${selectedClassId}&pageSize=100`)
      .then((res) => res.json())
      .then((data) => {
        const list: StudentOption[] = (data.data?.data || data.data?.students || data.students || []).map((s: any) => ({
          studentId: s.studentId || s.student_id,
          firstName: s.firstName || s.first_name,
          lastName: s.lastName || s.last_name,
          admissionNumber: s.admissionNumber || s.admission_number,
        }));
        setStudents(list);
      })
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [selectedClassId]);

  const handleGenerate = useCallback(async () => {
    if (!selectedStudentId) {
      error('Please select a student');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch('/api/adaptive-homework/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          strandId: selectedStrand || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {throw new Error(data.error || 'Generation failed');}

      setResult(data.data);
      success('Worksheet generated successfully');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to generate worksheet');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedStudentId, selectedStrand, error, success]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adaptive Homework"
        description="Generate personalized worksheets targeting weak CBC competencies"
        icon={<BookOpen className="h-6 w-6" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configure Worksheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              placeholder="Select class"
            >
              <option value="">Select class</option>
              {classes.map((cls: any) => (
                <option key={cls.classId} value={cls.classId}>{cls.name}</option>
              ))}
            </Select>

            <Select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              placeholder="Select student"
              disabled={!selectedClassId || loadingStudents}
            >
              <option value="">
                {loadingStudents ? 'Loading...' : !selectedClassId ? 'Select a class first' : 'Select student'}
              </option>
              {students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.firstName} {s.lastName} ({s.admissionNumber})
                </option>
              ))}
            </Select>

            <Select
              value={selectedStrand}
              onChange={(e) => setSelectedStrand(e.target.value)}
              placeholder="Focus strand (optional)"
            >
              <option value="">All strands</option>
              {strands.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>

            <Button
              leftIcon={<Sparkles className="h-4 w-4" />}
              onClick={handleGenerate}
              loading={isGenerating}
              disabled={!selectedStudentId}
            >
              Generate Worksheet
            </Button>
          </div>
        </CardContent>
      </Card>

      {isGenerating && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">AI is generating personalized worksheet...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && !isGenerating && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-5 w-5" />
              {result.subject} — {result.strand}
              <Badge variant="primary" size="sm">{result.grade}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {result.questions.map((q, i) => (
              <div key={i} className="rounded-lg border p-4">
                <p className="font-medium text-gray-900">
                  {i + 1}. {q.question}
                </p>
                <div className="mt-2 space-y-1">
                  {q.options.map((opt, j) => (
                    <label key={j} className="flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                      <input type="radio" name={`q-${i}`} value={opt} className="h-3.5 w-3.5" />
                      {opt}
                    </label>
                  ))}
                </div>
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Show answer</summary>
                  <p className="mt-1 text-sm font-medium text-green-700">Answer: {q.answer}</p>
                  <p className="text-sm text-gray-600">{q.explanation}</p>
                </details>
              </div>
            ))}

            <div className="flex gap-2">
              <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={handleGenerate} loading={isGenerating}>
                Regenerate
              </Button>
              <Button variant="ghost" leftIcon={<Download className="h-4 w-4" />}>
                Print
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
