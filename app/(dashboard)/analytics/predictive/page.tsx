"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BrainCircuit,
  TrendingUp,
  Users,
  Target,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ClassOption = { classId: string; name: string; gradeName: string };

interface TabConfig {
  id: string;
  label: string;
  icon: any;
}

const TABS: TabConfig[] = [
  { id: "forecast", label: "Performance Forecast", icon: TrendingUp },
  { id: "clusters", label: "Student Clusters", icon: Users },
  { id: "interventions", label: "Interventions", icon: Target },
  { id: "recommendations", label: "Subject Recommendations", icon: BrainCircuit },
];

const RISK_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${RISK_COLORS[level] || RISK_COLORS.low}`}>
      {level.toUpperCase()}
    </span>
  );
}

function ForecastView({ classId }: { classId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { error: toastError } = useToast();

  const run = useCallback(async () => {
    if (!classId) {return;}
    if (!UUID_RE.test(classId)) {toastError("Validation Error", "Invalid class selection."); return;}
    setLoading(true);
    try {
      const res = await fetch("/api/predictive-analytics/performance-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      const json = await res.json();
      if (json.success) {setData(json.data);}
      else {toastError("Error", json.error);}
    } catch {
      toastError("Error", "Failed to generate forecast");
    } finally {
      setLoading(false);
    }
  }, [classId, toastError]);

  return (
    <div className="space-y-4">
      <Button onClick={run} disabled={loading || !classId}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Generate Forecast
      </Button>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Current Avg</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.classSummary.averageCurrentScore.toFixed(2)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Predicted Avg</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.classSummary.averagePredictedScore.toFixed(2)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">At Risk</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{data.classSummary.atRiskCount}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Declining</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">{data.classSummary.decliningCount}</p></CardContent></Card>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Learning Area</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Current</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Predicted (Term)</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Predicted (Year)</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trend</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.forecasts.map((f: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{f.studentName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{f.learningAreaName}</td>
                    <td className="px-4 py-3 text-sm text-center">{f.currentScore.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-center font-medium">{f.predictedEndTermScore.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-center">{f.predictedEndYearScore.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center"><RiskBadge level={f.riskOfDecline} /></td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${f.trend === "improving" ? "text-green-600" : f.trend === "declining" ? "text-red-600" : "text-gray-500"}`}>
                        {f.trend === "improving" ? "↑" : f.trend === "declining" ? "↓" : "→"} {f.trend}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ClusterView({ classId }: { classId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { error: toastError } = useToast();

  const run = useCallback(async () => {
    if (!classId) {return;}
    if (!UUID_RE.test(classId)) {toastError("Validation Error", "Invalid class selection."); return;}
    setLoading(true);
    try {
      const res = await fetch("/api/predictive-analytics/student-clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, clusterCount: 4 }),
      });
      const json = await res.json();
      if (json.success) {setData(json.data);}
      else {toastError("Error", json.error);}
    } catch {
      toastError("Error", "Failed to generate clusters");
    } finally {
      setLoading(false);
    }
  }, [classId, toastError]);

  return (
    <div className="space-y-4">
      <Button onClick={run} disabled={loading || !classId}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Analyze Student Groups
      </Button>

      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.clusters.map((c: any) => (
            <Card key={c.clusterId} className={expanded === c.clusterId ? "ring-2 ring-primary" : ""}>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(expanded === c.clusterId ? null : c.clusterId)}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{c.label}</CardTitle>
                    <CardDescription>{c.studentCount} student{c.studentCount !== 1 ? "s" : ""}</CardDescription>
                  </div>
                  {expanded === c.clusterId ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">{c.description}</p>
                {expanded === c.clusterId && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Students:</p>
                      <div className="flex flex-wrap gap-1">
                        {c.students.map((s: any) => (
                          <Badge key={s.studentId} variant="default">{s.name}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Common Traits:</p>
                      {c.commonTraits.map((t: any, i: number) => (
                        <p key={i} className="text-sm text-gray-700">{t.trait}: {t.value}</p>
                      ))}
                    </div>
                    <Alert>
                      <AlertTitle>Recommended Intervention</AlertTitle>
                      <AlertDescription>{c.recommendedIntervention}</AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function InterventionView({ classId }: { classId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { error: toastError } = useToast();

  const run = useCallback(async () => {
    if (!classId) {return;}
    if (!UUID_RE.test(classId)) {toastError("Validation Error", "Invalid class selection."); return;}
    setLoading(true);
    try {
      const res = await fetch("/api/predictive-analytics/intervention-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, minRiskLevel: "medium" }),
      });
      const json = await res.json();
      if (json.success) {setData(json.data);}
      else {toastError("Error", json.error);}
    } catch {
      toastError("Error", "Failed to generate interventions");
    } finally {
      setLoading(false);
    }
  }, [classId, toastError]);

  const riskColor = (level: string) => {
    switch (level) {
      case "high": return "text-red-600 bg-red-50";
      case "medium": return "text-amber-600 bg-amber-50";
      default: return "text-green-600 bg-green-50";
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={run} disabled={loading || !classId}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Generate Intervention Plans
      </Button>

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Students</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.summary.totalStudents}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">High Risk</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{data.summary.highRiskCount}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Medium Risk</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">{data.summary.mediumRiskCount}</p></CardContent></Card>
          </div>

          <div className="space-y-3">
            {data.recommendations.map((r: any, i: number) => (
              <Card key={i} className={`border-l-4 ${r.riskLevel === "high" ? "border-l-red-500" : r.riskLevel === "medium" ? "border-l-amber-500" : "border-l-green-500"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{r.studentName}</CardTitle>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskColor(r.riskLevel)}`}>{r.riskLevel.toUpperCase()}</span>
                      <span className="text-xs text-gray-500">Priority: {r.priority}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {r.interventions.map((inv: any, j: number) => (
                      <div key={j} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{inv.action}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{inv.type}</Badge>
                            <span className="text-xs text-gray-500">By: {inv.responsibleParty}</span>
                            <span className="text-xs text-gray-500">Timeline: {inv.timeline}</span>
                            <span className={`text-xs font-medium ${inv.expectedImpact === "high" ? "text-green-600" : inv.expectedImpact === "medium" ? "text-amber-600" : "text-gray-500"}`}>
                              Impact: {inv.expectedImpact}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {r.notes && <p className="text-xs text-gray-500 mt-2">{r.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function PredictiveAnalyticsPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [activeTab, setActiveTab] = useState("forecast");

  useEffect(() => {
    fetch("/api/settings/classes")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setClasses((d.data ?? []).map((c: any) => ({
            classId: c.classId ?? c.class_id ?? c.id,
            name: c.name,
            gradeName: c.gradeName ?? c.grade_name ?? "",
          })).filter((c: any) => c.classId && c.classId !== "undefined"));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Predictive Analytics"
        description="AI-powered student performance prediction, clustering, and intervention recommendations"
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Analysis Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select a class...</option>
                {classes.map((c) => (
                  <option key={c.classId} value={c.classId || ""}>
                    {c.name} {c.gradeName ? `- ${c.gradeName}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 border-b pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              activeTab === tab.id
                ? "bg-white border border-b-white border-gray-200 text-primary"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {!classId && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Select a Class</AlertTitle>
          <AlertDescription>Choose a class above to begin analysis.</AlertDescription>
        </Alert>
      )}

      {classId && activeTab === "forecast" && <ForecastView classId={classId} />}
      {classId && activeTab === "clusters" && <ClusterView classId={classId} />}
      {classId && activeTab === "interventions" && <InterventionView classId={classId} />}
      {classId && activeTab === "recommendations" && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 mb-4">Select a student from the class to get personalized subject and career recommendations.</p>
            <StudentRecommendationView classId={classId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StudentRecommendationView({ classId }: { classId: string }) {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { error: toastError } = useToast();

  useEffect(() => {
    if (!classId) {return;}
    fetch(`/api/students?classId=${classId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {setStudents((d.data ?? []).map((s: any) => ({
          student_id: s.studentId ?? s.student_id,
          first_name: s.firstName ?? s.first_name ?? "",
          last_name: s.lastName ?? s.last_name ?? "",
        })).filter((s: any) => s.student_id));}
      })
      .catch(() => {});
  }, [classId]);

  const getRecommendations = useCallback(async () => {
    if (!selectedStudent) {return;}
    setLoading(true);
    try {
      const res = await fetch("/api/predictive-analytics/subject-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudent, classId, includeCareerPaths: true }),
      });
      const json = await res.json();
      if (json.success) {setData(json.data);}
      else {toastError("Error", json.error);}
    } catch {
      toastError("Error", "Failed to get recommendations");
    } finally {
      setLoading(false);
    }
  }, [selectedStudent, classId, toastError]);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <div className="w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
          <Select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
            <option value="">Select a student...</option>
            {students.map((s: any) => (
              <option key={s.student_id} value={s.student_id}>
                {s.first_name} {s.last_name}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={getRecommendations} disabled={loading || !selectedStudent}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Get Recommendations
        </Button>
      </div>

      {data && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Current Performance</h3>
            <div className="flex flex-wrap gap-2">
              {data.recommendation.currentLearningAreas.map((a: any) => (
                <Badge key={a.id} variant={a.score >= 3 ? "default" : a.score >= 2 ? "warning" : "outline"}>
                  {a.name}: {a.score.toFixed(1)}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recommended Learning Areas</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {data.recommendation.recommendedLearningAreas.map((r: any, i: number) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{r.learningAreaName}</CardTitle>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.expectedPerformance === "strong" ? "bg-green-100 text-green-700" : r.expectedPerformance === "moderate" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {r.expectedPerformance}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">Match: {r.matchScore}%</span>
                    </div>
                    <p className="text-sm text-gray-600">{r.rationale}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {data.recommendation.careerPaths.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Career Paths</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {data.recommendation.careerPaths.map((c: any, i: number) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{c.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${c.match}%` }} />
                      </div>
                      <p className="text-sm text-gray-600">{c.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Alert>
            <AlertTitle>Guidance</AlertTitle>
            <AlertDescription>{data.recommendation.guidance}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
