import { NextRequest, NextResponse } from 'next/server';
import { ReportTranslatorService } from '@/features/reports-ai/services/translator.service';
import { validateRequest } from '@/lib/validation';

const translatorService = new ReportTranslatorService();

type TranslateCommentRequest = {
  comment: string;
  context: {
    competency_name?: string;
    score?: number;
    level?: string;
    subject?: string;
    grade?: string;
    performance_level?: string;
    learning_area?: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const body = await request.json();
    
    const validation = validateRequest<TranslateCommentRequest>(body, {
      comment: 'string',
      context: 'object'
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { comment, context } = validation.data;

    // Translate comment
    const translatedComment = await translatorService.translateReportComment(comment, context);

    return NextResponse.json({
      success: true,
      data: {
        original_comment: comment,
        translated_comment: translatedComment,
        context,
        confidence: 0.9,
        reasoning: 'Comment translated to parent-friendly language'
      }
    });
  } catch (error) {
    console.error('Comment Translation Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Comment Translator API',
    version: '1.0.0',
    endpoints: {
      POST: '/api/reports-ai/translate-comment'
    },
    features: [
      'Teacher comment translation',
      'Parent-friendly language conversion',
      'Context-aware translation',
      'Educational jargon removal'
    ]
  });
}
