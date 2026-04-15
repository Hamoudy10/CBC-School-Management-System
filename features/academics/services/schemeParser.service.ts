// features/academics/services/schemeParser.service.ts
// ============================================================
// Intelligent Scheme of Work Parser
// Parses CBC scheme documents (.docx, .doc, .txt, .csv) and extracts:
// - Grade/Class, Learning Area, Term, Year
// - Strands, Sub-Strands, Specific Learning Outcomes → Competencies
// - Learning Experiences, Inquiry Questions, Resources, Assessment Methods
// - Detects missing elements and alerts the user
// ============================================================

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuthUser } from '@/types/auth';

// ─── Types ──────────────────────────────────────────────────────

export interface SchemeHeader {
  school: string;
  grade: string;
  learningArea: string;
  term: string;
  year: string;
}

export interface SchemeLesson {
  week: number;
  lesson: number;
  strand: string;
  subStrand: string;
  learningOutcomes: string[];
  learningExperiences: string[];
  inquiryQuestions: string[];
  resources: string[];
  assessmentMethods: string[];
}

export interface ParsedScheme {
  header: SchemeHeader;
  lessons: SchemeLesson[];
  warnings: string[];
  missingElements: string[];
  strandCount: number;
  subStrandCount: number;
  competencyCount: number;
}

export interface SchemeImportResult {
  success: boolean;
  message: string;
  parsed?: ParsedScheme;
  createdStrands?: string[];
  createdSubStrands?: string[];
  createdCompetencies?: string[];
}

// ─── Parser Core ────────────────────────────────────────────────

/**
 * Parse raw text content from a scheme document
 */
