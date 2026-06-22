"use client";

import { useState, useCallback } from "react";
import { CheckCircle2, XCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

interface Question {
  number: number;
  prompt: string;
  type: "multiple_choice" | "short_answer" | "structured" | "essay";
  marks: number;
  correctAnswer?: string;
}

interface StudentAnswer {
  studentId: string;
  studentName: string;
  answers: { questionNumber: number; response: string }[];
}

const LEVEL_COLORS: Record<string, string> = {
  exceeding: "bg-green-100 text-green-800 border-green-200",
  meeting: "bg-blue-100 text-blue-800 border-blue-200",
  approaching: "bg-amber-100 text-amber-800 border-amber-200",
  below_expectation: "bg-red-100 text-red-800 border-red-200",
};

export default function GradingPage() {
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [questions, setQuestions] = useState<Question[]>([
    { number: 1, prompt: "", type: "short_answer", marks: 5 },
  ]);
  const [studentName, setStudentName] = useState("");
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswer[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { error: toastError } = useToast();

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { number: prev.length + 1, prompt: "", type: "short_answer", marks: 5 },
    ]);
  };

  const removeQuestion = (num: number) => {
    setQuestions((prev) =>
      prev.filter((q) => q.number !== num).map((q, i) => ({ ...q, number: i + 1 }))
    );
  };

  const updateQuestion = (num: number, field: string, value: any) => {
    setQuestions((prev) =>
      prev.map((q) => (q.number === num ? { ...q, [field]: value } : q))
    );
  };

  const addStudent = () => {
    if (!studentName.trim()) return;
    const newStudent: StudentAnswer = {
      studentId: `student_${Date.now()}`,
      studentName: studentName.trim(),
      answers: questions.map((q) => ({
        questionNumber: q.number,
        response: "",
      })),
    };
    setStudentAnswers((prev) => [...prev, newStudent]);
    setStudentName("");
  };

  const updateStudentAnswer = (studentIdx: number, questionNumber: number, response: string) => {
    setStudentAnswers((prev) =>
      prev.map((s, i) =>
        i === studentIdx
          ? {
              ...s,
              answers: s.answers.map((a) =>
                a.questionNumber === questionNumber ? { ...a, response } : a
              ),
            }
          : s
      )
    );
  };

  const removeStudent = (idx: number) => {
    setStudentAnswers((prev) => prev.filter((_, i) => i !== idx));
  };

  const runGrading = useCallback(async () => {
    if (!subject.trim() || !grade.trim() || questions.length === 0 || studentAnswers.length === 0) {
      toastError("Missing fields", "Subject, grade, questions, and at least one student are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai-grading/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          grade,
          questions: questions.map((q) => ({
            number: q.number,
            prompt: q.prompt,
            type: q.type,
            marks: q.marks,
            correctAnswer: q.correctAnswer,
          })),
          studentResponses: studentAnswers,
        }),
      });
      const json = await res.json();
      if (json.success) setResult(json.data);
      else toastError("Error", json.error);
    } catch {
      toastError("Error", "Failed to grade");
    } finally {
      setLoading(false);
    }
  }, [subject, grade, questions, studentAnswers, toastError]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Auto-Grading"
        description="Grade student responses automatically with AI assistance"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Exam Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., Mathematics"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., Grade 4"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Questions</CardTitle>
              <Button size="sm" onClick={addQuestion}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.map((q) => (
                <div key={q.number} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Q{q.number}</span>
                    {questions.length > 1 && (
                      <button onClick={() => removeQuestion(q.number)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <textarea
                    value={q.prompt}
                    onChange={(e) => updateQuestion(q.number, "prompt", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    rows={2}
                    placeholder="Question prompt..."
                  />
                  <div className="flex gap-2">
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(q.number, "type", e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="short_answer">Short Answer</option>
                      <option value="structured">Structured</option>
                      <option value="essay">Essay</option>
                    </select>
                    <input
                      type="number"
                      value={q.marks}
                      onChange={(e) => updateQuestion(q.number, "marks", parseInt(e.target.value) || 1)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      min={1}
                    />
                    <span className="text-xs text-gray-500 self-center">marks</span>
                  </div>
                  {q.type === "multiple_choice" && (
                    <input
                      type="text"
                      value={q.correctAnswer || ""}
                      onChange={(e) => updateQuestion(q.number, "correctAnswer", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Correct answer"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Students</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStudent()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Student name"
                />
                <Button size="sm" onClick={addStudent}>Add Student</Button>
              </div>

              {studentAnswers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Add students and enter their responses below.
                </p>
              )}

              {studentAnswers.map((student, si) => (
                <div key={si} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{student.studentName}</span>
                    <button onClick={() => removeStudent(si)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {student.answers.map((ans) => (
                    <div key={ans.questionNumber} className="mb-2">
                      <label className="text-xs text-gray-500">Q{ans.questionNumber}</label>
                      <textarea
                        value={ans.response}
                        onChange={(e) => updateStudentAnswer(si, ans.questionNumber, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                        rows={2}
                        placeholder="Student's answer..."
                      />
                    </div>
                  ))}
                </div>
              ))}

              {studentAnswers.length > 0 && (
                <Button className="w-full" onClick={runGrading} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Grade All Responses
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Results</CardTitle>
                <Badge variant="secondary">Confidence: {Math.round(result.confidence * 100)}%</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Average</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{result.classSummary.averageScore.toFixed(1)}/{result.gradedResponses[0]?.maxTotalScore || 0}</p></CardContent></Card>
                <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Highest</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{result.classSummary.highestScore}</p></CardContent></Card>
                <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Lowest</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{result.classSummary.lowestScore}</p></CardContent></Card>
                <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Median</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{result.classSummary.medianScore}</p></CardContent></Card>
                <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Students</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{result.totalStudents}</p></CardContent></Card>
              </div>

              <div className="space-y-3">
                {result.gradedResponses.map((gr: any, i: number) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{gr.studentName}</CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{gr.totalScore}/{gr.maxTotalScore} ({gr.percentage}%)</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${LEVEL_COLORS[gr.performanceLevel] || ""}`}>
                            {gr.performanceLevel.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {gr.questionResults.map((qr: any, j: number) => (
                          <div key={j} className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm">
                            <div className="flex-shrink-0 mt-0.5">
                              {qr.score >= qr.maxScore * 0.7
                                ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                : <XCircle className="h-4 w-4 text-red-500" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">Q{qr.questionNumber}: {qr.score}/{qr.maxScore}</p>
                              <p className="text-gray-600">{qr.feedback}</p>
                              {qr.strengths.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {qr.strengths.map((s: string, k: number) => (
                                    <span key={k} className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{s}</span>
                                  ))}
                                </div>
                              )}
                              {qr.weaknesses.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {qr.weaknesses.map((w: string, k: number) => (
                                    <span key={k} className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{w}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <Alert className="mt-2">
                        <AlertTitle>Overall Feedback</AlertTitle>
                        <AlertDescription>{gr.overallFeedback}</AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
