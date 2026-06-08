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
      school_id: 'string'
    });

    if (!validation.valid) {
      const response = NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
      return withRateLimitHeaders(response, rateLimit);
    }

    const request_data = validation.data;

    const insightsResponse = await aiService.generateAIReport({
      ...request_data,
      include_insights: true,
      include_parent_summary: false
    });

    if (!insightsResponse.success) {
      const response = NextResponse.json(
        { error: insightsResponse.warnings?.[0] || 'Failed to generate insights' },
        { status: 500 }
      );
      return withRateLimitHeaders(response, rateLimit);
    }

    const response = NextResponse.json({
      success: true,
      data: {
        insights: insightsResponse.data?.insights,
        student_id: request_data.student_id,
        term_id: request_data.term_id,
        academic_year: request_data.academic_year,
        generated_at: new Date().toISOString(),
        ai_confidence: insightsResponse.confidence
      }
    });
    return withRateLimitHeaders(response, rateLimit);
  } catch (error) {
    console.error('Insights Generation Error:', error);
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    return withRateLimitHeaders(response, rateLimit);
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AI Insights Generator API',
    version: '1.0.0',
    endpoints: {
      POST: '/api/reports-ai/insights'
    },
    features: [
      'Performance insights generation',
      'Strengths and weaknesses analysis',
      'Recommendations engine',
      'Trend detection',
      'Risk assessment'
    ]
  });
}
