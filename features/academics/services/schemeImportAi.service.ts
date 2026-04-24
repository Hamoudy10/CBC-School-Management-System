import { z } from "zod";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import {
  importSchemeToDatabase,
  type ParsedScheme,
  type SchemeImportResult,
} from "./schemeParser.service";
import type { AuthUser } from "@/types/auth";

const aiLessonSchema = z.object({
  week: z.coerce.number().int().min(1),
  lesson: z.coerce.number().int().min(1).default(1),
  strand: z.string().trim().min(1),
  subStrand: z.string().trim().default(""),
  learningOutcomes: z.array(z.string().trim()).default([]),
  learningExperiences: z.array(z.string().trim()).default([]),
  inquiryQuestions: z.array(z.string().trim()).default([]),
  resources: z.array(z.string().trim()).default([]),
  assessmentMethods: z.array(z.string().trim()).default([]),
});

const aiSchemeSchema = z.object({
  header: z
    .object({
      grade: z.string().trim().default(""),
      learningArea: z.string().trim().default(""),
      term: z.string().trim().default(""),
      year: z.string().trim().default(""),
    })
    .default({
      grade: "",
      learningArea: "",
      term: "",
      year: "",
    }),
  lessons: z.array(aiLessonSchema).min(1),
});

type AISchemeOutput = z.infer<typeof aiSchemeSchema>;

export type SchemeImportAIInput = {
  textContent: string;
  importToDatabase: boolean;
  user: AuthUser;
};

export type SchemeImportAIResult = {
  success: boolean;
  status: number;
  error?: string;
  data?: {
    parsed: {
      header: ParsedScheme["header"];
      lessonCount: number;
      strandCount: number;
      subStrandCount: number;
      competencyCount: number;
      weeks: number[];
      strands: string[];
    };
    lessons: ParsedScheme["lessons"];
    warnings: string[];
    missingElements: string[];
    databaseImport: SchemeImportResult | null;
  };
};

function buildSchemeImportPrompt(truncatedText: string) {
  const schema = {
    header: {
      grade: "string",
      learningArea: "string",
      term: "string",
      year: "string",
    },
    lessons: [
      {
        week: 1,
        lesson: 1,
        strand: "string",
        subStrand: "string",
        learningOutcomes: ["string"],
        learningExperiences: ["string"],
        inquiryQuestions: ["string"],
        resources: ["string"],
        assessmentMethods: ["string"],
      },
    ],
  };

  const system = [
    "You are a CBC (Competency Based Curriculum) scheme parser for Kenyan schools.",
    "Extract all lessons into valid JSON only.",
    "Never include markdown or narrative text.",
    "Exclude rows like HALF TERM BREAK, REVISION, ASSESSMENT, and MIDTERM BREAK.",
  ].join(" ");

  const prompt = [
    "Parse this scheme of work into the requested JSON schema.",
    "Rules:",
    "1. Extract header fields: grade, learningArea, term, year.",
    "2. For each lesson extract week, lesson, strand, subStrand, learningOutcomes, learningExperiences, inquiryQuestions, resources, assessmentMethods.",
    "3. Keep arrays empty instead of null when data is missing.",
    "4. Return strictly valid JSON object only.",
    "JSON schema:",
    JSON.stringify(schema),
    "Source text:",
    truncatedText,
  ].join("\n");

  return { system, prompt };
}

function normalizeParsedScheme(aiOutput: AISchemeOutput): ParsedScheme {
  const lessons = aiOutput.lessons.map((lesson) => ({
    ...lesson,
    subStrand: lesson.subStrand ?? "",
    learningOutcomes: lesson.learningOutcomes.filter(Boolean),
    learningExperiences: lesson.learningExperiences.filter(Boolean),
    inquiryQuestions: lesson.inquiryQuestions.filter(Boolean),
    resources: lesson.resources.filter(Boolean),
    assessmentMethods: lesson.assessmentMethods.filter(Boolean),
  }));

  const strandCount = new Set(lessons.map((lesson) => lesson.strand.trim())).size;
  const subStrandCount = new Set(
    lessons.map((lesson) => lesson.subStrand.trim()).filter(Boolean),
  ).size;
  const competencyCount = lessons.reduce(
    (sum, lesson) => sum + lesson.learningOutcomes.length,
    0,
  );

  return {
    header: {
      school: "",
      grade: aiOutput.header.grade,
      learningArea: aiOutput.header.learningArea,
      term: aiOutput.header.term,
      year: aiOutput.header.year,
    },
    lessons,
    warnings: [],
    missingElements: [],
    strandCount,
    subStrandCount,
    competencyCount,
  };
}

export async function parseSchemeWithAI({
  textContent,
  importToDatabase,
  user,
}: SchemeImportAIInput): Promise<SchemeImportAIResult> {
  const truncatedText = textContent.length > 30_000 ? textContent.slice(0, 30_000) : textContent;
  const { system, prompt } = buildSchemeImportPrompt(truncatedText);

  try {
    const aiResponse = await generateGroqCompletion({
      prompt,
      system,
      temperature: 0.1,
      responseFormat: "json",
      responseSchema: aiSchemeSchema,
      requestLabel: "academics.scheme-import",
      cache: {
        schoolId: user.schoolId,
        subject: "scheme-import",
      },
    });

    const validatedOutput = aiSchemeSchema.parse(aiResponse.data);
    const parsedScheme = normalizeParsedScheme(validatedOutput);
    const warnings = [...(aiResponse.warnings ?? [])];
    const missingElements: string[] = [];

    if (parsedScheme.lessons.length === 0) {
      return {
        success: false,
        status: 400,
        error: "AI could not parse any lessons from the scheme.",
      };
    }

    let databaseImport: SchemeImportResult | null = null;
    if (importToDatabase) {
      databaseImport = await importSchemeToDatabase(parsedScheme, user);

      if (databaseImport.warnings?.length) {
        warnings.push(...databaseImport.warnings);
      }

      if (databaseImport.missingElements?.length) {
        missingElements.push(...databaseImport.missingElements);
      }
    }

    return {
      success: true,
      status: 200,
      data: {
        parsed: {
          header: parsedScheme.header,
          lessonCount: parsedScheme.lessons.length,
          strandCount: parsedScheme.strandCount,
          subStrandCount: parsedScheme.subStrandCount,
          competencyCount: parsedScheme.competencyCount,
          weeks: Array.from(new Set(parsedScheme.lessons.map((lesson) => lesson.week))).sort(
            (left, right) => left - right,
          ),
          strands: Array.from(
            new Set(parsedScheme.lessons.map((lesson) => lesson.strand.trim())),
          ),
        },
        lessons: parsedScheme.lessons,
        warnings,
        missingElements,
        databaseImport,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI parsing error";
    const status = message.toLowerCase().includes("api key") ? 500 : 502;

    return {
      success: false,
      status,
      error: `Failed to parse scheme with AI: ${message}`,
    };
  }
}
