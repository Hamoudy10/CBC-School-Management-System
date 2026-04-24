"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, BookOpenCheck, ClipboardList, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

type ClassOption = {
  classId: string;
  name: string;
  gradeName: string;
};

type CompetencyNode = {
  id: string;
  name: string;
};

type SubStrandNode = {
  id: string;
  name: string;
  competencies: CompetencyNode[];
};

type StrandNode = {
  id: string;
  name: string;
  subStrands: SubStrandNode[];
};

type LearningAreaNode = {
  id: string;
  name: string;
  strands: StrandNode[];
};

type ContextSummary = {
  class: { name: string; gradeName: string } | null;
  learning_area: { name: string } | null;
  strand: { name: string } | null;
  sub_strand: { name: string } | null;
  competency: { name: string } | null;
  warnings: string[];
};

type LessonPlanResult = {
  result: {
    objectives: string[];
    activities: string[];
    materials: string[];
    assessment: string[];
    cbcCompetenciesMapped: string[];
  };
  context: ContextSummary;
  confidence: number;
  warnings: string[];
};

type AssessmentResult = {
  result: {
    title: string;
    instructions: string;
    questions: Array<{
      prompt: string;
      type: string;
      marks: number;
      options?: string[];
      expectedAnswer: string;
    }>;
    markingScheme: Array<{
      questionIndex: number;
      expectedPoints: string[];
      totalMarks: number;
    }>;
  };
  context: ContextSummary;
  confidence: number;
  warnings: string[];
};

type ExplanationResult = {
  result: {
    simplifiedExplanation: string;
    examples: string[];
    activities: string[];
    commonMistakes: string[];
  };
  context: ContextSummary;
  confidence: number;
  warnings: string[];
};

function normalizeHierarchy(raw: any[]): LearningAreaNode[] {
  return (raw ?? []).map((learningArea) => ({
    id: learningArea.learning_area_id ?? learningArea.learningAreaId ?? "",
    name: learningArea.name ?? "Learning Area",
    strands: (learningArea.strands ?? []).map((strand: any) => ({
      id: strand.strand_id ?? strand.strandId ?? "",
      name: strand.name ?? "Strand",
      subStrands: (strand.sub_strands ?? strand.subStrands ?? []).map((sub: any) => ({
        id: sub.sub_strand_id ?? sub.subStrandId ?? "",
        name: sub.name ?? "Sub-strand",
        competencies: (sub.competencies ?? []).map((competency: any) => ({
          id: competency.competency_id ?? competency.competencyId ?? "",
          name: competency.name ?? "Competency",
        })),
      })),
    })),
  }));
}

