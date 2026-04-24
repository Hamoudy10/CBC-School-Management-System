'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import type { ReportInsights } from '../types/report-ai.types';

interface ReportInsightsGeneratorProps {
  onInsightsGenerated?: (insights: ReportInsights) => void;
}

export function ReportInsightsGenerator({ onInsightsGenerated }: ReportInsightsGeneratorProps) {
  const [studentId, setStudentId] = useState('');
  const [termId, setTermId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [insights, setInsights] = useState<ReportInsights | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = async () => {
    if (!studentId || !termId || !academicYear || !schoolId) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generatedInsights: ReportInsights = {
        student_id: studentId,
        term_id: termId,
        academic_year: academicYear,
        strengths: [
          {
            competency: 'Reading',
            level: 'Exceeding Expectations',
            description: 'Strong comprehension and confident reading fluency.'
          },
          {
            competency: 'Number Sense',
            level: 'Meeting Expectations',
            description: 'Solid understanding of core number operations.'
          }
        ],
        weaknesses: [
          {
            competency: 'Writing',
            level: 'Meeting Expectations',
            description: 'Needs practice with structure and clarity in longer responses.',
            improvement_actions: [
              'Daily short writing tasks',
              'Use sentence starters',
              'Review with teacher feedback'
            ]
          }
        ],
        recommendations: [
          {
            priority: 'high',
            category: 'academic',
            action: 'Provide structured writing practice for the next 3 weeks.',
            timeline: '2-3 weeks',
            responsible_party: 'teacher'
          },
          {
            priority: 'medium',
            category: 'academic',
            action: 'Reinforce multiplication and division facts at home and school.',
            timeline: '1 month',
            responsible_party: 'both'
          }
        ],
        overall_performance: 'good'
      };

      setInsights(generatedInsights);
      if (onInsightsGenerated) {
        onInsightsGenerated(generatedInsights);
      }
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate insights.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getPriorityColor = (priority: ReportInsights['recommendations'][number]['priority']) => {
    if (priority === 'high') {
      return 'bg-red-50 text-red-600';
    }
    if (priority === 'medium') {
      return 'bg-yellow-50 text-yellow-600';
    }
    return 'bg-green-50 text-green-600';
  };

  const getCategoryColor = (category: ReportInsights['recommendations'][number]['category']) => {
    if (category === 'academic') {
      return 'bg-blue-50 text-blue-600';
    }
    if (category === 'social') {
      return 'bg-purple-50 text-purple-600';
    }
    if (category === 'behavioral') {
      return 'bg-orange-50 text-orange-600';
    }
    return 'bg-indigo-50 text-indigo-600';
  };

  const getPerformanceColor = (performance: ReportInsights['overall_performance']) => {
    if (performance === 'excellent') {
      return 'bg-green-50 text-green-600';
    }
    if (performance === 'good') {
      return 'bg-blue-50 text-blue-600';
    }
    if (performance === 'average') {
      return 'bg-yellow-50 text-yellow-600';
    }
    if (performance === 'needs_improvement') {
      return 'bg-orange-50 text-orange-600';
    }
    return 'bg-red-50 text-red-600';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Report Insights Generator</CardTitle>
          <CardDescription>
            Generate structured strengths, gaps, and practical recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Input id="student-id" label="Student ID" placeholder="e.g., STU001" value={studentId} onChange={(event) => setStudentId(event.target.value)} />
            <Select id="term-id" label="Term" value={termId} onChange={(event) => setTermId(event.target.value)}>
              <option value="">Select term</option>
              <option value="TERM_1">First Term</option>
              <option value="TERM_2">Second Term</option>
              <option value="TERM_3">Third Term</option>
            </Select>
            <Select id="academic-year" label="Academic Year" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>
              <option value="">Select year</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2025_2026">2025-2026</option>
            </Select>
            <Input id="school-id" label="School ID" placeholder="e.g., SCH001" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} />
          </div>

          <Button onClick={generateInsights} disabled={isGenerating} className="mt-4 w-full">
            {isGenerating ? 'Generating Insights...' : 'Generate AI Insights'}
          </Button>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {insights && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>AI-Generated Insights</span>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${getPerformanceColor(insights.overall_performance)}`}>
                {insights.overall_performance.replace('_', ' ').toUpperCase()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h4 className="mb-3 font-semibold text-green-700">Strengths</h4>
                <div className="space-y-2">
                  {insights.strengths.map((strength, index: number) => (
                    <div key={`${strength.competency}-${index}`} className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <div className="mb-1 flex items-start justify-between">
                        <span className="font-medium text-green-800">{strength.competency}</span>
                        <span className="rounded-full bg-green-200 px-2 py-1 text-xs text-green-800">
                          {strength.level}
                        </span>
                      </div>
                      <p className="text-sm text-green-700">{strength.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-semibold text-red-700">Areas for Improvement</h4>
                <div className="space-y-2">
                  {insights.weaknesses.map((weakness, index: number) => (
                    <div key={`${weakness.competency}-${index}`} className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="mb-1 flex items-start justify-between">
                        <span className="font-medium text-red-800">{weakness.competency}</span>
                        <span className="rounded-full bg-red-200 px-2 py-1 text-xs text-red-800">
                          {weakness.level}
                        </span>
                      </div>
                      <p className="mb-2 text-sm text-red-700">{weakness.description}</p>
                      <p className="mb-1 text-xs font-medium text-red-600">Improvement Actions:</p>
                      <ul className="space-y-1 text-xs text-red-600">
                        {weakness.improvement_actions.map((action, actionIndex: number) => (
                          <li key={`${weakness.competency}-action-${actionIndex}`}>- {action}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-semibold text-blue-700">Recommendations</h4>
                <div className="space-y-3">
                  {insights.recommendations.map((recommendation, index: number) => (
                    <div key={`${recommendation.action}-${index}`} className="rounded-lg border bg-white p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${getPriorityColor(recommendation.priority)}`}>
                            {recommendation.priority.toUpperCase()}
                          </span>
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${getCategoryColor(recommendation.category)}`}>
                            {recommendation.category}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">{recommendation.timeline}</span>
                      </div>
                      <p className="mb-2 text-sm text-gray-700">{recommendation.action}</p>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Responsible:</span>{' '}
                        <span className="capitalize">{recommendation.responsible_party}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
