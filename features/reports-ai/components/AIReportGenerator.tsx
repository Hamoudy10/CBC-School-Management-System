'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAIReportGeneration } from './useAIReportGeneration';
import type { AIReportGenerationRequest } from '../types/report-ai.types';

interface AIReportGeneratorProps {
  request: AIReportGenerationRequest;
  onReportGenerated?: (report: any) => void;
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

  const handleGenerate = () => {
    generateReport(request);
  };

  const handleDownload = () => {
    if (report && report.pdf_url) {
      window.open(report.pdf_url, '_blank');
    }
  };

  useEffect(() => {
    if (report && onReportGenerated) {
      onReportGenerated(report);
    }
  }, [report, onReportGenerated]);

  if (report) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            AI-Generated Report
            <Button 
              onClick={handleDownload}
              variant="outline"
            >
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
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-800">AI Confidence</h4>
                <p className="text-2xl font-bold text-green-600">
                  {(report.ai_confidence * 100).toFixed(1)}%
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800">Processing Time</h4>
                <p className="text-2xl font-bold text-blue-600">
                  {report.processing_time}ms
                </p>
              </div>
            </div>

            {report.insights && (
              <div className="mt-6">
                <h4 className="font-semibold mb-3">AI Insights</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium text-green-700">Strengths</h5>
                    <ul className="mt-2 space-y-1">
                      {report.insights.strengths.slice(0, 3).map((strength, index) => (
                        <li key={index} className="text-sm text-gray-600">• {strength.description}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium text-red-700">Areas for Improvement</h5>
                    <ul className="mt-2 space-y-1">
                      {report.insights.weaknesses.slice(0, 3).map((weakness, index) => (
                        <li key={index} className="text-sm text-gray-600">• {weakness.description}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium text-blue-700">Recommendations</h5>
                    <ul className="mt-2 space-y-1">
                      {report.insights.recommendations.slice(0, 3).map((rec, index) => (
                        <li key={index} className="text-sm text-gray-600">• {rec.action}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {report.parent_summary && (
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">Parent-Friendly Summary</h4>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {report.parent_summary}
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-6">
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
          Generate an intelligent CBC report with AI-powered insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isGenerating && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Generating AI Report...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
              <div className="text-xs text-gray-500">
                Analyzing student performance, generating insights, and creating parent-friendly content
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">Error</h4>
              <p className="text-sm text-red-600 mb-3">{error}</p>
              <Button onClick={reset} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          )}

          {!isGenerating && !error && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">AI-Powered Features</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Intelligent analysis of student performance</li>
                  <li>• Personalized recommendations for improvement</li>
                  <li>• Parent-friendly summaries and translations</li>
                  <li>• Automated insights and action items</li>
                  <li>• Performance trend analysis</li>
                </ul>
              </div>

              <Button 
                onClick={handleGenerate} 
                className="w-full"
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Generate AI Report'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}