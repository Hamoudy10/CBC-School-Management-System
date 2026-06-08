'use client';

import React, { useState, useCallback } from 'react';
import { CheckSquare, ClipboardList, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface AlignmentResult {
  overallScore: number;
  alignedCompetencies: string[];
  missingCompetencies: string[];
  suggestions: string[];
}

export default function CurriculumAlignmentPage() {
  const { success, error } = useToast();
  const [lessonPlan, setLessonPlan] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<AlignmentResult | null>(null);

  const handleCheck = useCallback(async () => {
    if (!lessonPlan.trim()) {
      error('Please enter a lesson plan');
      return;
    }

    setIsChecking(true);
    setResult(null);

    try {
      const res = await fetch('/api/curriculum-alignment/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonPlan: lessonPlan.trim() }),
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
  }, [lessonPlan, error, success]);

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
          <CardTitle className="text-base">Lesson Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full min-h-[200px] rounded-lg border border-gray-300 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Paste your lesson plan here..."
            value={lessonPlan}
            onChange={(e) => setLessonPlan(e.target.value)}
          />
          <Button
            leftIcon={<ClipboardList className="h-4 w-4" />}
            onClick={handleCheck}
            loading={isChecking}
            disabled={!lessonPlan.trim()}
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
