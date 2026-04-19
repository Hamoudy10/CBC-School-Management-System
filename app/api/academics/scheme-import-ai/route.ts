// app/api/academics/scheme-import-ai/route.ts
// ============================================================
// POST /api/academics/scheme-import-ai — AI-powered scheme parser
// Uses Groq API (Llama 3) for high-speed, high-quota parsing
// ============================================================

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { importSchemeToDatabase } from "@/features/academics/services/schemeParser.service";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { z } from "zod";

const importSchema = z.object({
  textContent: z
    .string()
    .min(100, "Scheme text must contain at least 100 characters"),
  importToDatabase: z.boolean().optional().default(true),
});

export const POST = withPermission(
  "academics",
  "create",
  async (request: NextRequest, { user }) => {
    const validation = await validateBody(request, importSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const { textContent, importToDatabase } = validation.data!;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return errorResponse(
        "Groq API key not configured. Add GROQ_API_KEY to .env.local",
        500,
      );
    }

    // Truncate to avoid hitting token limits
    const truncatedText =
      textContent.length > 30000 ? textContent.slice(0, 30000) : textContent;

    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `You are a CBC (Competency Based Curriculum) Scheme of Work parser for Kenyan schools.
Extract ALL lessons into structured JSON.

RULES:
1. Extract header: grade, learning area (subject), term, year
2. For EACH lesson row, extract:
   - week (number)
   - lesson (number)
   - strand (the broad thematic area)
   - subStrand (the specific topic)
   - learningOutcomes (array of individual outcomes)
   - learningExperiences (array of what learners are guided to do)
   - inquiryQuestions (array of key questions)
   - resources (array of learning resources)
   - assessmentMethods (array of assessment methods)

3. SKIP rows: HALF TERM BREAK, REVISION, ASSESSMENT, MIDTERM BREAK
4. Return ONLY valid JSON. No markdown, no conversational text.

Output format:
{
  "header": { "grade": "", "learningArea": "", "term": "", "year": "" },
  "lessons": [
    {
      "week": 1,
      "lesson": 1,
      "strand": "",
      "subStrand": "",
      "learningOutcomes": [],
      "learningExperiences": [],
      "inquiryQuestions": [],
      "resources": [],
      "assessmentMethods": []
    }
  ]
}`,
              },
              {
                role: "user",
                content: `Scheme document text:\n${truncatedText}`,
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        return errorResponse(`Groq API error: ${errText}`, 502);
      }

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content;

      if (!aiText) {
        return errorResponse(
          "AI returned empty response. Please try again.",
          500,
        );
      }

      // Parse the JSON response
      let parsed;
      try {
        parsed = JSON.parse(aiText);
      } catch (e) {
        return errorResponse(
          "AI returned invalid JSON. Please try again.",
          500,
        );
      }

      if (!parsed.lessons || parsed.lessons.length === 0) {
        return errorResponse(
          "AI could not parse any lessons from the scheme.",
          400,
        );
      }

      // Create the parsed scheme object with proper validation
      const parsedScheme: any = {
        header: parsed.header || {},
        lessons: parsed.lessons,
        warnings: [],
        missingElements: [],
        strandCount: new Set(parsed.lessons.map((l: any) => l.strand)).size,
        subStrandCount: new Set(parsed.lessons.map((l: any) => l.subStrand))
          .size,
        competencyCount: parsed.lessons.reduce(
          (sum: number, l: any) => sum + (l.learningOutcomes?.length || 0),
          0,
        ),
      };

      // If importToDatabase is true, import to database
      let databaseImport = null;
      if (importToDatabase) {
        try {
          const importResult = await importSchemeToDatabase(parsedScheme, user);
          databaseImport = importResult;

          // Add warnings and missing elements from import result
          if (importResult.warnings) {
            parsedScheme.warnings = [
              ...parsedScheme.warnings,
              ...importResult.warnings,
            ];
          }
          if (importResult.missingElements) {
            parsedScheme.missingElements = [
              ...parsedScheme.missingElements,
              ...importResult.missingElements,
            ];
          }
        } catch (importError) {
          console.error("Database import error:", importError);
          parsedScheme.warnings.push(
            `Database import failed: ${importError instanceof Error ? importError.message : "Unknown error"}`,
          );
        }
      }

      return successResponse({
        parsed: {
          header: parsedScheme.header,
          lessonCount: parsedScheme.lessons.length,
          strandCount: parsedScheme.strandCount,
          subStrandCount: parsedScheme.subStrandCount,
          competencyCount: parsedScheme.competencyCount,
          weeks: Array.from(
            new Set(parsedScheme.lessons.map((l: any) => l.week)),
          ).sort((a, b) => (a as number) - (b as number)),
          strands: Array.from(
            new Set(parsedScheme.lessons.map((l: any) => l.strand)),
          ),
        },
        lessons: parsedScheme.lessons,
        warnings: parsedScheme.warnings,
        missingElements: parsedScheme.missingElements,
        databaseImport,
      });
    } catch (err) {
      return errorResponse(
        `Failed to parse scheme: ${err instanceof Error ? err.message : "Unknown error"}`,
        500,
      );
    }
  },
);
