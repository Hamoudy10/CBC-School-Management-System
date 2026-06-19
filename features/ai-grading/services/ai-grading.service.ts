import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { GradingRequest, GradingResult, GradedResponse } from "../types";

const gradingOutputSchema = z.object({
  gradedResponses: z.array(
    z.object({
      studentId: z.string(),
      studentName: z.string(),
      totalScore: z.number(),
      questionResults: z.array(
        z.object({
          questionNumber: z.number(),
          score: z.number(),
          feedback: z.string(),
          strengths: z.array(z.string()),
          weaknesses: z.array(z.string()),
        })
      ),
      overallFeedback: z.string(),
    })
  ),
  classSummary: z.object({
    averageScore: z.number(),
    highestScore: z.number(),
    lowestScore: z.number(),
    medianScore: z.number(),
    levelDistribution: z.record(z.number()),
  }),
});

function computeLevel(percentage: number): "exceeding" | "meeting" | "approaching" | "below_expectation" {
  if (percentage >= 80) return "exceeding";
  if (percentage >= 60) return "meeting";
  if (percentage >= 40) return "approaching";
  return "below_expectation";
}

function deterministicGrade(input: GradingRequest): GradingResult {
  const gradedResponses: GradedResponse[] = [];
  const maxTotalScore = input.questions.reduce((sum, q) => sum + q.marks, 0);

  for (const response of input.studentResponses) {
    let totalScore = 0;
    const questionResults: GradedResponse["questionResults"] = [];

    for (const question of input.questions) {
      const answer = response.answers.find((a) => a.questionNumber === question.number);
      let score = 0;
      let feedback = "";
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      if (answer) {
        if (question.type === "multiple_choice" && question.correctAnswer) {
          const isCorrect = answer.response.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
          score = isCorrect ? question.marks : 0;
          feedback = isCorrect ? "Correct." : "Incorrect.";
          if (isCorrect) strengths.push("Accurate response");
          else weaknesses.push("Review the correct answer");
        } else {
          const wordCount = answer.response.split(/\s+/).length;
          if (wordCount > 0) {
            score = Math.round((Math.min(wordCount / 20, 1)) * question.marks);
          }
          if (question.expectedPoints) {
            const matched = question.expectedPoints.filter((point) =>
              answer.response.toLowerCase().includes(point.toLowerCase())
            ).length;
            const ratio = matched / question.expectedPoints.length;
            score = Math.round(ratio * question.marks);
            if (matched > 0) strengths.push(`Covered ${matched} of ${question.expectedPoints.length} key points`);
            if (matched < question.expectedPoints.length) weaknesses.push("Missing some key points");
          }
          feedback = score >= question.marks * 0.7 ? "Good response." : score >= question.marks * 0.4 ? "Adequate, needs improvement." : "Requires significant improvement.";
        }
      } else {
        feedback = "No response provided.";
        weaknesses.push("Question not answered");
      }

      totalScore += score;
      questionResults.push({
        questionNumber: question.number,
        score,
        maxScore: question.marks,
        feedback,
        strengths,
        weaknesses,
      });
    }

    const percentage = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;

    gradedResponses.push({
      studentId: response.studentId,
      studentName: response.studentName,
      totalScore,
      maxTotalScore,
      percentage: Math.round(percentage * 100) / 100,
      performanceLevel: computeLevel(percentage),
      questionResults,
      overallFeedback: percentage >= 80 ? "Excellent work!" : percentage >= 60 ? "Good effort, keep improving." : percentage >= 40 ? "Needs more practice." : "Requires significant additional support.",
    });
  }

  const scores = gradedResponses.map((r) => r.totalScore);
  const sorted = [...scores].sort((a, b) => a - b);
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const distribution: Record<string, number> = {};
  for (const r of gradedResponses) {
    distribution[r.performanceLevel] = (distribution[r.performanceLevel] || 0) + 1;
  }

  return {
    subject: input.subject,
    grade: input.grade,
    totalStudents: input.studentResponses.length,
    gradedResponses,
    classSummary: {
      averageScore: Math.round(avg * 100) / 100,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      medianScore: sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0,
      levelDistribution: distribution,
    },
    confidence: 0.75,
    warnings: ["Used deterministic grading (AI was unavailable)"],
    generatedAt: new Date().toISOString(),
  };
}

export async function gradeStudentResponses(
  input: GradingRequest,
  schoolId: string
): Promise<GradingResult> {
  const maxTotalScore = input.questions.reduce((sum, q) => sum + q.marks, 0);

  try {
    const ai = await generateGroqCompletion<z.infer<typeof gradingOutputSchema>>({
      system: `You are a CBC assessment grading assistant for Kenyan schools.
You grade student responses accurately and provide constructive feedback.
Use the CBC performance levels: 80%+ = Exceeding, 60-79% = Meeting, 40-59% = Approaching, below 40% = Below Expectation.
Be fair and consistent.
Return JSON only.`,
      prompt: `Grade these ${input.studentResponses.length} student responses for a ${input.subject} exam (Grade ${input.grade}):

Exam Questions:
${JSON.stringify(input.questions, null, 2)}

Student Responses:
${JSON.stringify(input.studentResponses, null, 2)}

${input.markingScheme ? `Marking Scheme:\n${JSON.stringify(input.markingScheme, null, 2)}` : ""}

For each student:
- Score each question accurately against the marking criteria
- Provide specific, constructive feedback
- Identify strengths and weaknesses
- Give overall feedback

Rules:
- For multiple choice: exact match required for full marks
- For short answer: accept reasonable equivalent answers
- For structured: award partial credit for partially correct responses
- For essay: evaluate against rubric points
- Be consistent across all students
- Maximum total score is ${maxTotalScore}`,
      responseFormat: "json",
      temperature: 0.15,
      responseSchema: gradingOutputSchema,
      requestLabel: "ai-grading.grade",
      cache: { schoolId, ttlSeconds: 3600 },
    });

    const parsed = gradingOutputSchema.parse(ai.data);

    const gradedResponses: GradedResponse[] = parsed.gradedResponses.map((r: any) => {
      const totalScore = r.totalScore;
      const percentage = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
      return {
        studentId: r.studentId,
        studentName: r.studentName,
        totalScore,
        maxTotalScore,
        percentage: Math.round(percentage * 100) / 100,
        performanceLevel: computeLevel(percentage),
        questionResults: r.questionResults.map((qr: any) => ({
          questionNumber: qr.questionNumber,
          score: qr.score,
          maxScore: input.questions.find((q) => q.number === qr.questionNumber)?.marks ?? 0,
          feedback: qr.feedback,
          strengths: qr.strengths || [],
          weaknesses: qr.weaknesses || [],
        })),
        overallFeedback: r.overallFeedback,
      };
    });

    return {
      subject: input.subject,
      grade: input.grade,
      totalStudents: input.studentResponses.length,
      gradedResponses,
      classSummary: parsed.classSummary,
      confidence: ai.confidence,
      warnings: ai.warnings || [],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("AI grading failed, using deterministic fallback", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return deterministicGrade(input);
  }
}
