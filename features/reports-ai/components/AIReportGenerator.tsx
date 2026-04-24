'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAIReportGeneration, type GeneratedAIReport } from './useAIReportGeneration';
import type { AIReportGenerationRequest, ReportInsights } from '../types/report-ai.types';

interface AIReportGeneratorProps {
  request: AIReportGenerationRequest;
  onReportGenerated?: (report: GeneratedAIReport) => void;
}

export function AIReportGenerator({ request, onReportGenerated }: AIReportGeneratorProps) {
  const {
    isGenerating,
    report,
    error,
    progress,
    generateReport,
    reset
  } = useAIReportGeneration();

  useEffect(() => {
    if (report && onReportGenerated) {
      onReportGenerated(report);
    }
  }, [report, onReportGenerated]);

  const handleGenerate = () => {
    void generateReport(request);
  };

  const handleDownload = () => {
    if (report?.pdf_url) {
      window.open(report.pdf_url, '_blank');
    }
  };

  if (report) {
    const insights = report.insights as ReportInsights | undefined;

    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            AI-Generated Report
            <Button onClick={handleDownload} variant="outline" disabled={!report.pdf_url}>
              Download PDF
            </Button>
          </CardTitle>
          <CardDescription>
            Report generated with AI on {new Date(report.generated_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-green-50 p-4">
                <h4 className="font-semibold text-green-800">AI Confidence</h4>
                <p className="text-2xl font-bold text-green-600">
                  {(report.ai_confidence * 100).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <h4 className="font-semibold text-blue-800">Processing Time</h4>
                <p className="text-2xl font-bold text-blue-600">
                  {report.processing_time}ms
                </p>
              </div>
            </div>

            {insights && (
              <div className="mt-6">
                <h4 className="mb-3 font-semibold">AI Insights</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <h5 className="font-medium text-green-700">Strengths</h5>
                    <ul className="mt-2 space-y-1">
                      {insights.strengths.slice(0, 3).map((strength, index: number) => (
                        <li key={`${strength.competency}-${index}`} className="text-sm text-gray-600">
                          - {strength.description}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h5 className="font-medium text-red-700">Areas for Improvement</h5>
                    <ul className="mt-2 space-y-1">
                      {insights.weaknesses.slice(0, 3).map((weakness, index: number) => (
                        <li key={`${weakness.competency}-${index}`} className="text-sm text-gray-600">
                          - {weakness.description}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h5 className="font-medium text-blue-700">Recommendations</h5>
                    <ul className="mt-2 space-y-1">
                      {insights.recommendations.slice(0, 3).map((recommendation, index: number) => (
                        <li key={`${recommendation.category}-${index}`} className="text-sm text-gray-600">
                          - {recommendation.action}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {report.parent_summary && (
              <div className="mt-6 rounded-lg bg-yellow-50 p-4">
                <h4 className="mb-2 font-semibold text-yellow-800">Parent-Friendly Summary</h4>
                <p className="text-sm leading-relaxed text-gray-700">{report.parent_summary}</p>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <Button onClick={reset} variant="outline">
                Generate New Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AI Report Generator</CardTitle>
        <CardDescription>
          Generate an intelligent CBC report with AI-powered insights.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isGenerating && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Generating AI report...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full rounded bg-secondary-200">
                <div
                  className="h-2 rounded bg-primary-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">
                Analyzing performance, generating insights, and preparing parent-friendly content.
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h4 className="mb-2 font-medium text-red-800">Error</h4>
              <p className="mb-3 text-sm text-red-600">{error}</p>
              <Button onClick={reset} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          )}

          {!isGenerating && !error && (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 p-4">
                <h4 className="mb-2 font-medium text-blue-800">AI-Powered Features</h4>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>- Intelligent student performance analysis</li>
                  <li>- Personalized improvement recommendations</li>
                  <li>- Parent-friendly summaries and translations</li>
                  <li>- Automated classroom insights</li>
                  <li>- Trend-aware guidance</li>
                </ul>
              </div>

              <Button onClick={handleGenerate} className="w-full" disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate AI Report'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
