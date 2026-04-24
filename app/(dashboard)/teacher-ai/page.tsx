"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Brain, ClipboardCheck, FileText, TrendingUp } from "lucide-react";
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

type LearningAreaOption = {
  learningAreaId: string;
  name: string;
};

type StudentOption = {
  studentId: string;
  fullName: string;
  admissionNumber: string;
};

type ReportCommentResult = {
  result: {
    comment: string;
    performanceSummary: string;
    behaviorSummary: string;
    nextSteps: string[];
  };
  confidence: number;
  warnings: string[];
  generatedAt: string;
};

type MarkSuggestionResult = {
  result: {
    grade: string;
    performanceLevel: string;
    scoreOnCbcScale: number;
    comment: string;
    rationale: string;
  };
  confidence: number;
  warnings: string[];
  generatedAt: string;
};

type ClassroomInsightsResult = {
  result: {
    weakStudents: Array<{ studentId: string; name: string; reasons: string[] }>;
    strongPerformers: Array<{ studentId: string; name: string; reasons: string[] }>;
    attentionNeeded: Array<{ studentId: string; name: string; reasons: string[] }>;
    classSummary: string;
  };
  confidence: number;
  warnings: string[];
  generatedAt: string;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error || "Request failed.");
  }
  return json.data as T;
}

