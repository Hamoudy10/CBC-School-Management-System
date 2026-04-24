'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ReportUtils } from '../utils/report-utils';

interface ReportInsightsGeneratorProps {
  onInsightsGenerated?: (insights: any) => void;
}

export function ReportInsightsGenerator({ onInsightsGenerated }: ReportInsightsGeneratorProps) {
  const [studentId, setStudentId] = useState('');
  const [termId, setTermId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [insights, setInsights] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportUtils = new ReportUtils();

  const mockReportData = {
    student_info: {
      id: studentId,
      name: 'John Doe',
      admission_number: 'ADM001',
      class: 'Grade 5',
      class_teacher: 'Mrs. Wangari',
      term: termId,
      year: academicYear,
      school_name: 'Example Primary School'
    },
    learning_areas: [
      {
        code: 'MAT',
        name: 'Mathematics',
        score: 75,
        level: 'Meeting Expectations',
        comment: 'Good understanding of basic operations',
        competencies: [
          {
            code: 'MAT.01',
            name: 'Number Sense',
            score: 80,
            level: 'Meeting Expectations',
            comment: 'Strong understanding of place value'
          },
          {
            code: 'MAT.02',
            name: 'Operations',
            score: 70,
            level: 'Meeting Expectations',
            comment: 'Good with addition and subtraction'
          }
        ]
      },
      {
        code: 'ENG',
        name: 'English',
        score: 85,
        level: 'Exceeding Expectations',
        comment: 'Excellent reading comprehension',
        competencies: [
          {
            code: 'ENG.01',
            name: 'Reading',
            score: 90,
            level: 'Exceeding Expectations',
            comment: 'Fluent reader with good comprehension'
          },
          {
            code: 'ENG.02',
            name: 'Writing',
            score: 80,
            level: 'Meeting Expectations',
            comment: 'Clear writing with good structure'
          }
        ]
      }
    ],
    summary: {
      total_subjects: 2,
      average_score: 80,
      overall_level: 'Good',
      attendance_percentage: 95,
      total_days_present: 95,
      total_days_absent: 5
    }
  };

  const generateInsights = async () => {
    if (!studentId || !termId || !academicYear || !schoolId) {
      setError('Please fill in all required fields');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // This would normally call the AI service
      // For now, we'll use mock data and the report utils
      const mockInsights = {
        strengths: [
          {
            competency: 'Reading',
            level: 'Exceeding Expectations',
            description: 'Excellent reading comprehension skills'
          },
          {
            competency: 'Number Sense',
            level: 'Meeting Expectations',
            description: 'Strong understanding of mathematical concepts'
          }
        ],
        weaknesses: [
          {
            competency: 'Writing',
            level: 'Meeting Expectations',
            description: 'Could benefit from more practice with creative writing',
            improvement_actions: ['Practice writing daily', 'Read more examples', 'Get feedback from teacher']
          },
          {
            competency: 'Operations',
            level: 'Meeting Expectations',
            description: 'Needs more practice with multiplication and division',
            improvement_actions: ['Use flashcards', 'Practice math games', 'Do daily drills']
          }
        ],
        recommendations: [
          {
            priority: 'high',
            category: 'academic',
            action: 'Provide additional writing practice opportunities',
            timeline: '2-3 weeks',
            responsible_party: 'teacher'
          },
          {
            priority: 'medium',
            category: 'academic',
            action: 'Focus on multiplication and division skills',
            timeline: '1 month',
            responsible_party: 'both'
          },
          {
            priority: 'low',
            category: 'attendance',
            action: 'Maintain good attendance record',
            timeline: 'ongoing',
            responsible_party: 'parent'
          }
        ],
        overall_performance: 'good'
      };

      setInsights(mockInsights);
      
      if (onInsightsGenerated) {
        onInsightsGenerated(mockInsights);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setIsGenerating(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'academic': return 'text-blue-600 bg-blue-50';
      case 'social': return 'text-purple-600 bg-purple-50';
      case 'behavioral': return 'text-orange-600 bg-orange-50';
      case 'attendance': return 'text-indigo-600 bg-indigo-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'average': return 'text-yellow-600 bg-yellow-50';
      case 'needs_improvement': return 'text-orange-600 bg-orange-50';
      case 'concerning': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Report Insights Generator</CardTitle>
          <CardDescription>
            Generate intelligent insights and recommendations for student reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="student-id">Student ID</Label>
              <Input
                id="student-id"
                placeholder="e.g., STU001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="term-id">Term</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TERM_1">First Term</SelectItem>
                  <SelectItem value="TERM_2">Second Term</SelectItem>
                  <SelectItem value="TERM_3">Third Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="academic-year">Academic Year</Label>
              <Select value={academicYear} onValueChange={setAcademicYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2025_2026">2025-2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="school-id">School ID</Label>
              <Input
                id="school-id"
                placeholder="e.g., SCH001"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={generateInsights}
            disabled={isGenerating}
            className="w-full mt-4"
          >
            {isGenerating ? 'Generating Insights...' : 'Generate AI Insights'}
          </Button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {insights && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>AI-Generated Insights</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPerformanceColor(insights.overall_performance)}`}>
                  {insights.overall_performance.replace('_', ' ').toUpperCase()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-green-700 mb-3">🎯 Strengths</h4>
                  <div className="space-y-2">
                    {insights.strengths.map((strength: any, index: number) => (
                      <div key={index} className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-green-800">{strength.competency}</span>
                          <span className="text-xs px-2 py-1 bg-green-200 text-green-800 rounded-full">
                            {strength.level}
                          </span>
                        </div>
                        <p className="text-sm text-green-700">{strength.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-red-700 mb-3">⚠️ Areas for Improvement</h4>
                  <div className="space-y-2">
                    {insights.weaknesses.map((weakness: any, index: number) => (
                      <div key={index} className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-red-800">{weakness.competency}</span>
                          <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded-full">
                            {weakness.level}
                          </span>
                        </div>
                        <p className="text-sm text-red-700 mb-2">{weakness.description}</p>
                        <div>
                          <p className="text-xs font-medium text-red-600 mb-1">Improvement Actions:</p>
                          <ul className="text-xs text-red-600 space-y-1">
                            {weakness.improvement_actions.map((action: string, actionIndex: number) => (
                              <li key={actionIndex} className="flex items-start">
                                <span className="mr-1">•</span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-blue-700 mb-3">📋 Recommendations</h4>
                  <div className="space-y-3">
                    {insights.recommendations.map((recommendation: any, index: number) => (
                      <div key={index} className="p-4 bg-white rounded-lg border">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(recommendation.priority)}`}>
                              {recommendation.priority.toUpperCase()}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(recommendation.category)}`}>
                              {recommendation.category}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">{recommendation.timeline}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{recommendation.action}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <span className="font-medium">Responsible:</span>
                          <span className="ml-1 capitalize">{recommendation.responsible_party}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}