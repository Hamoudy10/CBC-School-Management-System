import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { LessonPlanRequest, LessonPlanResult, LessonPlan } from "../types";

const lessonPlanOutputSchema = z.object({
  title: z.string(),
  learningOutcomes: z.array(z.string()),
  coreCompetencies: z.array(z.string()),
  values: z.array(z.string()),
  lessonMaterials: z.array(z.string()),
  activities: z.array(
    z.object({
      time: z.string(),
      duration: z.number(),
      activity: z.string(),
      description: z.string(),
      teacherRole: z.string(),
      learnerRole: z.string(),
      resources: z.array(z.string()),
    })
  ),
  assessmentMethods: z.array(z.string()),
  differentiationStrategies: z.array(z.string()),
  homeworkTask: z.string(),
  teacherReflection: z.string(),
});

export async function generateLessonPlan(
  input: LessonPlanRequest,
  schoolId: string
): Promise<LessonPlanResult> {
  const supabase = await createSupabaseServerClient();

  const [classData, learningArea, strandData, subStrandData, competencyData] =
    await Promise.all([
      supabase
        .from("classes")
        .select("name, grade:grades(name)")
        .eq("class_id", input.classId)
        .eq("school_id", schoolId)
        .single(),
      supabase
        .from("learning_areas")
        .select("name, code")
        .eq("learning_area_id", input.learningAreaId)
        .eq("school_id", schoolId)
        .single(),
      input.strandId
        ? supabase
            .from("strands")
            .select("name")
            .eq("strand_id", input.strandId)
            .eq("school_id", schoolId)
            .single()
        : Promise.resolve({ data: null }),
      input.subStrandId
        ? supabase
            .from("sub_strands")
            .select("name")
            .eq("sub_strand_id", input.subStrandId)
            .eq("school_id", schoolId)
            .single()
        : Promise.resolve({ data: null }),
      input.competencyId
        ? supabase
            .from("competencies")
            .select("name")
            .eq("competency_id", input.competencyId)
            .eq("school_id", schoolId)
            .single()
        : Promise.resolve({ data: null }),
    ]);

  const grade = (classData.data as any)?.grade?.name ?? "Unknown";
  const className = (classData.data as any)?.name ?? "";
  const subject = (learningArea.data as any)?.name ?? "Unknown";
  const strand = (strandData.data as any)?.name ?? "";
  const subStrand = (subStrandData.data as any)?.name ?? "";
  const competency = (competencyData.data as any)?.name ?? "";

  const competencies = competency ? [competency] : [];

  try {
    const ai = await generateGroqCompletion<z.infer<typeof lessonPlanOutputSchema>>({
      system: `You are a CBC lesson plan developer for Kenyan schools.
Create detailed, practical lesson plans aligned to the Competency-Based Curriculum.
Follow the KICD lesson plan format.
Use learner-centered pedagogical approaches.
Return JSON only.`,
      prompt: `Generate a CBC lesson plan with the following details:

Grade: ${grade}
Subject: ${subject}
Class: ${className}
Strand: ${strand || "Not specified"}
Sub-strand: ${subStrand || "Not specified"}
Competency: ${competency || "Not specified"}
Duration: ${input.durationMinutes} minutes
Pedagogical Approach: ${input.pedagogicalApproach || "learner-centered"}
${input.includeResources ? "Include detailed resources and materials." : ""}
${input.includeAssessment ? "Include assessment methods and success criteria." : ""}

The lesson plan must include:
1. Learning outcomes (specific, measurable)
2. Core competencies to be developed (CBC: Communication and Collaboration, Critical Thinking, Creativity and Imagination, etc.)
3. Values to integrate (Unity, Respect, Responsibility, etc.)
4. Materials needed
5. Step-by-step activities with timing, teacher role, learner role
6. Assessment methods
7. Differentiation strategies (for learners with different needs)
8. Homework/extension task
9. Teacher reflection prompts

Rules:
- Follow KICD CBC guidelines
- Use learner-centered activities
- Include practical, hands-on learning
- Ensure age-appropriate language and activities
- Distribute time appropriately across lesson phases (introduction, development, conclusion)
- Total activity durations should sum to approximately ${input.durationMinutes} minutes`,
      responseFormat: "json",
      temperature: 0.3,
      responseSchema: lessonPlanOutputSchema,
      requestLabel: "ai-grading.generate-lesson",
      cache: { schoolId, classId: input.classId, ttlSeconds: 7200 },
    });

    const parsed = lessonPlanOutputSchema.parse(ai.data);

    const lessonPlan: LessonPlan = {
      title: parsed.title,
      grade,
      subject,
      strand: strand || "Various",
      subStrand: subStrand || "Various",
      competencies: parsed.coreCompetencies,
      duration: input.durationMinutes,
      learningOutcomes: parsed.learningOutcomes,
      coreCompetencies: parsed.coreCompetencies,
      values: parsed.values,
      lessonMaterials: parsed.lessonMaterials,
      activities: parsed.activities,
      assessmentMethods: parsed.assessmentMethods,
      differentiationStrategies: parsed.differentiationStrategies,
      homeworkTask: parsed.homeworkTask,
      teacherReflection: parsed.teacherReflection,
    };

    return {
      lessonPlan,
      confidence: ai.confidence,
      warnings: ai.warnings || [],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("AI lesson plan generation failed, using template fallback", {
      error: error instanceof Error ? error.message : "Unknown",
    });

    const totalDuration = input.durationMinutes;
    const introDuration = Math.round(totalDuration * 0.15);
    const devDuration = Math.round(totalDuration * 0.6);
    const conclDuration = totalDuration - introDuration - devDuration;

    const lessonPlan: LessonPlan = {
      title: `Lesson on ${subject}: ${strand || "Core Concepts"}`,
      grade,
      subject,
      strand: strand || "Various",
      subStrand: subStrand || "Various",
      competencies: competencies,
      duration: input.durationMinutes,
      learningOutcomes: [
        `By the end of the lesson, learners should be able to explain key concepts in ${subject}`,
        `Learners should be able to apply their knowledge in practical activities`,
        `Learners should demonstrate collaboration and communication skills`,
      ],
      coreCompetencies: [
        "Communication and Collaboration",
        "Critical Thinking and Problem Solving",
        "Creativity and Imagination",
        "Digital Literacy",
      ],
      values: ["Unity", "Respect", "Responsibility", "Integrity"],
      lessonMaterials: [
        "Whiteboard and markers",
        "Learner textbooks",
        "Activity worksheets",
        "Learning area-specific resources",
        "Digital devices (if available)",
      ],
      activities: [
        {
          time: "0:00",
          duration: introDuration,
          activity: "Introduction and Lesson Setup",
          description: "Greet learners, review previous knowledge through questions, state learning outcomes for the lesson.",
          teacherRole: "Guide discussion, explain objectives, connect to prior learning",
          learnerRole: "Listen, respond to questions, share prior knowledge",
          resources: ["Whiteboard", "Charts"],
        },
        {
          time: `${introDuration}:00`,
          duration: devDuration,
          activity: "Main Lesson Activities",
          description: "Learners engage in group work, practical activities, and discussions to explore the topic. Teacher facilitates and provides guidance.",
          teacherRole: "Facilitate activities, provide guidance, monitor progress, ask probing questions",
          learnerRole: "Work in groups, conduct investigations, discuss findings, present to class",
          resources: ["Worksheets", "Learning materials", "Group activity supplies"],
        },
        {
          time: `${introDuration + devDuration}:00`,
          duration: conclDuration,
          activity: "Review and Assessment",
          description: "Summarize key points, learners reflect on what they learned, assessment of learning outcomes.",
          teacherRole: "Lead summary discussion, assess understanding, assign take-home task",
          learnerRole: "Share reflections, answer review questions, note homework",
          resources: ["Exit tickets", "Summary notes"],
        },
      ],
      assessmentMethods: [
        "Observation of group work participation",
        "Oral questions and answers",
        "Activity-based assessment",
        "Exit ticket/reflection journal",
      ],
      differentiationStrategies: [
        "Provide additional support for struggling learners through peer tutoring",
        "Offer extension activities for fast learners",
        "Use visual aids and hands-on materials for varied learning styles",
        "Adjust task complexity based on learner readiness",
      ],
      homeworkTask: `Research and write a short paragraph about how the concepts learned in ${subject} apply to everyday life.`,
      teacherReflection: "Reflect on whether the learning outcomes were achieved. Which activities engaged learners most? What adjustments would you make for the next lesson?",
    };

    return {
      lessonPlan,
      confidence: 0.7,
      warnings: ["Used template-based lesson plan (AI generation was unavailable)"],
      generatedAt: new Date().toISOString(),
    };
  }
}