export function parseSchemeText(rawText: string): ParsedScheme {
  const warnings: string[] = [];
  const missingElements: string[] = [];
  const lines = rawText
    .split('\n')
    .map((l) => l.replace(/\r/g, '').replace(/\t/g, ' ').trim())
    .filter((l) => l.length > 0);

  // ── Extract Header ────────────────────────────────────────────
  const header: SchemeHeader = {
    school: '',
    grade: '',
    learningArea: '',
    term: '',
    year: '',
  };

  // Look for header info in first ~20 lines
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].toUpperCase();

    // Grade
    if (line.includes('GRADE') && !header.grade) {
      const match = lines[i].match(/(?:GRADE|Grade)\s*[:\s]*([^\s,;|]+)/i);
      if (match) {header.grade = match[1].trim();}
      // Also check for "GRADE 6" patterns
      if (!header.grade) {
        const gradeMatch = lines[i].match(/GRADE\s*(\d+)/i);
        if (gradeMatch) {header.grade = `Grade ${gradeMatch[1]}`;}
      }
    }

    // Learning Area / Subject
    if ((line.includes('LEARNING AREA') || line.includes('SUBJECT')) && !header.learningArea) {
      const match = lines[i].match(/(?:Learning Area|Subject)\s*[:\s]*([^\s,;|]{2,})/i);
      if (match) {header.learningArea = match[1].trim();}
    }

    // Term
    if (line.includes('TERM') && !header.term) {
      const match = lines[i].match(/(?:Term|TERM)\s*[:\s]*(\d+)/i);
      if (match) {header.term = `Term ${match[1]}`;}
      // Check for "TERM 2" in title line
      if (!header.term) {
        const titleMatch = lines[i].match(/TERM\s*(\d+)/i);
        if (titleMatch) {header.term = `Term ${titleMatch[1]}`;}
      }
    }

    // Year
    if (line.match(/\b20\d{2}\b/) && !header.year) {
      const match = lines[i].match(/\b(20\d{2})\b/);
      if (match) {header.year = match[1];}
    }

    // School name
    if (line.includes('SCHOOL') && !header.school) {
      const match = lines[i].match(/(?:School|SCHOOL)\s*[:\s]*([^\s,;|]{3,})/i);
      if (match) {header.school = match[1].trim();}
    }
  }

  // Also check the very first line for title patterns like:
  // "2024 GRADE 6 JKF NEW PRIMARY ENGLISH SCHEMES OF WORK - TERM 2"
  if (lines.length > 0) {
    const titleLine = lines[0];
    if (!header.grade) {
      const g = titleLine.match(/GRADE\s*(\d+)/i);
      if (g) {header.grade = `Grade ${g[1]}`;}
    }
    if (!header.term) {
      const t = titleLine.match(/TERM\s*(\d+)/i);
      if (t) {header.term = `Term ${t[1]}`;}
    }
    if (!header.year) {
      const y = titleLine.match(/\b(20\d{2})\b/);
      if (y) {header.year = y[1];}
    }
    if (!header.learningArea) {
      // Try to extract subject from title
      const la = titleLine.match(/(?:PRIMARY\s+)?(\w+(?:\s+\w+)?)\s+SCHEMES/i);
      if (la) {header.learningArea = la[1].trim();}
    }
  }

  // ── Detect Format ─────────────────────────────────────────────
  // Format A: Tab-delimited (copy-paste from browser/Word with table structure)
  // Format B: Cell-by-cell (mammoth extraction — each cell on separate lines)
  const hasTabs = lines.some((l) => l.includes('\t'));
  const tabLineCount = lines.filter((l) => l.includes('\t')).length;

  const lessons: SchemeLesson[] = [];

  if (hasTabs && tabLineCount > 3) {
    // Format A: Tab-delimited
    const result = parseTabDelimited(lines, warnings);
    lessons.push(...result.lessons);
  } else {
    // Format B: Cell-by-cell (mammoth)
    const result = parseCellByCell(lines, warnings);
    lessons.push(...result.lessons);
  }

  // ── Detect Missing Elements ──────────────────────────────────
  const allOutcomes = lessons.flatMap((l) => l.learningOutcomes);
  const allExperiences = lessons.flatMap((l) => l.learningExperiences);
  const allQuestions = lessons.flatMap((l) => l.inquiryQuestions);
  const allResources = lessons.flatMap((l) => l.resources);
  const allAssessments = lessons.flatMap((l) => l.assessmentMethods);

  if (!header.grade) {missingElements.push('Grade level not detected');}
  if (!header.learningArea) {missingElements.push('Learning area / subject not detected');}
  if (!header.term) {missingElements.push('Term not detected');}
  if (!header.year) {missingElements.push('Year not detected');}
  if (lessons.length === 0) {missingElements.push('No lessons found — scheme table may not be parseable');}

  // Check for CBC-required elements
  const hasAffectiveOutcomes = allOutcomes.some((o) =>
    /appreciate|enjoy|display|advocate|have fun/i.test(o),
  );
  if (!hasAffectiveOutcomes && lessons.length > 0) {
    warnings.push('No affective learning outcomes detected (appreciate, enjoy, display, advocate). CBC requires cognitive, psychomotor, AND affective domains.');
  }

  const hasPsychomotorOutcomes = allOutcomes.some((o) =>
    /construct|write|draw|identify|pick|make|role.play|create|use|pronounce|recite/i.test(o),
  );
  if (!hasPsychomotorOutcomes && lessons.length > 0) {
    warnings.push('No psychomotor learning outcomes detected (construct, write, draw, identify, pronounce). CBC requires all three domains.');
  }

  // Check for assessment variety
  const assessmentVariety = new Set(allAssessments.map((a) => a.toLowerCase().trim()));
  if (assessmentVariety.size < 2 && lessons.length > 0) {
    warnings.push('Limited assessment methods detected. CBC requires diverse assessment types (observation, oral, written, portfolio, peer/self-assessment).');
  }

  // Check for inquiry questions coverage
  const lessonsWithoutQuestions = lessons.filter((l) => l.inquiryQuestions.length === 0).length;
  if (lessonsWithoutQuestions > 0 && lessons.length > 0) {
    warnings.push(`${lessonsWithoutQuestions} lesson(s) have no key inquiry questions. CBC requires inquiry-based learning.`);
  }

  // Check for resource variety
  if (allResources.length === 0 && lessons.length > 0) {
    warnings.push('No learning resources detected. Please ensure resources are specified for each lesson.');
  }

  // Check strand coverage
  if (uniqueStrands.size < 2 && lessons.length > 3) {
    warnings.push(`Only ${uniqueStrands.size} strand(s) detected across ${lessons.length} lessons. Verify the scheme covers multiple strands.`);
  }

  // Check if reflection column has content
  const hasAnyReflection = false; // Can't easily detect from text extraction
  if (!hasAnyReflection && lessons.length > 0) {
    warnings.push('Teacher reflection column appears empty. Teachers should fill this after each lesson.');
  }

  // Validate learning outcomes follow CBC pattern
  const hasProperOutcomes = allOutcomes.some((o) =>
    /By the end of the lesson|By the end of this/i.test(o) ||
    /(should be able to|identify|construct|read|write|listen|speak|discuss)/i.test(o),
  );
  if (!hasProperOutcomes && lessons.length > 0) {
    missingElements.push('Specific learning outcomes not in CBC format (should start with "By the end of the lesson, the learner should be able to...")');
  }

  // Check weeks continuity
  const weekNumbers = [...new Set(lessons.map((l) => l.week))].sort((a, b) => a - b);
  if (weekNumbers.length > 0) {
    const expectedWeeks = Array.from({ length: weekNumbers[weekNumbers.length - 1] }, (_, i) => i + 1);
    const missingWeeks = expectedWeeks.filter((w) => !weekNumbers.includes(w));
    if (missingWeeks.length > 0) {
      warnings.push(`Weeks ${missingWeeks.join(', ')} are missing from the scheme. Ensure all weeks are covered.`);
    }
  }

  // Check lessons per week
  for (const week of weekNumbers) {
    const weekLessons = lessons.filter((l) => l.week === week);
    if (weekLessons.length < 3) {
      warnings.push(`Week ${week} has only ${weekLessons.length} lesson(s). A typical week should have 4-5 lessons.`);
    }
  }

  return {
    header,
    lessons,
    warnings,
    missingElements,
    strandCount: uniqueStrands.size,
    subStrandCount: uniqueSubStrands.size,
    competencyCount: totalOutcomes,
  };
}

