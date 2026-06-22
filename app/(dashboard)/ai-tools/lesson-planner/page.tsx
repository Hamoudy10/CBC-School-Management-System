"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, Clock, Target, Users, Loader2, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

type ClassOption = { classId: string; name: string };
type LearningAreaOption = { learningAreaId: string; name: string };

const PEDAGOGICAL_APPROACHES = [
  { value: "learner-centered", label: "Learner-Centered" },
  { value: "inquiry-based", label: "Inquiry-Based" },
  { value: "differentiated", label: "Differentiated" },
  { value: "teacher-directed", label: "Teacher-Directed" },
];

export default function LessonPlannerPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [learningAreas, setLearningAreas] = useState<LearningAreaOption[]>([]);
  const [classId, setClassId] = useState("");
  const [learningAreaId, setLearningAreaId] = useState("");
  const [duration, setDuration] = useState(60);
  const [approach, setApproach] = useState("learner-centered");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { error: toastError } = useToast();

  useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setClasses(d.data || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!classId) return;
    fetch("/api/learning-areas")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setLearningAreas(d.data || []);
      })
      .catch(() => {});
  }, [classId]);

  const generate = useCallback(async () => {
    if (!classId || !learningAreaId) {
      toastError("Missing fields", "Class and learning area are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai-grading/generate-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          learningAreaId,
          durationMinutes: duration,
          pedagogicalApproach: approach,
          includeResources: true,
          includeAssessment: true,
        }),
      });
      const json = await res.json();
      if (json.success) setResult(json.data);
      else toastError("Error", json.error);
    } catch {
      toastError("Error", "Failed to generate lesson plan");
    } finally {
      setLoading(false);
    }
  }, [classId, learningAreaId, duration, approach, toastError]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Lesson Planner"
        description="Generate CBC-aligned lesson plans with AI"
      />

      <Card>
        <CardHeader><CardTitle>Lesson Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select class...</option>
                {classes.map((c) => (
                  <option key={c.classId} value={c.classId}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Learning Area</label>
              <Select value={learningAreaId} onChange={(e) => setLearningAreaId(e.target.value)}>
                <option value="">Select area...</option>
                {learningAreas.map((la) => (
                  <option key={la.learningAreaId} value={la.learningAreaId}>{la.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
              <Input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 60)} min={15} max={180} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Approach</label>
              <Select value={approach} onChange={(e) => setApproach(e.target.value)}>
                {PEDAGOGICAL_APPROACHES.map((pa) => (
                  <option key={pa.value} value={pa.value}>{pa.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={generate} disabled={loading || !classId || !learningAreaId}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
                Generate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{result.lessonPlan.title}</CardTitle>
                  <CardDescription>
                    {result.lessonPlan.grade} | {result.lessonPlan.subject} | {result.lessonPlan.duration} min
                  </CardDescription>
                </div>
                <Badge variant="secondary">Confidence: {Math.round(result.confidence * 100)}%</Badge>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" /> Learning Outcomes</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {result.lessonPlan.learningOutcomes.map((o: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700">{o}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Core Competencies</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {result.lessonPlan.coreCompetencies.map((c: string, i: number) => (
                    <Badge key={i} variant="secondary">{c}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {result.lessonPlan.values.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Values</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {result.lessonPlan.values.map((v: string, i: number) => (
                    <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">{v}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Lesson Activities</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.lessonPlan.activities.map((act: any, i: number) => (
                  <div key={i} className="border-l-4 border-primary pl-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{act.time} ({act.duration} min)</span>
                      <span className="text-sm font-medium">{act.activity}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{act.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                      <div><span className="font-medium">Teacher:</span> {act.teacherRole}</div>
                      <div><span className="font-medium">Learner:</span> {act.learnerRole}</div>
                    </div>
                    {act.resources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {act.resources.map((r: string, j: number) => (
                          <span key={j} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Assessment Methods</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {result.lessonPlan.assessmentMethods.map((m: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700">{m}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Differentiation Strategies</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {result.lessonPlan.differentiationStrategies.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700">{s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Materials &amp; Resources</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {result.lessonPlan.lessonMaterials.map((m: string, i: number) => (
                  <Badge key={i} variant="outline">{m}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Homework Task</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">{result.lessonPlan.homeworkTask}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Teacher Reflection</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 italic">{result.lessonPlan.teacherReflection}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
