'use client';

import React, { useState, useCallback } from 'react';
import { CheckSquare, ClipboardList, RefreshCw, BookOpen } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useReferenceData } from '@/hooks/useReferenceData';

interface AlignmentResult {
  overallScore: number;
  alignedCompetencies: string[];
  missingCompetencies: string[];
  suggestions: string[];
}

export default function CurriculumAlignmentPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { learningAreas } = useReferenceData({ enabled: Boolean(user), includeLearningAreas: true });

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [duration, setDuration] = useState('');
  const [objectives, setObjectives] = useState('');
  const [activities, setActivities] = useState('');
  const [assessmentMethods, setAssessmentMethods] = useState('');
  const [materials, setMaterials] = useState('');
  const [learningAreaId, setLearningAreaId] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<AlignmentResult | null>(null);

  const handleCheck = useCallback(async () => {
    if (!title.trim() || !subject.trim() || !grade.trim() || !duration.trim() || !objectives.trim() || !activities.trim() || !assessmentMethods.trim()) {
      error('Please fill in all required fields');
      return;
    }

    setIsChecking(true);
    setResult(null);

    try {
      const res = await fetch('/api/curriculum-alignment/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonPlan: {
            title: title.trim(),
            subject: subject.trim(),
            grade: grade.trim(),
            duration: duration.trim(),
            objectives: objectives.split('\n').filter(Boolean),
            activities: activities.split('\n').filter(Boolean),
            assessmentMethods: assessmentMethods.split('\n').filter(Boolean),
            materials: materials.trim() ? materials.split('\n').filter(Boolean) : undefined,
          },
          learningAreaId: learningAreaId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check failed');

      setResult(data.data);
      success('Alignment check complete');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to check alignment');
    } finally {
      setIsChecking(false);
    }
  }, [title, subject, grade, duration, objectives, activities, assessmentMethods, materials, learningAreaId, error, success]);

  const scoreColor = result
    ? result.overallScore >= 70 ? 'text-green-600' : result.overallScore >= 40 ? 'text-amber-600' : 'text-red-600'
    : '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum Alignment Checker"
        description="Check lesson plans against KICD CBC competencies"
        icon={<CheckSquare className="h-6 w-6" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lesson Plan Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Lesson title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Subject / Learning Area *"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Grade (e.g. Grade 4) *"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            />
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Duration (e.g. 40 min) *"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <Select
            value={learningAreaId}
            onChange={(e) => setLearningAreaId(e.target.value)}
            placeholder="CBC Learning Area (optional)"
          >
            <option value="">All learning areas</option>
            {learningAreas.map((la) => (
              <option key={la.learningAreaId} value={la.learningAreaId}>{la.name}</option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Objectives (one per line) *</label>
              <textarea
                className="w-full min-h-[120px] rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Understand fractions..."
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Activities (one per line) *</label>
              <textarea
                className="w-full min-h-[120px] rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Group discussion..."
                value={activities}
                onChange={(e) => setActivities(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assessment Methods (one per line) *</label>
              <textarea
                className="w-full min-h-[120px] rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Oral questions..."
                value={assessmentMethods}
                onChange={(e) => setAssessmentMethods(e.target.value)}
              />
            </div>
          </div>
          <textarea
            className="w-full min-h-[80px] rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Materials (one per line, optional)"
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
          />
          <Button
            leftIcon={<ClipboardList className="h-4 w-4" />}
            onClick={handleCheck}
            loading={isChecking}
            disabled={!title.trim() || !subject.trim() || !grade.trim() || !duration.trim() || !objectives.trim() || !activities.trim() || !assessmentMethods.trim()}
          >
            Check Alignment
          </Button>
        </CardContent>
      </Card>

      {isChecking && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Analyzing against CBC standards...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && !isChecking && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Alignment Score</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center py-8">
              <span className={`text-5xl font-bold ${scoreColor}`}>
                {result.overallScore}%
              </span>
              <Badge
                variant={result.overallScore >= 70 ? 'success' : result.overallScore >= 40 ? 'warning' : 'error'}
                size="md"
                className="mt-2"
              >
                {result.overallScore >= 70 ? 'Well Aligned' : result.overallScore >= 40 ? 'Partially Aligned' : 'Needs Revision'}
              </Badge>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  Aligned Competencies ({result.alignedCompetencies.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.alignedCompetencies.length === 0 ? (
                  <p className="text-sm text-gray-500">No competencies aligned</p>
                ) : (
                  <ul className="space-y-1">
                    {result.alignedCompetencies.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  Missing Competencies ({result.missingCompetencies.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.missingCompetencies.length === 0 ? (
                  <p className="text-sm text-green-600">All competencies covered</p>
                ) : (
                  <ul className="space-y-1">
                    {result.missingCompetencies.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {result.suggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Improvement Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                        {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