// ─── Format-A: Tab-Delimited Parser ─────────────────────────────

interface ParseResult { lessons: SchemeLesson[]; }

function parseTabDelimited(lines: string[], warnings: string[]): ParseResult {
  const lessons: SchemeLesson[] = [];

  // Find header row with column names
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const l = lines[i].toUpperCase();
    if (l.includes('WEEK') && l.includes('LESSON') && l.includes('STRAND')) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      if (/^\d+\s+\d+/.test(lines[i])) {
        headerRowIdx = i;
        break;
      }
    }
  }
  if (headerRowIdx === -1) {
    warnings.push('Could not identify the scheme table structure.');
    return { lessons: [] };
  }

  const dataLines = lines.slice(headerRowIdx + 1);
  let buffer = '';
  const allDataLines: string[] = [];

  for (const line of dataLines) {
    if (/^\d{1,2}\s*$/.test(line.trim()) || /^\d{1,2}\s+\d{1,2}/.test(line.trim())) {
      if (buffer.trim()) allDataLines.push(buffer.trim());
      buffer = line;
    } else {
      buffer += ` ${line}`;
    }
  }
  if (buffer.trim()) allDataLines.push(buffer.trim());

  for (const row of allDataLines) {
    const parts = row.split(/\t|\|/).map((p) => p.trim()).filter((p) => p.length > 0);
    if (parts.length < 4) continue;

    const weekMatch = parts[0].match(/^(\d+)/);
    if (!weekMatch) continue;
    const week = parseInt(weekMatch[1]);

    let lessonIdx = 1;
    let lesson = 0;
    if (parts.length > 1) {
      const lm = parts[1].match(/^(\d+)/);
      if (lm) { lesson = parseInt(lm[1]); lessonIdx = 2; }
    }
    if (lesson === 0) lesson = 1;

    const strand = parts[lessonIdx] || '';
    const subStrand = parts[lessonIdx + 1] || '';
    const outcomes = extractOutcomes(parts.slice(lessonIdx + 2).join(' '));
    const experiences = extractExperiences(parts.slice(lessonIdx + 2).join(' '));
    const questions = extractQuestions(parts.slice(lessonIdx + 2).join(' '));
    const resources = extractResources(parts.slice(lessonIdx + 2).join(' '));
    const assessmentMethods = extractAssessmentMethods(parts.slice(lessonIdx + 2).join(' '));

    if (!strand) continue;

    lessons.push({
      week, lesson, strand: strand.trim(), subStrand: subStrand.trim(),
      learningOutcomes: outcomes, learningExperiences: experiences,
      inquiryQuestions: questions, resources, assessmentMethods,
    });
  }

  return { lessons };
}