export default function CbcCopilotPage() {
  const { success, error } = useToast();
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [hierarchy, setHierarchy] = useState<LearningAreaNode[]>([]);

  const [classId, setClassId] = useState("");
  const [learningAreaId, setLearningAreaId] = useState("");
  const [strandId, setStrandId] = useState("");
  const [subStrandId, setSubStrandId] = useState("");
  const [competencyId, setCompetencyId] = useState("");

  const [durationMinutes, setDurationMinutes] = useState("40");
  const [lessonInstructions, setLessonInstructions] = useState("");
  const [assessmentType, setAssessmentType] = useState<"quiz" | "test">("quiz");
  const [questionCount, setQuestionCount] = useState("10");
  const [assessmentInstructions, setAssessmentInstructions] = useState("");
  const [explainQuestion, setExplainQuestion] = useState("");

  const [loadingLesson, setLoadingLesson] = useState(false);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [loadingExplain, setLoadingExplain] = useState(false);

  const [lessonResult, setLessonResult] = useState<LessonPlanResult | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [explanationResult, setExplanationResult] = useState<ExplanationResult | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      setLoadingBootstrap(true);

      try {
        const [referenceResponse, hierarchyResponse] = await Promise.all([
          fetch("/api/settings/reference-data?includeLearningAreas=true", {
            credentials: "include",
          }),
          fetch("/api/learning-areas?includeHierarchy=true", {
            credentials: "include",
          }),
        ]);

        const referenceJson = await referenceResponse.json();
        const hierarchyJson = await hierarchyResponse.json();

        if (!referenceResponse.ok) {
          throw new Error(referenceJson.error || "Failed to load classes.");
        }

        if (!hierarchyResponse.ok) {
          throw new Error(hierarchyJson.error || "Failed to load CBC hierarchy.");
        }

        if (!active) {
          return;
        }

        const loadedClasses: ClassOption[] = (referenceJson.data?.classes ?? []).map(
          (item: any) => ({
            classId: item.classId,
            name: item.name,
            gradeName: item.gradeName || `Grade ${item.gradeLevel ?? ""}`.trim(),
          }),
        );

        setClasses(loadedClasses);
        setHierarchy(normalizeHierarchy(hierarchyJson.data ?? []));
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Failed to load copilot context.";
        error("Load failed", message);
      } finally {
        if (active) {
          setLoadingBootstrap(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, [error]);

  const selectedLearningArea = useMemo(
    () => hierarchy.find((item) => item.id === learningAreaId) ?? null,
    [hierarchy, learningAreaId],
  );

  const availableStrands = selectedLearningArea?.strands ?? [];
  const selectedStrand = useMemo(
    () => availableStrands.find((item) => item.id === strandId) ?? null,
    [availableStrands, strandId],
  );

  const availableSubStrands = selectedStrand?.subStrands ?? [];
  const selectedSubStrand = useMemo(
    () => availableSubStrands.find((item) => item.id === subStrandId) ?? null,
    [availableSubStrands, subStrandId],
  );

  const availableCompetencies = selectedSubStrand?.competencies ?? [];

  async function callCopilot<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || "Copilot request failed.");
    }

    return json.data as T;
  }

  function resetCurriculumFromLearningArea(nextLearningAreaId: string) {
    setLearningAreaId(nextLearningAreaId);
    setStrandId("");
    setSubStrandId("");
    setCompetencyId("");
  }

  function resetCurriculumFromStrand(nextStrandId: string) {
    setStrandId(nextStrandId);
    setSubStrandId("");
    setCompetencyId("");
  }

  function resetCurriculumFromSubStrand(nextSubStrandId: string) {
    setSubStrandId(nextSubStrandId);
    setCompetencyId("");
  }

  async function handleGenerateLessonPlan() {
    if (!classId || !learningAreaId || !strandId || !subStrandId) {
      error("Missing fields", "Select class, learning area, strand, and sub-strand first.");
      return;
    }

    setLoadingLesson(true);
    setLessonResult(null);

    try {
      const data = await callCopilot<LessonPlanResult>("/api/ai/cbc-copilot/lesson-plan", {
        classId,
        learningAreaId,
        strandId,
        subStrandId,
        durationMinutes: Number(durationMinutes),
        additionalInstructions: lessonInstructions || undefined,
      });

      setLessonResult(data);
      success("Lesson plan ready", "CBC lesson plan generated successfully.");
    } catch (generationError) {
      error(
        "Generation failed",
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate lesson plan.",
      );
    } finally {
      setLoadingLesson(false);
    }
  }

  async function handleGenerateAssessment() {
    if (!classId || !learningAreaId || !strandId || !subStrandId) {
      error("Missing fields", "Select class, learning area, strand, and sub-strand first.");
      return;
    }

    setLoadingAssessment(true);
    setAssessmentResult(null);

    try {
      const data = await callCopilot<AssessmentResult>("/api/ai/cbc-copilot/assessment", {
        classId,
        learningAreaId,
        strandId,
        subStrandId,
        assessmentType,
        questionCount: Number(questionCount),
        additionalInstructions: assessmentInstructions || undefined,
      });

      setAssessmentResult(data);
      success("Assessment ready", "Assessment and marking guide generated.");
    } catch (generationError) {
      error(
        "Generation failed",
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate assessment.",
      );
    } finally {
      setLoadingAssessment(false);
    }
  }

  async function handleGenerateExplanation() {
    if (!classId) {
      error("Missing class", "Select a class before using explanation mode.");
      return;
    }

    if (explainQuestion.trim().length < 10) {
      error("Question too short", "Enter a clearer teaching question.");
      return;
    }

    setLoadingExplain(true);
    setExplanationResult(null);

    try {
      const data = await callCopilot<ExplanationResult>("/api/ai/cbc-copilot/explain", {
        classId,
        learningAreaId: learningAreaId || undefined,
        strandId: strandId || undefined,
        subStrandId: subStrandId || undefined,
        competencyId: competencyId || undefined,
        question: explainQuestion.trim(),
      });

      setExplanationResult(data);
      success("Explanation ready", "CBC explanation generated.");
    } catch (generationError) {
      error(
        "Generation failed",
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate explanation.",
      );
    } finally {
      setLoadingExplain(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CBC Copilot"
        description="AI teaching assistant for lesson plans, assessments, and concept explanations."
        icon={<Sparkles className="h-5 w-5" />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Teaching Context</CardTitle>
          <CardDescription>
            Select class and CBC hierarchy once, then use any copilot tool below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Class"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            disabled={loadingBootstrap}
          >
            <option value="">Select class</option>
            {classes.map((item) => (
              <option key={item.classId} value={item.classId}>
                {item.name} ({item.gradeName || "Grade"})
              </option>
            ))}
          </Select>

          <Select
            label="Learning Area"
            value={learningAreaId}
            onChange={(event) => resetCurriculumFromLearningArea(event.target.value)}
            disabled={loadingBootstrap}
          >
            <option value="">Select learning area</option>
            {hierarchy.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>

          <Select
            label="Strand"
            value={strandId}
            onChange={(event) => resetCurriculumFromStrand(event.target.value)}
            disabled={!learningAreaId}
          >
            <option value="">Select strand</option>
            {availableStrands.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>

          <Select
            label="Sub-strand"
            value={subStrandId}
            onChange={(event) => resetCurriculumFromSubStrand(event.target.value)}
            disabled={!strandId}
          >
            <option value="">Select sub-strand</option>
            {availableSubStrands.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>

          <Select
            label="Competency (Optional)"
            value={competencyId}
            onChange={(event) => setCompetencyId(event.target.value)}
            disabled={!subStrandId}
          >
            <option value="">Select competency</option>
            {availableCompetencies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4" />
              Lesson Plan Generator
            </CardTitle>
            <CardDescription>Generate CBC-aligned lesson plans with objectives and activities.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Duration (minutes)"
              type="number"
              min={10}
              max={180}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-secondary-700">Additional Instructions</label>
              <textarea
                value={lessonInstructions}
                onChange={(event) => setLessonInstructions(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-secondary-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Optional class-specific instruction..."
              />
            </div>
            <Button onClick={handleGenerateLessonPlan} loading={loadingLesson}>
              Generate Lesson Plan
            </Button>

            {lessonResult && (
              <div className="space-y-4 rounded-lg border border-secondary-200 bg-secondary-50 p-4">
                <ResultHeader confidence={lessonResult.confidence} warnings={lessonResult.warnings} />
                <ResultList title="Objectives" items={lessonResult.result.objectives} />
                <ResultList title="Activities" items={lessonResult.result.activities} />
                <ResultList title="Materials" items={lessonResult.result.materials} />
                <ResultList title="Assessment" items={lessonResult.result.assessment} />
                <ResultList
                  title="CBC Competencies Mapped"
                  items={lessonResult.result.cbcCompetenciesMapped}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Assessment Generator
            </CardTitle>
            <CardDescription>Create quizzes/tests and auto-generated marking schemes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Assessment Type"
                value={assessmentType}
                onChange={(event) => setAssessmentType(event.target.value as "quiz" | "test")}
              >
                <option value="quiz">Quiz</option>
                <option value="test">Test</option>
              </Select>
              <Input
                label="Question Count"
                type="number"
                min={3}
                max={30}
                value={questionCount}
                onChange={(event) => setQuestionCount(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-secondary-700">Additional Instructions</label>
              <textarea
                value={assessmentInstructions}
                onChange={(event) => setAssessmentInstructions(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-secondary-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Optional assessment constraints..."
              />
            </div>
            <Button onClick={handleGenerateAssessment} loading={loadingAssessment}>
              Generate Assessment
            </Button>

            {assessmentResult && (
              <div className="space-y-4 rounded-lg border border-secondary-200 bg-secondary-50 p-4">
                <ResultHeader
                  confidence={assessmentResult.confidence}
                  warnings={assessmentResult.warnings}
                />
                <div>
                  <h4 className="text-sm font-semibold text-secondary-800">
                    {assessmentResult.result.title}
                  </h4>
                  <p className="mt-1 text-sm text-secondary-600">
                    {assessmentResult.result.instructions}
                  </p>
                </div>
                <ResultList
                  title="Questions"
                  items={assessmentResult.result.questions.map(
                    (question, index) =>
                      `${index + 1}. ${question.prompt} (${question.marks} marks)`,
                  )}
                />
                <ResultList
                  title="Marking Scheme"
                  items={assessmentResult.result.markingScheme.map(
                    (marking) =>
                      `Q${marking.questionIndex}: ${marking.expectedPoints.join("; ")} (${marking.totalMarks} marks)`,
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            CBC Explanation Mode
          </CardTitle>
          <CardDescription>
            Ask teaching questions like: &quot;Explain fractions for Grade 5 CBC.&quot;
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-secondary-700">Teacher Question</label>
            <textarea
              value={explainQuestion}
              onChange={(event) => setExplainQuestion(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-secondary-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Explain fractions for Grade 5 CBC..."
            />
          </div>
          <Button onClick={handleGenerateExplanation} loading={loadingExplain}>
            Generate Explanation
          </Button>

          {explanationResult && (
            <div className="space-y-4 rounded-lg border border-secondary-200 bg-secondary-50 p-4">
              <ResultHeader
                confidence={explanationResult.confidence}
                warnings={explanationResult.warnings}
              />
              <div>
                <h4 className="text-sm font-semibold text-secondary-800">Simplified Explanation</h4>
                <p className="mt-1 text-sm text-secondary-700">
                  {explanationResult.result.simplifiedExplanation}
                </p>
              </div>
              <ResultList title="Examples" items={explanationResult.result.examples} />
              <ResultList title="Activities" items={explanationResult.result.activities} />
              <ResultList
                title="Common Mistakes"
                items={explanationResult.result.commonMistakes}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {loadingBootstrap && (
        <Alert>
          <AlertTitle>Loading context</AlertTitle>
          <AlertDescription>
            Fetching classes and CBC hierarchy for copilot context...
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ResultHeader({ confidence, warnings }: { confidence: number; warnings: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="info">Confidence: {(confidence * 100).toFixed(0)}%</Badge>
      {warnings.length > 0 && <Badge variant="warning">Warnings: {warnings.length}</Badge>}
    </div>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-secondary-800">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-secondary-700">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
