// app/api/academics/scheme-import/route.ts
// ============================================================
// POST /api/academics/scheme-import — Parse and import a scheme of work
// Accepts: { textContent: string } (pasted scheme text)
// Returns: Parsed scheme + DB import results + warnings/missing elements
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
import {
  parseSchemeText,
  importSchemeToDatabase,
} from '@/features/academics/services/schemeParser.service';

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

  // Parse the scheme text
  const parsed = parseSchemeText(textContent);

  // If no lessons found, return early
  if (parsed.lessons.length === 0) {
    return errorResponse(
      `Could not parse any lessons from the scheme. ${parsed.warnings.join(' ')}\n\nPlease ensure the text includes a table with Week, Lesson, Strand, and Sub-Strand columns.`,
      400,
    );
  }

  // Optionally import to database
  let dbResult = null;
  if (importToDatabase) {
    dbResult = await importSchemeToDatabase(parsed, user);
    if (!dbResult.success) {
      return errorResponse(dbResult.message, 500);
    }
  }

  return successResponse({
    parsed: {
      header: parsed.header,
      lessonCount: parsed.lessons.length,
      strandCount: parsed.strandCount,
      subStrandCount: parsed.subStrandCount,
      competencyCount: parsed.competencyCount,
      weeks: [...new Set(parsed.lessons.map((l) => l.week))].sort((a, b) => a - b),
      strands: [...new Set(parsed.lessons.map((l) => l.strand.trim()))],
    },
    warnings: parsed.warnings,
    missingElements: parsed.missingElements,
    databaseImport: dbResult,
  });
});