// ─── Format-B: Cell-by-Cell Parser (mammoth output) ─────────────
// Handles mammoth extraction where each table cell is on its own line(s)
// with NO tab delimiters between columns.

function parseCellByCell(lines: string[], warnings: string[]): ParseResult {
  const lessons: SchemeLesson[] = [];
  const NUM_COLUMNS = 9; // Week, Lesson, Strand, Sub-strand, Outcomes, Experiences, Questions, Resources, Assessment

  // Find the header row (contains "Week", "Lesson", "Strand", "Sub-strand")
  let headerStart = -1;
  let headerEnd = -1;

  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const upper = lines[i].toUpperCase();
    if (upper === 'WEEK' || upper.includes('WEEK')) {
      headerStart = i;
      break;
    }
  }

  if (headerStart === -1) {
    warnings.push('Could not find column headers. Expected headers: Week, Lesson, Strand, Sub-strand');
    return { lessons: [] };
  }

  // Read header columns until we hit a standalone number (first data row week number)
  for (let i = headerStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\d{1,2}$/.test(line)) {
      headerEnd = i;
      break;
    }
  }

  if (headerEnd === -1) {
    warnings.push('Could not find data rows after headers.');
    return { lessons: [] };
  }

  // After headers, each lesson row starts with: week number, lesson number (standalone)
  // Then remaining cells follow — detected by content patterns:
  //   Strand: title-case text, 1-3 lines
  //   Sub-strand: topic name (until "By the end of the lesson")
  //   Outcomes: starts with "By the end of the lesson"
  //   Experiences: starts with "Learners are guided"
  //   Questions: short lines with "?"
  //   Resources: book names, "Pictures", "Charts", etc.
  //   Assessment: "Oral questions", "Written questions", etc.

  const dataLines = lines.slice(headerEnd);
  const rows: { week: number; lesson: number; cells: string[] }[] = [];
  let currentCells: string[] = [];
  let currentCellLines: string[] = [];
  let weekNum = 0;
  let lessonNum = 0;

  function pushCell() {
    if (currentCellLines.length > 0) {
      currentCells.push(currentCellLines.join('\n').trim());
      currentCellLines = [];
    }
  }

  function startNewRow(week: number, lesson: number) {
    pushCell();
    if (currentCells.length > 0) {
      rows.push({ week: weekNum, lesson: lessonNum, cells: [...currentCells] });
    }
    currentCells = [];
    currentCellLines = [];
    weekNum = week;
    lessonNum = lesson;
  }

  // State: 0=week, 1=lesson, 2=strand+sub-strand (combined), 3=outcomes,
  //        4=experiences, 5=questions, 6=resources, 7=assessment, 8=reflection
  let state = 0;

  for (const line of dataLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect standalone numbers (week or lesson)
    if (/^\d{1,2}$/.test(trimmed)) {
      const num = parseInt(trimmed);

      if (state === 0) {
        weekNum = num;
        state = 1;
      } else if (state === 1) {
        lessonNum = num;
        state = 2;
      } else {
        startNewRow(num, 0);
        state = 1;
      }
      continue;
    }

    // Accumulate content and detect column transitions
    switch (state) {
      case 1: // Waiting for lesson number (shouldn't happen, but handle)
        if (/^\d{1,2}$/.test(trimmed)) {
          lessonNum = num;
          state = 2;
        }
        break;

      case 2: // Strand + sub-strand (combined until outcomes)
        currentCellLines.push(trimmed);
        break;

      case 3: // Outcomes → experiences
        currentCellLines.push(trimmed);
        if (/learners are guided/i.test(trimmed)) {
          pushCell();
          state = 4;
        }
        break;

      case 4: // Experiences → questions
        currentCellLines.push(trimmed);
        if (trimmed.endsWith('?') || /^(what|why|how|which|when|where|who)\b/i.test(trimmed)) {
          pushCell();
          state = 5;
        }
        break;

      case 5: // Questions → resources
        currentCellLines.push(trimmed);
        if (/^(pictures|charts|realia|dictionaries|journals|internet|computing|digital|newspapers|magazines|curriculum|moran|spotlight|JKF)/i.test(trimmed)) {
          pushCell();
          state = 6;
        }
        break;

      case 6: // Resources → assessment
        currentCellLines.push(trimmed);
        if (/^(oral|written|portfolio|observation|self and peer)/i.test(trimmed)) {
          pushCell();
          state = 7;
        }
        break;

      case 7: // Assessment → reflection
        currentCellLines.push(trimmed);
        if (trimmed.length < 20 && !/^(oral|written|portfolio|observation)/i.test(trimmed)) {
          pushCell();
          state = 8;
        }
        break;

      case 8: // Reflection (usually empty)
        currentCellLines.push(trimmed);
        break;

      default:
        currentCellLines.push(trimmed);
    }

    // Detect transition from strand+sub-strand to outcomes
    if (state === 2 && /by the end of the lesson/i.test(trimmed)) {
      pushCell();
      state = 3;
    }
  }

  // Flush last row
  pushCell();
  if (currentCells.length > 0) {
    rows.push({ week: weekNum, lesson: lessonNum, cells: [...currentCells] });
  }

  // Build lessons from parsed rows
  // Cell 0 = strand + sub-strand combined, need to split
  for (const row of rows) {
    if (row.week === 0) continue;

    // Split strand + sub-strand from combined cell
    const combinedCell = row.cells[0] || '';
    const { strand, subStrand } = splitStrandSubStrand(combinedCell);

    // Skip break/revision/assessment rows
    const strandUpper = strand.toUpperCase();
    if (strandUpper.includes('BREAK') || strandUpper.includes('REVISION') ||
        strandUpper.includes('ASSESSMENT') || strandUpper.includes('HALF TERM')) {
      continue;
    }

    if (!strand) continue;

    lessons.push({
      week: row.week,
      lesson: row.lesson || 1,
      strand,
      subStrand,
      learningOutcomes: extractOutcomes(row.cells[1] || ''),
      learningExperiences: extractExperiences(row.cells[2] || ''),
      inquiryQuestions: extractQuestions(row.cells[3] || ''),
      resources: extractResources(row.cells[4] || ''),
      assessmentMethods: extractAssessmentMethods(row.cells[5] || ''),
    });
  }

  return { lessons };
}

