'use client';

import React, { useState, useCallback } from 'react';
import { FileText, RefreshCw, Download, Sparkles, BookOpen, CheckSquare, BarChart } from 'lucide-react';
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

interface ExamQuestion {
  number: number;
  type: string;
  bloomLevel: string;
  marks: number;
  prompt: string;
  options?: string[];
  expectedAnswer: string;
}

interface MarkingScheme {
  questionNumber: number;
  totalMarks: number;
  expectedPoints: string[];
  rubric: string;
}

interface ExamResult {
  exam: {
    title: string;
    subject: string;
    grade: string;
    instructions: string;
    durationMinutes: number;
    totalMarks: number;
    questions: ExamQuestion[];
    markingScheme: MarkingScheme[];
    bloomTaxonomyBreakdown: Record<string, number>;
  };
  confidence: number;
  warnings: string[];
  generatedAt: string;
}

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'structured', label: 'Structured' },
  { value: 'essay', label: 'Essay' },
];

const GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];

export default function ExamGeneratorPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { learningAreas } = useReferenceData({ enabled: Boolean(user), includeLearningAreas: true });

  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [duration, setDuration] = useState('60');
  const [totalMarks, setTotalMarks] = useState('30');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['multiple_choice', 'short_answer', 'structured']);
  const [learningAreaId, setLearningAreaId] = useState('');
  const [strand, setStrand] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);

  const toggleQuestionType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleGenerate = useCallback(async () => {
    if (!subject.trim() || !grade) {
      error('Please enter subject and select grade');
      return;
    }
    if (selectedTypes.length === 0) {
      error('Select at least one question type');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch('/api/exam-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          grade,
          strand: strand || undefined,
          durationMinutes: parseInt(duration) || 60,
          totalMarks: parseInt(totalMarks) || 30,
          questionTypes: selectedTypes,
          learningAreaId: learningAreaId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {throw new Error(data.error || 'Generation failed');}

      setResult(data.data);
      success('Exam paper generated successfully');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to generate exam paper');
    } finally {
      setIsGenerating(false);
    }
  }, [subject, grade, duration, totalMarks, selectedTypes, strand, learningAreaId, error, success]);

  const bloomColors: Record<string, string> = {
    remember: 'bg-blue-100 text-blue-800',
    understand: 'bg-green-100 text-green-800',
    apply: 'bg-yellow-100 text-yellow-800',
    analyze: 'bg-orange-100 text-orange-800',
    evaluate: 'bg-red-100 text-red-800',
    create: 'bg-purple-100 text-purple-800',
  };

  const typeLabels: Record<string, string> = {
    multiple_choice: 'MCQ',
    short_answer: 'Short',
    structured: 'Structured',
    essay: 'Essay',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Paper Generator"
        description="Generate CBC-aligned exam papers with marking schemes"
        icon={<FileText className="h-6 w-6" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exam Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Subject *"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Select value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade *">
              <option value="">Select grade</option>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Duration (min)"
              type="number"
              min="10"
              max="180"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Total marks"
              type="number"
              min="5"
              max="100"
              value={totalMarks}
              onChange={(e) => setTotalMarks(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select value={learningAreaId} onChange={(e) => setLearningAreaId(e.target.value)} placeholder="Learning Area (optional)">
              <option value="">All learning areas</option>
              {learningAreas.map((la) => (
                <option key={la.learningAreaId} value={la.learningAreaId}>{la.name}</option>
              ))}
            </Select>
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Strand / Topic (optional)"
              value={strand}
              onChange={(e) => setStrand(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Question Types</label>
            <div className="flex flex-wrap gap-2">
              {QUESTION_TYPES.map((qt) => (
                <button
                  key={qt.value}
                  type="button"
                  onClick={() => toggleQuestionType(qt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedTypes.includes(qt.value)
                      ? 'bg-primary-100 text-primary-800 ring-1 ring-primary-500'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {qt.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            leftIcon={<Sparkles className="h-4 w-4" />}
            onClick={handleGenerate}
            loading={isGenerating}
            disabled={!subject.trim() || !grade || selectedTypes.length === 0}
          >
            Generate Exam Paper
          </Button>
        </CardContent>
      </Card>

      {isGenerating && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Generating exam paper with marking scheme...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && !isGenerating && (
        <Tabs defaultValue="exam" className="space-y-4">
          <TabsList>
            <TabsTrigger value="exam"><FileText className="h-4 w-4 mr-1" /> Exam Paper</TabsTrigger>
            <TabsTrigger value="marking"><CheckSquare className="h-4 w-4 mr-1" /> Marking Scheme</TabsTrigger>
            <TabsTrigger value="bloom"><BarChart className="h-4 w-4 mr-1" /> Bloom's Taxonomy</TabsTrigger>
          </TabsList>

          <TabsContent value="exam">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-5 w-5" />
                  {result.exam.title}
                  <Badge variant="primary" size="sm">{result.exam.grade}</Badge>
                  <Badge variant="info" size="sm">{result.exam.totalMarks} marks</Badge>
                  <Badge variant="info" size="sm">{result.exam.durationMinutes} min</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="font-medium text-gray-900 mb-1">Instructions:</p>
                  <p>{result.exam.instructions}</p>
                </div>

                {(result.exam?.questions ?? []).map((q) => (
                  <div key={q.number} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800">
                          {q.number}
                        </span>
                        <Badge variant="default" size="sm">{typeLabels[q.type] || q.type}</Badge>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${bloomColors[q.bloomLevel] || 'bg-gray-100 text-gray-800'}`}>
                          {q.bloomLevel}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-600">{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-sm text-gray-900">{q.prompt}</p>
                    {q.options && q.options.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, j) => (
                          <label key={j} className="flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                            <input type="radio" name={`q-${q.number}`} className="h-3.5 w-3.5" disabled />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex gap-2">
                  <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={handleGenerate} loading={isGenerating}>
                    Regenerate
                  </Button>
                  <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={() => window.print()}>
                    Print
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="marking">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Marking Scheme</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(result.exam?.markingScheme ?? []).map((ms) => (
                  <div key={ms.questionNumber} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">Question {ms.questionNumber}</span>
                      <Badge variant="primary" size="sm">{ms.totalMarks} marks</Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600">Expected Points:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {(ms.expectedPoints ?? []).map((point, i) => (
                          <li key={i} className="text-sm text-gray-700">{point}</li>
                        ))}
                      </ul>
                      <div className="mt-2 rounded-lg bg-blue-50 p-3">
                        <p className="text-xs font-medium text-blue-700 mb-1">Rubric:</p>
                        <p className="text-sm text-blue-800">{ms.rubric}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bloom">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bloom's Taxonomy Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(result.exam?.bloomTaxonomyBreakdown ?? {}).map(([level, marks]) => (
                    <div key={level} className="flex items-center gap-3">
                      <span className={`w-20 rounded-full px-2 py-0.5 text-xs font-medium text-center ${bloomColors[level] || 'bg-gray-100 text-gray-800'}`}>
                        {level}
                      </span>
                      <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary-500 transition-all"
                          style={{ width: `${(marks / result.exam.totalMarks) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-600 w-16 text-right">{marks} marks</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
