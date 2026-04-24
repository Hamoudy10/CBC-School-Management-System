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
      school_id: 'string',
      include_parent_summary: 'optional',
      include_insights: 'optional',
      language: 'optional'
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const request_data = validation.data;

    // Generate AI report
    const response = await aiService.generateAIReport(request_data);

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to generate AI report' },
        { status: 500 }
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('AI Report Generation Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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