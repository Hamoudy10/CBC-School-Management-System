"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Activity, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
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

type AnalyticsResult<T> = {
  result: T;
  confidence: number;
  warnings: string[];
  generatedAt: string;
};

type DropoutRiskResult = {
  classId: string;
  className: string;
  lookbackDays: number;
  evaluatedStudents: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  summary: string;
  students: Array<{
    studentId: string;
    name: string;
    attendanceRate: number;
    averageScore: number;
    previousAverageScore: number;
    trendDelta: number;
    disciplineCount: number;
    majorIncidents: number;
    riskLevel: "low" | "medium" | "high";
    reason: string[];
    recommendation: string[];
  }>;
};

type ClassPerformanceResult = {
  classId: string;
  className: string;
  lookbackDays: number;
  overallAverageScore: number;
  timeline: Array<{
    periodLabel: string;
    averageScore: number;
    sampleSize: number;
  }>;
  subjectTrends: Array<{
    learningAreaId: string;
    learningAreaName: string;
    averageScore: number;
    previousAverageScore: number;
    trendDelta: number;
    trendDirection: "improving" | "declining" | "stable";
    sampleSize: number;
  }>;
  teacherComparison: Array<{
    teacherId: string;
    teacherName: string;
    learningAreaId: string;
    learningAreaName: string;
    averageScore: number;
    assessmentCount: number;
    relativeToClassAverage: number;
    evidenceMode: "direct_assessed_by" | "assignment_proxy";
    insight?: string;
  }>;
  insights: {
    summary: string;
    highlights: string[];
    recommendations: string[];
  };
};

type SchoolHealthResult = {
  lookbackDays: number;
  overallAverageScore: number;
  weakestSubject: {
    learningAreaId: string;
    learningAreaName: string;
    averageScore: number;
    sampleSize: number;
  } | null;
  decliningClasses: Array<{
    classId: string;
    className: string;
    averageScore: number;
    trendDelta: number;
    attendanceRate: number | null;
  }>;
  improvingClasses: Array<{
    classId: string;
    className: string;
    averageScore: number;
    trendDelta: number;
    attendanceRate: number | null;
  }>;
  summary: string;
  priorityActions: string[];
  watchList: string[];
};

async function parseResponse<T>(response: Response): Promise<T> {
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error || "Request failed.");
  }
  return json.data as T;
}

function confidenceBadge(confidence: number) {
  return `Confidence: ${(confidence * 100).toFixed(0)}%`;
}