export default function TeacherAICopilotPage() {
  const { success, error } = useToast();
  const [loadingContext, setLoadingContext] = useState(true);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [learningAreas, setLearningAreas] = useState<LearningAreaOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);

  const [classId, setClassId] = useState("");
  const [learningAreaId, setLearningAreaId] = useState("");
  const [studentId, setStudentId] = useState("");

  const [rawMark, setRawMark] = useState("72");
  const [maxMark, setMaxMark] = useState("100");
  const [lookbackDays, setLookbackDays] = useState("30");

  const [loadingReportComment, setLoadingReportComment] = useState(false);
  const [loadingMarkSuggestion, setLoadingMarkSuggestion] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [reportComment, setReportComment] = useState<ReportCommentResult | null>(null);
  const [markSuggestion, setMarkSuggestion] = useState<MarkSuggestionResult | null>(null);
  const [classroomInsights, setClassroomInsights] = useState<ClassroomInsightsResult | null>(null);

  useEffect(() => {
    let active = true;

    async function loadContext() {
      setLoadingContext(true);
      try {
        const response = await fetch("/api/settings/reference-data?includeLearningAreas=true", {
          credentials: "include",
        });
        const data = await parseResponse<any>(response);

        if (!active) {
          return;
        }

        const loadedClasses: ClassOption[] = (data.classes ?? []).map((item: any) => ({
          classId: item.classId,
          name: item.name,
          gradeName: item.gradeName ?? `Grade ${item.gradeLevel ?? ""}`.trim(),
        }));

        const loadedAreas: LearningAreaOption[] = (data.learningAreas ?? []).map((item: any) => ({
          learningAreaId: item.learningAreaId,
          name: item.name,
        }));

        setClasses(loadedClasses);
        setLearningAreas(loadedAreas);
      } catch (loadError) {
        error(
          "Load failed",
          loadError instanceof Error ? loadError.message : "Failed to load teacher AI context.",
        );
      } finally {
        if (active) {
          setLoadingContext(false);
        }
      }
    }

    void loadContext();

    return () => {
      active = false;
    };
  }, [error]);

  useEffect(() => {
    let active = true;

    async function loadStudents() {
      if (!classId) {
        setStudents([]);
        setStudentId("");
        return;
      }

      try {
        const response = await fetch(`/api/teacher-ai/class-students?classId=${classId}`, {
          credentials: "include",
        });
        const data = await parseResponse<StudentOption[]>(response);

        if (!active) {
          return;
        }

        setStudents(data);
        setStudentId((current) => (data.some((item) => item.studentId === current) ? current : ""));
      } catch (loadError) {
        if (!active) {
          return;
        }
        setStudents([]);
        setStudentId("");
        error(
          "Student load failed",
          loadError instanceof Error ? loadError.message : "Failed to load class students.",
        );
      }
    }

    void loadStudents();

    return () => {
      active = false;
    };
  }, [classId, error]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.classId === classId) ?? null,
    [classes, classId],
  );

  async function handleGenerateReportComment() {
    if (!classId || !studentId) {
      error("Missing fields", "Select class and student first.");
      return;
    }

    setLoadingReportComment(true);
    setReportComment(null);

    try {
      const response = await fetch("/api/teacher-ai/report-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          classId,
          studentId,
          learningAreaId: learningAreaId || undefined,
        }),
      });
      const data = await parseResponse<ReportCommentResult>(response);
      setReportComment(data);
      success("Comment ready", "AI report comment generated.");
    } catch (requestError) {
      error(
        "Generation failed",
        requestError instanceof Error ? requestError.message : "Failed to generate report comment.",
      );
    } finally {
      setLoadingReportComment(false);
    }
  }

  async function handleGenerateMarkSuggestion() {
    if (!classId) {
      error("Missing class", "Select class before requesting mark suggestions.");
      return;
    }

    setLoadingMarkSuggestion(true);
    setMarkSuggestion(null);

    try {
      const response = await fetch("/api/teacher-ai/mark-entry-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          classId,
          studentId: studentId || undefined,
          learningAreaId: learningAreaId || undefined,
          rawMark: Number(rawMark),
          maxMark: Number(maxMark),
        }),
      });
      const data = await parseResponse<MarkSuggestionResult>(response);
      setMarkSuggestion(data);
      success("Suggestion ready", "Mark entry suggestion generated.");
    } catch (requestError) {
      error(
        "Generation failed",
        requestError instanceof Error ? requestError.message : "Failed to generate mark suggestion.",
      );
    } finally {
      setLoadingMarkSuggestion(false);
    }
  }

  async function handleGenerateClassInsights() {
    if (!classId) {
      error("Missing class", "Select class before generating insights.");
      return;
    }

    setLoadingInsights(true);
    setClassroomInsights(null);

    try {
      const response = await fetch("/api/teacher-ai/classroom-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          classId,
          learningAreaId: learningAreaId || undefined,
          lookbackDays: Number(lookbackDays),
        }),
      });
      const data = await parseResponse<ClassroomInsightsResult>(response);
      setClassroomInsights(data);
      success("Insights ready", "Classroom insights generated.");
    } catch (requestError) {
      error(
        "Generation failed",
        requestError instanceof Error ? requestError.message : "Failed to generate classroom insights.",
      );
    } finally {
      setLoadingInsights(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher AI Copilot"
        description="Daily AI support for report comments, mark entry, and classroom insights."
        icon={<Brain className="h-5 w-5" />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Context</CardTitle>
          <CardDescription>Select class context for all Teacher AI tools.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Select
            label="Class"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            disabled={loadingContext}
          >
            <option value="">Select class</option>
            {classes.map((item) => (
              <option key={item.classId} value={item.classId}>
                {item.name} ({item.gradeName || "Grade"})
              </option>
            ))}
          </Select>

          <Select
            label="Learning Area (Optional)"
            value={learningAreaId}
            onChange={(event) => setLearningAreaId(event.target.value)}
            disabled={loadingContext}
          >
            <option value="">All learning areas</option>
            {learningAreas.map((item) => (
              <option key={item.learningAreaId} value={item.learningAreaId}>
                {item.name}
              </option>
            ))}
          </Select>

          <Select
            label="Student (for student-level tools)"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            disabled={!classId}
          >
            <option value="">Select student</option>
            {students.map((item) => (
              <option key={item.studentId} value={item.studentId}>
                {item.fullName} ({item.admissionNumber || "No admission no"})
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Auto Report Comment Generator
            </CardTitle>
            <CardDescription>Generate report comments from marks, attendance, and behavior data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGenerateReportComment} loading={loadingReportComment}>
              Generate Report Comment
            </Button>

            {reportComment && (
              <ResultContainer confidence={reportComment.confidence} warnings={reportComment.warnings}>
                <ResultBlock title="Comment" text={reportComment.result.comment} />
                <ResultBlock
                  title="Performance Summary"
                  text={reportComment.result.performanceSummary}
                />
                <ResultBlock title="Behavior Summary" text={reportComment.result.behaviorSummary} />
                <SimpleList title="Next Steps" items={reportComment.result.nextSteps} />
              </ResultContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Mark Entry Assistant
            </CardTitle>
            <CardDescription>Convert raw marks into grade, CBC level, and teacher-ready comment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Raw Mark"
                type="number"
                min={0}
                max={100}
                value={rawMark}
                onChange={(event) => setRawMark(event.target.value)}
              />
              <Input
                label="Max Mark"
                type="number"
                min={1}
                max={100}
                value={maxMark}
                onChange={(event) => setMaxMark(event.target.value)}
              />
            </div>

            <Button onClick={handleGenerateMarkSuggestion} loading={loadingMarkSuggestion}>
              Generate Suggestion
            </Button>

            {markSuggestion && (
              <ResultContainer confidence={markSuggestion.confidence} warnings={markSuggestion.warnings}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">Grade: {markSuggestion.result.grade}</Badge>
                  <Badge variant="success">
                    CBC Scale: {markSuggestion.result.scoreOnCbcScale}
                  </Badge>
                  <Badge variant="warning">
                    Level: {markSuggestion.result.performanceLevel.replaceAll("_", " ")}
                  </Badge>
                </div>
                <ResultBlock title="Comment" text={markSuggestion.result.comment} />
                <ResultBlock title="Rationale" text={markSuggestion.result.rationale} />
              </ResultContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Classroom Insights Generator
          </CardTitle>
          <CardDescription>
            Daily class summary with weak students, strong performers, and attention-needed learners.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Input
              label="Lookback Days"
              type="number"
              min={7}
              max={120}
              value={lookbackDays}
              onChange={(event) => setLookbackDays(event.target.value)}
            />
          </div>

          <Button onClick={handleGenerateClassInsights} loading={loadingInsights}>
            Generate Classroom Insights
          </Button>

          {classroomInsights && (
            <ResultContainer confidence={classroomInsights.confidence} warnings={classroomInsights.warnings}>
              <ResultBlock title="Class Summary" text={classroomInsights.result.classSummary} />
              <SimpleStudentList title="Weak Students" items={classroomInsights.result.weakStudents} />
              <SimpleStudentList
                title="Strong Performers"
                items={classroomInsights.result.strongPerformers}
              />
              <SimpleStudentList
                title="Attention Needed"
                items={classroomInsights.result.attentionNeeded}
              />
            </ResultContainer>
          )}
        </CardContent>
      </Card>

      {selectedClass && (
        <Alert>
          <AlertTitle>Current class context</AlertTitle>
          <AlertDescription>
            Working on <strong>{selectedClass.name}</strong> ({selectedClass.gradeName || "Grade"}).
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ResultContainer({
  confidence,
  warnings,
  children,
}: {
  confidence: number;
  warnings: string[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-secondary-200 bg-secondary-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Confidence: {(confidence * 100).toFixed(0)}%</Badge>
        {warnings.length > 0 ? <Badge variant="warning">Warnings: {warnings.length}</Badge> : null}
      </div>
      {children}
      {warnings.length > 0 ? <SimpleList title="Warnings" items={warnings} /> : null}
    </div>
  );
}

function ResultBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-secondary-800">{title}</h4>
      <p className="mt-1 text-sm text-secondary-700">{text}</p>
    </div>
  );
}

function SimpleList({ title, items }: { title: string; items: string[] }) {
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

function SimpleStudentList({
  title,
  items,
}: {
  title: string;
  items: Array<{ studentId: string; name: string; reasons: string[] }>;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-secondary-800">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-secondary-500">No learners in this category.</p>
      ) : (
        <ul className="mt-1 space-y-2">
          {items.map((item) => (
            <li key={item.studentId} className="rounded-md border border-secondary-200 bg-white p-3">
              <p className="text-sm font-semibold text-secondary-800">{item.name}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-secondary-700">
                {item.reasons.map((reason, index) => (
                  <li key={`${item.studentId}-${index}`}>{reason}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
