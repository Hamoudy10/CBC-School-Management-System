"use client";

import { useState, useCallback, useEffect } from "react";
import {
  MessageSquare,
  Calendar,
  BrainCircuit,
  Loader2,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

type TabConfig = {
  id: string;
  label: string;
  icon: any;
  description: string;
};

const TABS: TabConfig[] = [
  { id: "summary", label: "Weekly Summary", icon: MessageSquare, description: "Generate personalized weekly progress summaries for parents" },
  { id: "sentiment", label: "Sentiment Analysis", icon: BrainCircuit, description: "Analyze parent communication sentiment patterns" },
  { id: "meeting", label: "Schedule Meeting", icon: Calendar, description: "AI-powered parent-teacher meeting scheduling" },
];

export default function ParentEngagementPage() {
  const [activeTab, setActiveTab] = useState("summary");
  const [students, setStudents] = useState<any[]>([]);
  const { error: toastError } = useToast();

  useEffect(() => {
    fetch("/api/students?limit=100")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStudents(d.data || []);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent Engagement Suite"
        description="AI-powered tools to strengthen parent-school communication and engagement"
      />

      <div className="flex gap-2 border-b pb-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t whitespace-nowrap transition-colors ${
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

      <p className="text-sm text-gray-500">{TABS.find((t) => t.id === activeTab)?.description}</p>

      {activeTab === "summary" && <WeeklySummaryView students={students} toastError={toastError} />}
      {activeTab === "sentiment" && <SentimentView toastError={toastError} />}
      {activeTab === "meeting" && <MeetingSchedulerView students={students} toastError={toastError} />}
    </div>
  );
}

function WeeklySummaryView({ students, toastError }: { students: any[]; toastError: (title: string, description?: string) => void }) {
  const [selectedStudent, setSelectedStudent] = useState("");
  const [language, setLanguage] = useState("en");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const res = await fetch("/api/parent-engagement/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudent, language }),
      });
      const json = await res.json();
      if (json.success) setResult(json.data);
      else toastError("Error", json.error);
    } catch {
      toastError("Error", "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  }, [selectedStudent, language, toastError]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Generate Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
              <Select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                <option value="">Select student...</option>
                {students.map((s: any) => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.first_name} {s.last_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="sw">Swahili</option>
                <option value="code-mix">Code Mix (Eng/Swa)</option>
              </Select>
            </div>
            <Button onClick={generate} disabled={loading || !selectedStudent}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Generate Summary
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Weekly Summary: {result.summary.studentName}</CardTitle>
                  <CardDescription>{result.summary.className} | {result.summary.term}</CardDescription>
                </div>
                <Badge variant="info">Confidence: {Math.round(result.confidence * 100)}%</Badge>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Academic Highlights</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {result.summary.academicHighlights.map((h: any, i: number) => (
                  <div key={i} className="p-2 bg-gray-50 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{h.learningArea}</span>
                      <Badge variant="outline" className="text-xs">{h.performance}</Badge>
                    </div>
                    <p className="text-xs text-gray-600">{h.teacherComment}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Attendance</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div><p className="text-lg font-bold text-green-600">{result.summary.attendanceSummary.present}</p><p className="text-xs text-gray-500">Present</p></div>
                    <div><p className="text-lg font-bold text-red-600">{result.summary.attendanceSummary.absent}</p><p className="text-xs text-gray-500">Absent</p></div>
                    <div><p className="text-lg font-bold text-amber-600">{result.summary.attendanceSummary.late}</p><p className="text-xs text-gray-500">Late</p></div>
                    <div><p className="text-lg font-bold text-blue-600">{result.summary.attendanceSummary.rate}%</p><p className="text-xs text-gray-500">Rate</p></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Behavior Notes</CardTitle></CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1">
                    {result.summary.behaviorNotes.map((n: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700">{n}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Message from Teacher</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 italic">{result.summary.teacherMessage}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Parent Tips</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1">
                {result.summary.parentTips.map((tip: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700">{tip}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {result.summary.upcomingEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Upcoming Events</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.summary.upcomingEvents.map((e: string, i: number) => (
                    <div key={i} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      <Calendar className="h-3 w-3" />
                      {e}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function SentimentView({ toastError }: { toastError: (title: string, description?: string) => void }) {
  const [messages, setMessages] = useState<{ id: string; text: string; sender: string; timestamp: string }[]>([
    { id: "1", text: "", sender: "parent", timestamp: new Date().toISOString() },
  ]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const addMessage = () => {
    setMessages((prev) => [
      ...prev,
      { id: String(prev.length + 1), text: "", sender: "parent", timestamp: new Date().toISOString() },
    ]);
  };

  const updateMessage = (idx: number, field: string, value: string) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
  };

  const removeMessage = (idx: number) => {
    setMessages((prev) => prev.filter((_, i) => i !== idx));
  };

  const analyze = useCallback(async () => {
    const validMessages = messages.filter((m) => m.text.trim());
    if (validMessages.length === 0) {
      toastError("Error", "Add at least one message.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/parent-engagement/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: validMessages, scope: "parent-teacher" }),
      });
      const json = await res.json();
      if (json.success) setResult(json.data);
      else toastError("Error", json.error);
    } catch {
      toastError("Error", "Failed to analyze sentiment");
    } finally {
      setLoading(false);
    }
  }, [messages, toastError]);

  const sentimentColor = (s: string) => {
    switch (s) {
      case "positive": return "text-green-600 bg-green-50";
      case "negative": return "text-red-600 bg-red-50";
      case "neutral": return "text-gray-600 bg-gray-50";
      default: return "text-amber-600 bg-amber-50";
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Parent Messages</CardTitle>
          <Button size="sm" onClick={addMessage}>+ Add Message</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.map((msg, i) => (
            <div key={msg.id} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <div className="flex gap-2">
                  <select
                    value={msg.sender}
                    onChange={(e) => updateMessage(i, "sender", e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-xs"
                  >
                    <option value="parent">Parent</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                  {messages.length > 1 && (
                    <button onClick={() => removeMessage(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  )}
                </div>
                <textarea
                  value={msg.text}
                  onChange={(e) => updateMessage(i, "text", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={2}
                  placeholder="Paste parent message text..."
                />
              </div>
            </div>
          ))}

          <Button onClick={analyze} disabled={loading || !messages.some((m) => m.text.trim())}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
            Analyze Sentiment
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Analysis Results</CardTitle>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentColor(result.overallSentiment)}`}>
                    {result.overallSentiment.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">Score: {result.sentimentScore.toFixed(2)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">{result.trends.description}</span>
                {result.requiresAttention && (
                  <Alert variant="warning" className="py-1 px-2">
                    <AlertTriangle className="h-3 w-3" />
                    <AlertDescription className="text-xs">Requires attention</AlertDescription>
                  </Alert>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Per-Message Analysis</p>
                <div className="space-y-2">
                  {result.messageLevel.map((m: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sentimentColor(m.sentiment)}`}>
                        {m.sentiment}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500">Score: {m.score.toFixed(2)}</p>
                        {m.keyPhrases.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {m.keyPhrases.map((p: string, j: number) => (
                              <span key={j} className="text-xs bg-blue-50 text-blue-600 px-1 rounded">{p}</span>
                            ))}
                          </div>
                        )}
                        {m.flaggedIssues?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {m.flaggedIssues.map((fi: string, j: number) => (
                              <span key={j} className="text-xs bg-red-50 text-red-600 px-1 rounded">{fi}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Recommendations</p>
                <ul className="list-disc list-inside space-y-1">
                  {result.recommendations.map((r: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700">{r}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function MeetingSchedulerView({ students, toastError }: { students: any[]; toastError: (title: string, description?: string) => void }) {
  const [selectedStudent, setSelectedStudent] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("14:00");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const schedule = useCallback(async () => {
    if (!selectedStudent || !reason.trim() || !preferredDate) {
      toastError("Missing fields", "Student, reason, and date are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/parent-engagement/schedule-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: "00000000-0000-0000-0000-000000000000",
          teacherId: "00000000-0000-0000-0000-000000000000",
          studentId: selectedStudent,
          preferredDates: [preferredDate],
          preferredTimes: [preferredTime],
          durationMinutes: 30,
          reason: reason.trim(),
          urgency,
        }),
      });
      const json = await res.json();
      if (json.success) setResult(json.data);
      else toastError("Error", json.error);
    } catch {
      toastError("Error", "Failed to schedule meeting");
    } finally {
      setLoading(false);
    }
  }, [selectedStudent, reason, urgency, preferredDate, preferredTime, toastError]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Meeting Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
              <Select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                <option value="">Select student...</option>
                {students.map((s: any) => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.first_name} {s.last_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <Input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Meeting</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={2}
                placeholder="Briefly describe why the meeting is needed..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
              <Select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </Select>
            </div>
          </div>

          <Button className="mt-4" onClick={schedule} disabled={loading || !selectedStudent || !reason.trim() || !preferredDate}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
            Find Available Slots
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Suggested Meeting Slots</CardTitle>
              <CardDescription>{result.meetingTitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {result.suggestedSlots.map((slot: any, i: number) => (
                  <Card key={i} className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary ${i === 0 ? "ring-2 ring-primary" : ""}`}>
                    <CardContent className="p-3 text-center">
                      <p className="text-sm font-medium">{slot.date}</p>
                      <p className="text-lg font-bold text-primary">{slot.startTime} - {slot.endTime}</p>
                      {slot.available && <Badge variant="success" className="mt-1">Available</Badge>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Agenda</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {result.agenda.map((item: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700">{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Preparation Notes</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {result.preparationNotes.map((note: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700">{note}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Confirmation</AlertTitle>
            <AlertDescription>{result.confirmationMessage}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