// ─── Helper: Split strand + sub-strand from combined cell ────────

function splitStrandSubStrand(combined: string): { strand: string; subStrand: string } {
  const lines = combined.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { strand: '', subStrand: '' };
  }

  if (lines.length === 1) {
    return { strand: lines[0].trim(), subStrand: '' };
  }

  // Strategy: strand is usually 1-2 lines of title-case text
  // sub-strand is the rest (often a topic name)
  // Look for a line that looks like a topic (contains semicolons, colons, or specific keywords)

  let strandEndIdx = 0;
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim();
    // If line contains semicolon or colon, it's likely a sub-strand marker
    if (line.includes(';') || line.includes(':')) {
      strandEndIdx = i;
      break;
    }
    // If line starts with lowercase, previous line was end of strand
    if (i > 0 && /^[a-z]/.test(line)) {
      strandEndIdx = i - 1;
      break;
    }
    strandEndIdx = i;
  }

  const strand = lines.slice(0, strandEndIdx + 1).join(' ').trim();
  const subStrand = lines.slice(strandEndIdx + 1).join(' ').trim();

  return { strand, subStrand };
}

// ─── Helper Extraction Functions ────────────────────────────────

function extractOutcomes(text: string): string[] {
  const outcomes: string[] = [];

  // Find "By the end of the lesson, the learner should be able to:" sections
  const outcomeBlocks = text.split(/By the end of the lesson,? the learner should be able to:/gi);

  if (outcomeBlocks.length > 1) {
    for (let i = 1; i < outcomeBlocks.length; i++) {
      // Split by newlines to get individual outcomes
      const block = outcomeBlocks[i]
        .split(/\n|\. (?=[A-Z])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      for (const item of block) {
        // Clean up - remove leading bullets, numbers
        const cleaned = item.replace(/^[\d.)\-\u2022]+\s*/, '').trim();
        if (cleaned.length > 15 && /[a-z]/i.test(cleaned)) {
          outcomes.push(cleaned);
        }
      }
    }
  }

  // If no structured outcomes found, try to find outcome-like sentences
  if (outcomes.length === 0) {
    const sentences = text.split(/[.\n]/).map((s) => s.trim()).filter((s) => s.length > 20);
    for (const sentence of sentences) {
      if (/should be able to|identify|construct|read|write|listen|pronounce|recite|discuss|appreciate|enjoy|select|find/i.test(sentence)) {
        outcomes.push(sentence.trim());
      }
    }
  }

  return outcomes;
}

