'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Users, Search, TrendingDown, TrendingUp, Minus } from 'lucide-react';
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

interface WeakArea {
  learningAreaName: string;
  averageScore: number;
  overallLevel: string;
  studentCount: number;
  trend: 'improving' | 'declining' | 'stable';
}

interface StudentGap {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  learningAreaName: string;
  averageScore: number;
  overallLevel: string;
  gapLevel: string;
}

interface TrendPoint {
  term: string;
  score: number;
}

const levelColors: Record<string, string> = {
  exceeding: 'bg-blue-100 text-blue-800',
  meeting: 'bg-green-100 text-green-800',
  approaching: 'bg-amber-100 text-amber-800',
  below_expectation: 'bg-red-100 text-red-800',
};

export default function CompetencyGapsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { classes: referenceClasses, learningAreas } = useReferenceData({ enabled: Boolean(user), includeLearningAreas: true });

  const [classId, setClassId] = useState('');
  const [loading, setLoading] = useState(false);
  const [weakAreas, setWeakAreas] = useState<WeakArea[]>([]);
  const [studentGaps, setStudentGaps] = useState<StudentGap[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [selectedArea, setSelectedArea] = useState('');

  const fetchData = useCallback(async () => {
    if (!classId) {return;}
    setLoading(true);
    try {
      const params = new URLSearchParams({ classId });

      const [areaRes, trendRes] = await Promise.all([
        fetch(`/api/assessments/area-results?${params}`, { credentials: 'include' }),
        fetch(`/api/assessments/trends?${params}`, { credentials: 'include' }),
      ]);

      if (areaRes.ok) {
        const areaJson = await areaRes.json();
        const areas = (areaJson.data ?? []) as any[];
        const mapped: WeakArea[] = areas.map((a: any) => ({
          learningAreaName: a.learningAreaName ?? a.learning_area_name ?? 'Unknown',
          averageScore: a.averageScore ?? a.average_score ?? 0,
          overallLevel: a.overallLevel ?? a.overall_level ?? 'approaching',
          studentCount: a.studentCount ?? a.student_count ?? 0,
          trend: a.trend ?? 'stable',
        }));
        setWeakAreas(mapped.sort((a, b) => a.averageScore - b.averageScore));
      }

      if (trendRes.ok) {
        const trendJson = await trendRes.json();
        setTrendData((trendJson.data ?? []).map((t: any) => ({
          term: t.term ?? t.term_name ?? 'Unknown',
          score: t.averageScore ?? t.average_score ?? 0,
        })));
      }
    } catch {
      error('Failed to load competency data');
    } finally { setLoading(false); }
  }, [classId, error]);

  const analyzeGaps = useCallback(async () => {
    if (!classId) {return;}
    setLoading(true);
    try {
      const res = await fetch('/api/reports-ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ class_id: classId }),
      });
      const json = await res.json();
      if (res.ok) {
        success('AI gap analysis complete');
      }
    } catch {
      error('AI analysis failed');
    } finally { setLoading(false); }
  }, [classId, success, error]);

  useEffect(() => {
    if (classId) {fetchData();}
  }, [classId, fetchData]);

  const weakestAreas = weakAreas.slice(0, 5);
  const maxScore = Math.max(...weakAreas.map((w) => w.averageScore), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competency Gap Dashboard"
        description="Identify weak areas and performance gaps across students and learning areas"
        icon={<BarChart className="h-6 w-6" />}
      />

      <Card>
        <CardContent className="flex items-center gap-3 pt-4">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Select class">
            <option value="">All classes</option>
            {referenceClasses.map((c) => <option key={c.classId} value={c.classId}>{c.name}</option>)}
          </Select>
          <Button variant="outline" leftIcon={<Search className="h-4 w-4" />} onClick={fetchData} loading={loading}>
            Load Data
          </Button>
          <Button variant="outline" leftIcon={<BarChart className="h-4 w-4" />} onClick={analyzeGaps} loading={loading}>
            AI Gap Analysis
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Spinner size="lg" />
            <span className="ml-3 text-sm text-gray-500">Analyzing competency gaps...</span>
          </CardContent>
        </Card>
      )}

      {!loading && classId && (
        <Tabs defaultValue="areas">
          <TabsList>
            <TabsTrigger value="areas"><BarChart className="h-4 w-4 mr-1" /> Weakest Areas</TabsTrigger>
            <TabsTrigger value="students"><Users className="h-4 w-4 mr-1" /> Student Gaps</TabsTrigger>
            <TabsTrigger value="trends"><TrendingDown className="h-4 w-4 mr-1" /> Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="areas" className="space-y-4">
            {weakAreas.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-gray-500">No assessment data found. Enter assessments first.</CardContent></Card>
            ) : (
              <Card>
                <CardHeader><CardTitle className="text-base">Learning Area Performance (Lowest First)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {weakAreas.map((area) => (
                    <div key={area.learningAreaName} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{area.learningAreaName}</span>
                          <Badge variant={area.overallLevel as any} size="xs">{area.overallLevel.replace('_', ' ')}</Badge>
                          {area.trend === 'declining' ? (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          ) : area.trend === 'improving' ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <Minus className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-600">{area.averageScore.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-primary-500" style={{ width: `${(area.averageScore / 100) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{area.studentCount} students</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="students" className="space-y-4">
            {studentGaps.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-gray-500">Run AI Gap Analysis to see per-student gaps.</CardContent></Card>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Student</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Adm No</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Learning Area</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Score</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {studentGaps.map((gap, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{gap.studentName}</td>
                        <td className="px-4 py-2.5 text-gray-600">{gap.admissionNumber}</td>
                        <td className="px-4 py-2.5 text-gray-700">{gap.learningAreaName}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{gap.averageScore.toFixed(1)}%</td>
                        <td className="px-4 py-2.5"><Badge variant={gap.overallLevel as any} size="xs">{gap.overallLevel.replace('_', ' ')}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            {trendData.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-gray-500">No trend data available.</CardContent></Card>
            ) : (
              <Card>
                <CardHeader><CardTitle className="text-base">Performance Trends</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {trendData.map((tp) => (
                      <div key={tp.term} className="flex items-center gap-3">
                        <span className="w-24 text-sm font-medium text-gray-700">{tp.term}</span>
                        <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-primary-500" style={{ width: `${tp.score}%` }} />
                        </div>
                        <span className="w-12 text-right text-sm font-medium text-gray-600">{tp.score.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {!classId && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Select a class and load data to see competency gaps</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
