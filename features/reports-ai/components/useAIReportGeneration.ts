'use client';

import { useState, useEffect } from 'react';
import { AIReportService } from '../services/ai-report.service';
import type { AIReportGenerationRequest, AIReportGenerationResponse } from '../types/report-ai.types';

export function useAIReportGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const aiService = AIReportService.getInstance();

  const generateReport = async (request: AIReportGenerationRequest) => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await aiService.generateAIReport(request);
      
      clearInterval(progressInterval);
      setProgress(100);

      if (response.success) {
        setReport(response.data);
      } else {
        setError(response.error || 'Failed to generate report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    report,
    error,
    progress,
    generateReport,
    reset: () => {
      setReport(null);
      setError(null);
      setProgress(0);
    }
  };
}