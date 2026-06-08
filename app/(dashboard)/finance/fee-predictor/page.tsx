'use client';

import React, { useState, useCallback } from 'react';
import { DollarSign, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableWrapper, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { useReferenceData } from '@/hooks/useReferenceData';

interface FeeRiskResult {
  studentId: string;
  studentName: string;
  riskLevel: string;
  riskScore: number;
  factors: string[];
  recommendations: string[];
  optimalReminderDay?: number;
  confidence: number;
}

export default function FeePredictorPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { classes: referenceClasses } = useReferenceData({ enabled: Boolean(user) });

  const [selectedClassId, setSelectedClassId] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<FeeRiskResult[]>([]);

  const classes = (referenceClasses || []).map((c: any) => ({
    classId: c.classId || c.id,
    name: c.name,
  }));

  const handleAnalyze = useCallback(async () => {
    if (!selectedClassId) {
      error('Please select a class');
      return;
    }

    setIsAnalyzing(true);
    setResults([]);

    try {
      const res = await fetch('/api/fee-predictor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClassId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      const items = Array.isArray(data.data) ? data.data : [data.data];
      setResults(items);
      success(`Analyzed ${items.length} students`);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to analyze fees');
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedClassId, error, success]);

  const highRisk = results.filter((r) => r.riskLevel === 'high').length;
  const mediumRisk = results.filter((r) => r.riskLevel === 'medium').length;
  const lowRisk = results.filter((r) => r.riskLevel === 'low').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Collection Predictor"
        description="Analyze payment patterns and predict default risk"
        icon={<DollarSign className="h-6 w-6" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Class</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-72"
              placeholder="Select class"
            >
              <option value="">Select a class</option>
              {classes.map((cls: any) => (
                <option key={cls.classId} value={cls.classId}>{cls.name}</option>
              ))}
            </Select>
            <Button
              leftIcon={<TrendingUp className="h-4 w-4" />}
              onClick={handleAnalyze}
              loading={isAnalyzing}
              disabled={!selectedClassId}
            >
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Total</p>
                    <p className="mt-1 text-2xl font-bold">{results.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500">High Risk</p>
                    <p className="mt-1 text-2xl font-bold text-error-600">{highRisk}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-error-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Medium Risk</p>
                    <p className="mt-1 text-2xl font-bold text-amber-600">{mediumRisk}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Low Risk</p>
                    <p className="mt-1 text-2xl font-bold text-success-600">{lowRisk}</p>
                  </div>
                  <Users className="h-8 w-8 text-success-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student Risk Analysis</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Factors</TableHead>
                      <TableHead>Optimal Reminder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.studentId}>
                        <TableCell className="font-medium">{r.studentName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={r.riskLevel === 'high' ? 'error' : r.riskLevel === 'medium' ? 'warning' : 'success'}
                            size="sm"
                          >
                            {r.riskLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.riskScore.toFixed(1)}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {r.factors.map((f, i) => (
                              <Badge key={i} variant="outline" size="xs">{f}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.optimalReminderDay ? `Day ${r.optimalReminderDay}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
