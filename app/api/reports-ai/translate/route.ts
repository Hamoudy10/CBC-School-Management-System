import { NextRequest, NextResponse } from 'next/server';
import { ReportTranslatorService } from '@/features/reports-ai/services/translator.service';
import { validateRequest } from '@/lib/validation';
import type { ParentFriendlyTranslationRequest } from '@/features/reports-ai/types/report-ai.types';

const translatorService = new ReportTranslatorService();

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const body = await request.json();
    
    const validation = validateRequest<ParentFriendlyTranslationRequest>(body, {
      technical_term: 'string',
      context: 'object',
      target_language: 'string'
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { technical_term, context, target_language } = validation.data;

    // Translate technical term
    const response = await translatorService.translateToParentFriendly(technical_term, context);

    if (!response.success) {
      return NextResponse.json(
        { error: response.warnings?.[0] || 'Failed to translate term' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        original_term: technical_term,
        translated_text: response.data,
        target_language,
        confidence: response.confidence,
        reasoning: response.reasoning
      }
    });
  } catch (error) {
    console.error('Translation Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AI Translator API',
    version: '1.0.0',
    endpoints: {
      POST: '/api/reports-ai/translate'
    },
    features: [
      'Technical term translation',
      'Parent-friendly language conversion',
      'Context-aware translation',
      'Multiple language support'
    ],
    common_terms: [
      'Numeracy',
      'Literacy',
      'Competency-based assessment',
      'Formative assessment',
      'Summative assessment',
      'Learning outcomes',
      'Skills acquisition',
      'Cognitive development',
      'Motor skills',
      'Social-emotional learning'
    ]
  });
}