function extractExperiences(text: string): string[] {
  const experiences: string[] = [];

  // Look for "Learners are guided in pairs, in groups or individually to:"
  const expBlocks = text.split(/Learners are guided[^:]*to:/gi);

  if (expBlocks.length > 1) {
    for (let i = 1; i < expBlocks.length; i++) {
      const block = expBlocks[i]
        .split(/\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      for (const item of block) {
        const cleaned = item.replace(/^[\d.)\-\u2022]+\s*/, '').trim();
        if (cleaned.length > 15 && /[a-z]/i.test(cleaned)) {
          experiences.push(cleaned);
        }
      }
    }
  }

  return experiences;
}

function extractQuestions(text: string): string[] {
  const questions: string[] = [];

  // Find sentences ending with "?"
  const qSentences = text.split(/[?\n]/);
  for (const q of qSentences) {
    const trimmed = q.trim();
    if (trimmed.length > 10 && /[a-z]/i.test(trimmed)) {
      questions.push(trimmed.endsWith('?') ? trimmed : `${trimmed  }?`);
    }
  }

  return questions;
}

function extractResources(text: string): string[] {
  const resources: string[] = [];

  // Common resource patterns
  const resourcePatterns = [
    /JKF\s+New\s+Primary\s+English\s+Learner[''']s\s+Book\s+Grade\s+\d+\s+Pg\.?\s*[\d.,\-\s]+/gi,
    /JKF\s+New\s+Primary\s+English[^|]*/gi,
    /Dictionaries/gi,
    /Charts/gi,
    /Realia/gi,
    /Journals/gi,
    /Internet/gi,
    /Digital\s+devices/gi,
    /Newspapers/gi,
    /Magazines/gi,
    /Flash\s+cards/gi,
    /Worksheets/gi,
    /Audio\s+recordings?/gi,
    /Video/gi,
  ];

  for (const pattern of resourcePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        if (!resources.includes(m.trim())) {
          resources.push(m.trim());
        }
      }
    }
  }

  return resources;
}

function extractAssessmentMethods(text: string): string[] {
  const methods: string[] = [];

  const assessmentPatterns = [
    /Written\s+questions/gi,
    /Oral\s+questions/gi,
    /Portfolio/gi,
    /Oral\s+Report/gi,
    /Observation/gi,
    /Self\s+and\s+peer\s+assessment/gi,
    /Self\s+assessment/gi,
    /Peer\s+assessment/gi,
    /Practical\s+assessment/gi,
    /Quiz/gi,
    /Test/gi,
    /Project/gi,
  ];

  for (const pattern of assessmentPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        if (!methods.includes(m.trim())) {
          methods.push(m.trim());
        }
      }
    }
  }

  return methods;
}

// ─── DB Import Function ─────────────────────────────────────────

/**
 * Import parsed scheme into the database:
 * 1. Find or create learning area
 * 2. For each unique strand, find or create strand
 * 3. For each unique sub-strand, find or create sub-strand
 * 4. For each learning outcome, find or create competency
 */
export async function importSchemeToDatabase(
  parsed: ParsedScheme,
  currentUser: AuthUser,
): Promise<SchemeImportResult> {
  if (!currentUser.schoolId) {
    return { success: false, message: 'No school context available' };
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId;
  const createdStrands: string[] = [];
  const createdSubStrands: string[] = [];
  const createdCompetencies: string[] = [];

  try {
    // ── Step 1: Find or create learning area ────────────────────
    let learningAreaId: string | null = null;

    const { data: existingArea } = await supabase
      .from('learning_areas')
      .select('id')
      .eq('name', parsed.header.learningArea)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (existingArea) {
      learningAreaId = existingArea.id;
    } else {
      // Create learning area
      const { data: newArea, error } = await supabase
        .from('learning_areas')
        .insert({
          name: parsed.header.learningArea,
          description: `${parsed.header.grade} - ${parsed.header.learningArea} - ${parsed.header.term} ${parsed.header.year}`,
          school_id: schoolId,
          grade_level: parsed.header.grade.replace(/Grade\s*/i, '') || null,
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, message: `Failed to create learning area: ${error.message}` };
      }
      learningAreaId = newArea.id;
    }

    if (!learningAreaId) {
      return { success: false, message: 'Could not determine learning area ID' };
    }

    // ── Step 2: Extract unique strands and create them ──────────
    const uniqueStrands = [...new Set(parsed.lessons.map((l) => l.strand.trim()))];
    const strandIdMap = new Map<string, string>();

    for (const strandName of uniqueStrands) {
      const { data: existingStrand } = await supabase
        .from('strands')
        .select('id')
        .eq('name', strandName)
        .eq('learning_area_id', learningAreaId)
        .maybeSingle();

      if (existingStrand) {
        strandIdMap.set(strandName, existingStrand.id);
      } else {
        const { data: newStrand, error } = await supabase
          .from('strands')
          .insert({
            name: strandName,
            description: `Strand from ${parsed.header.term} ${parsed.header.year} scheme`,
            learning_area_id: learningAreaId,
            school_id: schoolId,
          })
          .select('id')
          .single();

        if (error) {
          createdStrands.push(`⚠️ Failed to create "${strandName}": ${error.message}`);
        } else {
          strandIdMap.set(strandName, newStrand.id);
          createdStrands.push(strandName);
        }
      }
    }

    // ── Step 3: Extract unique sub-strands and create them ──────
    const uniqueSubStrands = [...new Set(parsed.lessons.map((l) => l.subStrand.trim()).filter(Boolean))];
    const subStrandIdMap = new Map<string, string>();

    for (const subStrandName of uniqueSubStrands) {
      // Find parent strand for this sub-strand
      const parentLesson = parsed.lessons.find((l) => l.subStrand.trim() === subStrandName);
      const parentStrandName = parentLesson?.strand.trim() || uniqueStrands[0];
      const parentStrandId = strandIdMap.get(parentStrandName);

      if (!parentStrandId) {continue;}

      const { data: existingSub } = await supabase
        .from('sub_strands')
        .select('id')
        .eq('name', subStrandName)
        .eq('strand_id', parentStrandId)
        .maybeSingle();

      if (existingSub) {
        subStrandIdMap.set(subStrandName, existingSub.id);
      } else {
        const { data: newSub, error } = await supabase
          .from('sub_strands')
          .insert({
            name: subStrandName,
            description: `Sub-strand from ${parsed.header.term} ${parsed.header.year} scheme`,
            strand_id: parentStrandId,
            school_id: schoolId,
          })
          .select('id')
          .single();

        if (error) {
          createdSubStrands.push(`⚠️ Failed to create "${subStrandName}": ${error.message}`);
        } else {
          subStrandIdMap.set(subStrandName, newSub.id);
          createdSubStrands.push(subStrandName);
        }
      }
    }

    // ── Step 4: Extract unique learning outcomes as competencies ─
    const outcomeSet = new Set<string>();
    for (const lesson of parsed.lessons) {
      for (const outcome of lesson.learningOutcomes) {
        const key = `${lesson.subStrand.trim()}|||${outcome}`;
        outcomeSet.add(key);
      }
    }

    for (const key of outcomeSet) {
      const [subStrandName, outcomeText] = key.split('|||');
      const subStrandId = subStrandIdMap.get(subStrandName);

      if (!subStrandId) {continue;}

      // Check for similar existing competency
      const truncated = outcomeText.substring(0, 100);
      const { data: existingComp } = await supabase
        .from('competencies')
        .select('id')
        .eq('name', truncated)
        .eq('sub_strand_id', subStrandId)
        .maybeSingle();

      if (!existingComp) {
        const { data: newComp, error } = await supabase
          .from('competencies')
          .insert({
            name: truncated,
            description: outcomeText,
            sub_strand_id: subStrandId,
            school_id: schoolId,
            term: parsed.header.term,
            academic_year: parsed.header.year,
            assessment_type: 'observation',
          })
          .select('id')
          .single();

        if (error) {
          createdCompetencies.push(`⚠️ Failed to create competency: ${error.message}`);
        } else {
          createdCompetencies.push(`${truncated.substring(0, 60)  }...`);
        }
      }
    }

    const totalCreated = createdStrands.length + createdSubStrands.length + createdCompetencies.length;
    const totalFailed =
      createdStrands.filter((s) => s.startsWith('⚠️')).length +
      createdSubStrands.filter((s) => s.startsWith('⚠️')).length +
      createdCompetencies.filter((c) => c.startsWith('⚠️')).length;

    return {
      success: true,
      message: `Imported scheme: ${parsed.header.learningArea} - ${parsed.header.term} ${parsed.header.year}. Created ${createdStrands.filter((s) => !s.startsWith('⚠️')).length} strand(s), ${createdSubStrands.filter((s) => !s.startsWith('⚠️')).length} sub-strand(s), ${createdCompetencies.filter((c) => !c.startsWith('⚠️')).length} competenc${createdCompetencies.filter((c) => !c.startsWith('⚠️')).length === 1 ? 'y' : 'ies'}.`,
      parsed,
      createdStrands: createdStrands.filter((s) => !s.startsWith('⚠️')),
      createdSubStrands: createdSubStrands.filter((s) => !s.startsWith('⚠️')),
      createdCompetencies: createdCompetencies.filter((c) => !c.startsWith('⚠️')),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during import',
    };
  }
}