export default function AnalyticsPage() {
  const { success, error } = useToast();
  const [loadingContext, setLoadingContext] = useState(true);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [learningAreas, setLearningAreas] = useState<LearningAreaOption[]>([]);

  const [classId, setClassId] = useState("");
  const [learningAreaId, setLearningAreaId] = useState("");
  const [lookbackDays, setLookbackDays] = useState("90");

  const [loadingDropout, setLoadingDropout] = useState(false);
  const [loadingClassTrends, setLoadingClassTrends] = useState(false);
  const [loadingSchoolHealth, setLoadingSchoolHealth] = useState(false);

  const [dropoutRisk, setDropoutRisk] = useState<AnalyticsResult<DropoutRiskResult> | null>(null);
  const [classPerformance, setClassPerformance] = useState<AnalyticsResult<ClassPerformanceResult> | null>(null);
  const [schoolHealth, setSchoolHealth] = useState<AnalyticsResult<SchoolHealthResult> | null>(null);

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

        const loadedLearningAreas: LearningAreaOption[] = (data.learningAreas ?? []).map((item: any) => ({
          learningAreaId: item.learningAreaId,
          name: item.name,
        }));

        setClasses(loadedClasses);
        setLearningAreas(loadedLearningAreas);
      } catch (loadError) {
        error(
          "Load failed",
          loadError instanceof Error ? loadError.message : "Failed to load analytics context.",
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

  async function handleDropoutRisk() {
    if (!classId) {
      error("Missing class", "Select class before running dropout risk detection.");
      return;
    }

    setLoadingDropout(true);
    setDropoutRisk(null);

    try {
      const response = await fetch("/api/analytics-ai/dropout-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          classId,
          lookbackDays: Number(lookbackDays),
          maxStudents: 25,
        }),
      });
      const result = await parseResponse<AnalyticsResult<DropoutRiskResult>>(response);
      setDropoutRisk(result);
      success("Dropout risk ready", "Learner risk analysis generated.");
    } catch (requestError) {
      error(
        "Analysis failed",
        requestError instanceof Error ? requestError.message : "Failed to analyze dropout risk.",
      );
    } finally {
      setLoadingDropout(false);
    }
  }

  async function handleClassPerformance() {
    if (!classId) {
      error("Missing class", "Select class before generating performance trends.");
      return;
    }

    setLoadingClassTrends(true);
    setClassPerformance(null);

    try {
      const response = await fetch("/api/analytics-ai/class-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          classId,
          learningAreaId: learningAreaId || undefined,
          lookbackDays: Number(lookbackDays),
        }),
      });
      const result = await parseResponse<AnalyticsResult<ClassPerformanceResult>>(response);
      setClassPerformance(result);
      success("Class trends ready", "Class performance intelligence generated.");
    } catch (requestError) {
      error(
        "Analysis failed",
        requestError instanceof Error
          ? requestError.message
          : "Failed to generate class performance trends.",
      );
    } finally {
      setLoadingClassTrends(false);
    }
  }

  async function handleSchoolHealth() {
    setLoadingSchoolHealth(true);
    setSchoolHealth(null);

    try {
      const response = await fetch("/api/analytics-ai/school-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          lookbackDays: Number(lookbackDays),
          minAssessments: 12,
        }),
      });
      const result = await parseResponse<AnalyticsResult<SchoolHealthResult>>(response);
      setSchoolHealth(result);
      success("School health ready", "School-level intelligence generated.");
    } catch (requestError) {
      error(
        "Analysis failed",
        requestError instanceof Error ? requestError.message : "Failed to generate school health.",
      );
    } finally {
      setLoadingSchoolHealth(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intelligence & Prediction Layer"
        description="AI-assisted dropout risk, class performance trends, and school health intelligence."
        icon={<BrainCircuit className="h-5 w-5" />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Analysis Context</CardTitle>
          <CardDescription>Choose filters once, then run any intelligence workflow below.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Select
            label="Class (for class-level tools)"
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

          <Input
            label="Lookback Days"
            type="number"
            min={30}
            max={365}
            value={lookbackDays}
            onChange={(event) => setLookbackDays(event.target.value)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Dropout Risk Detection
            </CardTitle>
            <CardDescription>Attendance + grades trend + discipline frequency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleDropoutRisk} loading={loadingDropout}>
              Run Dropout Risk
            </Button>

            {dropoutRisk && (
              <div className="space-y-3 rounded-lg border border-secondary-200 bg-secondary-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">{confidenceBadge(dropoutRisk.confidence)}</Badge>
                  <Badge variant="error">High: {dropoutRisk.result.highRiskCount}</Badge>
                  <Badge variant="warning">Medium: {dropoutRisk.result.mediumRiskCount}</Badge>
                  <Badge variant="success">Low: {dropoutRisk.result.lowRiskCount}</Badge>
                </div>
                <p className="text-sm text-secondary-700">{dropoutRisk.result.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Class Performance Trends
            </CardTitle>
            <CardDescription>Subject movement over time + teacher comparison analytics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleClassPerformance} loading={loadingClassTrends}>
              Run Class Trends
            </Button>

            {classPerformance && (
              <div className="space-y-3 rounded-lg border border-secondary-200 bg-secondary-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">{confidenceBadge(classPerformance.confidence)}</Badge>
                  <Badge variant="success">
                    Avg Score: {classPerformance.result.overallAverageScore.toFixed(2)}
                  </Badge>
                </div>
                <p className="text-sm text-secondary-700">{classPerformance.result.insights.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              School Health Dashboard
            </CardTitle>
            <CardDescription>Weakest subject + declining and improving classes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleSchoolHealth} loading={loadingSchoolHealth}>
              Run School Health
            </Button>

            {schoolHealth && (
              <div className="space-y-3 rounded-lg border border-secondary-200 bg-secondary-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">{confidenceBadge(schoolHealth.confidence)}</Badge>
                  <Badge variant="error">
                    Declining: {schoolHealth.result.decliningClasses.length}
                  </Badge>
                  <Badge variant="success">
                    Improving: {schoolHealth.result.improvingClasses.length}
                  </Badge>
                </div>
                <p className="text-sm text-secondary-700">{schoolHealth.result.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {dropoutRisk && (
        <Card>
          <CardHeader>
            <CardTitle>Dropout Risk Learners</CardTitle>
            <CardDescription>
              Class: {dropoutRisk.result.className} | Students evaluated: {dropoutRisk.result.evaluatedStudents}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dropoutRisk.result.students.length === 0 ? (
              <p className="text-sm text-secondary-500">No learner records found for the selected filters.</p>
            ) : (
              <ul className="space-y-3">
                {dropoutRisk.result.students.map((student) => (
                  <li key={student.studentId} className="rounded-lg border border-secondary-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-secondary-800">{student.name}</p>
                      <Badge
                        variant={
                          student.riskLevel === "high"
                            ? "error"
                            : student.riskLevel === "medium"
                              ? "warning"
                              : "success"
                        }
                      >
                        {student.riskLevel.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">Attendance {student.attendanceRate.toFixed(1)}%</Badge>
                      <Badge variant="outline">Score {student.averageScore.toFixed(2)}</Badge>
                      <Badge variant="outline">Trend {student.trendDelta.toFixed(2)}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-secondary-600">{student.reason.join(" ")}</p>
                    <p className="mt-1 text-sm text-secondary-600">
                      <strong>Recommendation:</strong> {student.recommendation.join(" ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {classPerformance && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Subject Trends</CardTitle>
              <CardDescription>{classPerformance.result.className}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {classPerformance.result.subjectTrends.map((item) => (
                <div key={item.learningAreaId} className="rounded-md border border-secondary-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-secondary-800">{item.learningAreaName}</p>
                    <Badge
                      variant={
                        item.trendDirection === "improving"
                          ? "success"
                          : item.trendDirection === "declining"
                            ? "error"
                            : "outline"
                      }
                    >
                      {item.trendDirection}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-secondary-600">
                    Avg {item.averageScore.toFixed(2)} | Prev {item.previousAverageScore.toFixed(2)} | Delta{" "}
                    {item.trendDelta.toFixed(2)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Teacher Comparison</CardTitle>
              <CardDescription>Computed from class assessments and active assignments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {classPerformance.result.teacherComparison.length === 0 ? (
                <p className="text-sm text-secondary-500">No teacher comparison data available for this filter.</p>
              ) : (
                classPerformance.result.teacherComparison.map((item) => (
                  <div key={`${item.teacherId}-${item.learningAreaId}`} className="rounded-md border border-secondary-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-secondary-800">{item.teacherName}</p>
                      <Badge variant="outline">{item.learningAreaName}</Badge>
                      <Badge variant="info">Avg {item.averageScore.toFixed(2)}</Badge>
                      <Badge
                        variant={item.relativeToClassAverage >= 0 ? "success" : "warning"}
                      >
                        {item.relativeToClassAverage >= 0 ? "+" : ""}
                        {item.relativeToClassAverage.toFixed(2)} vs class
                      </Badge>
                    </div>
                    {item.insight ? (
                      <p className="mt-1 text-sm text-secondary-600">{item.insight}</p>
                    ) : null}
                  </div>
                ))
              )}

              <div className="rounded-md border border-secondary-200 bg-secondary-50 p-3">
                <p className="text-sm font-semibold text-secondary-800">Recommendations</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-secondary-700">
                  {classPerformance.result.insights.recommendations.map((item, index) => (
                    <li key={`cp-rec-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {schoolHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              School Health Intelligence
            </CardTitle>
            <CardDescription>School-wide trend movement and strategic actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">
                Overall Score: {schoolHealth.result.overallAverageScore.toFixed(2)}
              </Badge>
              {schoolHealth.result.weakestSubject ? (
                <Badge variant="warning">
                  Weakest: {schoolHealth.result.weakestSubject.learningAreaName}
                </Badge>
              ) : (
                <Badge variant="outline">Weakest subject unavailable</Badge>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-secondary-200 bg-white p-3">
                <p className="text-sm font-semibold text-secondary-800">Declining Classes</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-secondary-700">
                  {schoolHealth.result.decliningClasses.length === 0 ? (
                    <li>No declining classes above minimum sample size.</li>
                  ) : (
                    schoolHealth.result.decliningClasses.map((item) => (
                      <li key={`declining-${item.classId}`}>
                        {item.className}: delta {item.trendDelta.toFixed(2)}, avg {item.averageScore.toFixed(2)}
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="rounded-md border border-secondary-200 bg-white p-3">
                <p className="text-sm font-semibold text-secondary-800">Improving Classes</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-secondary-700">
                  {schoolHealth.result.improvingClasses.length === 0 ? (
                    <li>No improving classes above minimum sample size.</li>
                  ) : (
                    schoolHealth.result.improvingClasses.map((item) => (
                      <li key={`improving-${item.classId}`}>
                        {item.className}: delta +{item.trendDelta.toFixed(2)}, avg {item.averageScore.toFixed(2)}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            <div className="rounded-md border border-secondary-200 bg-secondary-50 p-3">
              <p className="text-sm font-semibold text-secondary-800">Priority Actions</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-secondary-700">
                {schoolHealth.result.priorityActions.map((item, index) => (
                  <li key={`action-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {loadingContext && (
        <Alert>
          <AlertTitle>Loading context</AlertTitle>
          <AlertDescription>Fetching classes and learning areas for intelligence filters.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
