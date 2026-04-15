// app/api/academics/scheme-import-ai/route.ts
// ============================================================
// POST /api/academics/scheme-import-ai — AI-powered scheme parser
// Uses Google Gemini (free tier) to intelligently parse scheme documents
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import { z } from 'zod';

const importSchema = z.object({
  textContent: z.string().min(100, 'Scheme text must contain at least 100 characters'),
  importToDatabase: z.boolean().optional().default(true),
});

export const POST = withPermission('academics', 'create', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, importSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const { textContent, importToDatabase } = validation.data!;
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    return errorResponse('Gemini API key not configured. Add GOOGLE_GEMINI_API_KEY to .env.local', 500);
  }

  // Truncate to avoid hitting token limits (Gemini handles ~30K tokens)
  const truncatedText = textContent.length > 50000 ? textContent.slice(0, 50000) : textContent;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a CBC (Competency Based Curriculum) Scheme of Work parser for Kenyan schools.

Parse the following scheme document text and extract ALL lessons into structured JSON.

RULES:
1. Extract header: grade, learning area (subject), term, year
2. For EACH lesson row in the table, extract:
   - week (number)
   - lesson (number)
   - strand (the broad thematic area, e.g. "Creating and Performing")
   - subStrand (the specific topic, e.g. "Montage; Pictorial composition")
   - learningOutcomes (array of individual outcomes starting with "By the end of the lesson...")
   - learningExperiences (array of what learners are guided to do)
   - inquiryQuestions (array of key questions)
   - resources (array of learning resources)
   - assessmentMethods (array of assessment methods)

3. SKIP rows that are: HALF TERM BREAK, REVISION, ASSESSMENT, MIDTERM BREAK
4. Each lesson is a separate row with its own week and lesson number
5. Strand and sub-strand may span multiple lines — combine them properly
6. Return ONLY valid JSON, no markdown, no explanations

Output format:
{
  "header": { "grade": "", "learningArea": "", "term": "", "year": "" },
  "lessons": [
    {
      "week": 1,
      "lesson": 1,
      "strand": "Creating and Performing",
      "subStrand": "Montage; Pictorial composition",
      "learningOutcomes": ["By the end of the lesson, the learner should be able to: Explain the meaning of montage."],
      "learningExperiences": ["Learners are guided to define the meaning of montage."],
      "inquiryQuestions": ["What is the meaning of montage composition?"],
      "resources": ["Pictures", "Photographs", "Digital devices"],
      "assessmentMethods": ["Oral questions", "Oral Report", "Observation"]
    }
  ]
}

Scheme document text:
${truncatedText}`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      return errorResponse(`Gemini API error: ${errText}`, 502);
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      return errorResponse('AI returned empty response. Please try again.', 500);
    }

    // Parse the JSON response
    let parsed;
    try {
      // Sometimes Gemini wraps JSON in markdown code blocks
      const cleaned = aiText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return errorResponse('AI returned invalid JSON. Please try again.', 500);
    }

    if (!parsed.lessons || parsed.lessons.length === 0) {
      return errorResponse('AI could not parse any lessons from the scheme.', 400);
    }

    return successResponse({
      parsed: {
        header: parsed.header || {},
        lessonCount: parsed.lessons.length,
        strandCount: new Set(parsed.lessons.map((l: any) => l.strand)).size,
        subStrandCount: new Set(parsed.lessons.map((l: any) => l.subStrand)).size,
        competencyCount: parsed.lessons.reduce((sum: number, l: any) => sum + (l.learningOutcomes?.length || 0), 0),
        weeks: [...new Set(parsed.lessons.map((l: any) => l.week))].sort((a: number, b: number) => a - b),
        strands: [...new Set(parsed.lessons.map((l: any) => l.strand))],
      },
      lessons: parsed.lessons,
      warnings: [],
      missingElements: [],
      databaseImport: null,
    });
  } catch (err) {
    return errorResponse(`Failed to parse scheme: ${err instanceof Error ? err.message : 'Unknown error'}`, 500);
  }
});
