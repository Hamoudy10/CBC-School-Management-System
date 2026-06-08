'use client';

import React, { useState, useCallback } from 'react';
import { Calendar, Clock, RefreshCw, AlertCircle } from 'lucide-react';
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

interface TimetableSlot {
  day: string;
  period: number;
  subject: string;
  teacher: string;
  classId: string;
  room?: string;
}

interface TimetableResult {
  suggestions: TimetableSlot[];
  conflicts: string[];
}

export default function TimetableOptimizerPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { classes: referenceClasses } = useReferenceData({ enabled: Boolean(user) });

  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<TimetableResult | null>(null);

  const classes = (referenceClasses || []).map((c: any) => ({
    classId: c.classId || c.id,
    name: c.name,
  }));

  const handleGenerate = useCallback(async () => {
    if (selectedClassIds.length === 0) {
      error('Please select at least one class');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch('/api/timetable-optimizer/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classIds: selectedClassIds,
          preferences: {
            teacherMaxPeriodsPerDay: 6,
            maxConsecutivePeriods: 3,
            preferMorningCore: true,
            includeBreaks: true,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      setResult(data.data);
      success('Timetable suggestions generated');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to generate timetable');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedClassIds, error, success]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable Optimizer"
        description="AI-assisted conflict-free timetable suggestions"
        icon={<Calendar className="h-6 w-6" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              value={selectedClassIds[0] ?? ''}
              onChange={(e) => setSelectedClassIds(e.target.value ? [e.target.value] : [])}
              className="w-72"
              placeholder="Select class"
            >
              <option value="">Select a class</option>
              {classes.map((cls: any) => (
                <option key={cls.classId} value={cls.classId}>{cls.name}</option>
              ))}
            </Select>

            <Button
              leftIcon={<Clock className="h-4 w-4" />}
              onClick={handleGenerate}
              loading={isGenerating}
              disabled={selectedClassIds.length === 0}
            >
              Generate Suggestions
            </Button>
          </div>
        </CardContent>
      </Card>

      {isGenerating && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Generating optimal timetable...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && !isGenerating && (
        <div className="space-y-4">
          {result.conflicts.length > 0 && (
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Potential Conflicts</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 text-sm">
                  {result.conflicts.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5" />
                Suggested Timetable
                <Badge variant="primary" size="sm">{result.suggestions.length} slots</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-3 py-2 text-left font-medium text-gray-600">Period</th>
                    {days.map((day) => (
                      <th key={day} className="border px-3 py-2 text-left font-medium text-gray-600">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }, (_, period) => (
                    <tr key={period}>
                      <td className="border px-3 py-2 font-medium text-gray-500">{period + 1}</td>
                      {days.map((day) => {
                        const slot = result.suggestions.find((s) => s.day === day && s.period === period + 1);
                        return (
                          <td key={day} className="border px-3 py-2">
                            {slot ? (
                              <div className="text-xs">
                                <p className="font-medium text-gray-900">{slot.subject}</p>
                                <p className="text-gray-500">{slot.teacher}</p>
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={handleGenerate} loading={isGenerating}>
              Regenerate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
