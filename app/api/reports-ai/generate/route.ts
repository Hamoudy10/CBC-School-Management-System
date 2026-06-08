export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { AIReportService } from '@/features/reports-ai/services/ai-report.service';
import { validateRequest } from '@/lib/validation';
import { checkAIGenerationRateLimit, withRateLimitHeaders } from '@/lib/api/rateLimit';
import type { AIReportGenerationRequest } from '@/features/reports-ai/types/report-ai.types';

const aiService = AIReportService.getInstance();

export async function POST(request: NextRequest) {
  const rateLimit = checkAIGenerationRateLimit(request);
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
    return withRateLimitHeaders(response, rateLimit);
  }

  try {
    const body = await request.json();
    
    const validation = validateRequest<AIReportGenerationRequest>(body, {
      student_id: 'string',
      term_id: 'string',
      academic_year: 'string',
      school_id: 'string',
      include_parent_summary: 'optional',
      include_insights: 'optional',
      language: 'optional'
    });

    if (!validation.valid) {
      const response = NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
      return withRateLimitHeaders(response, rateLimit);
    }

    const request_data = validation.data;

    const response = await aiService.generateAIReport(request_data);

    if (!response.success) {
      const errorResponse = NextResponse.json(
        { error: response.warnings?.[0] || 'Failed to generate AI report' },
        { status: 500 }
      );
      return withRateLimitHeaders(errorResponse, rateLimit);
    }

    const successResponse = NextResponse.json(response);
    return withRateLimitHeaders(successResponse, rateLimit);
  } catch (error) {
    console.error('AI Report Generation Error:', error);
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    return withRateLimitHeaders(response, rateLimit);
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AI Report Generator API',
    version: '1.0.0',
    endpoints: {
      POST: '/api/reports-ai/generate'
    },
    features: [
      'AI-powered CBC report generation',
      'Parent-friendly summaries',
      'Performance insights',
      'Technical term translation'
    ]
  });
}
