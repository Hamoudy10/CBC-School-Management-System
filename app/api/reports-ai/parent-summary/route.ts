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

    // Generate parent summary only
    const summaryResponse = await aiService.generateAIReport({
      ...request_data,
      include_parent_summary: true,
      include_insights: false
    });

    if (!summaryResponse.success) {
      return NextResponse.json(
        { error: summaryResponse.warnings?.[0] || 'Failed to generate parent summary' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        parent_summary: summaryResponse.data?.parent_summary,
        student_id: request_data.student_id,
        term_id: request_data.term_id,
        academic_year: request_data.academic_year,
        generated_at: new Date().toISOString(),
        ai_confidence: summaryResponse.confidence
      }
    });
  } catch (error) {
    console.error('Parent Summary Generation Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Parent Summary Generator API',
    version: '1.0.0',
    endpoints: {
      POST: '/api/reports-ai/parent-summary'
    },
    features: [
      'Parent-friendly summary generation',
      'Simple language conversion',
      'Achievement highlighting',
      'Constructive improvement areas',
      'Next steps guidance'
    ]
  });
}
