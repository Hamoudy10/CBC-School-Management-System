import { NextRequest, NextResponse } from 'next/server';
import { AIReportService } from '@/features/reports-ai/services/ai-report.service';
import { validateRequest } from '@/lib/validation';
import type { AIReportGenerationRequest } from '@/features/reports-ai/types/report-ai.types';

const aiService = AIReportService.getInstance();

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const body = await request.json();
    
    const validation = validateRequest<AIReportGenerationRequest>(body, {
      student_id: 'string',
      term_id: 'string',
      academic_year: 'string',
      school_id: 'string'
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const request_data = validation.data;

    // Generate insights only
    const insightsResponse = await aiService.generateAIReport({
      ...request_data,
      include_insights: true,
      include_parent_summary: false
    });

    if (!insightsResponse.success) {
      return NextResponse.json(
        { error: insightsResponse.error || 'Failed to generate insights' },
        { status: 500 }
      );
    }

    return NextResponse.json({
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
  } catch (error) {
    console.error('Insights Generation Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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